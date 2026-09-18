// ============================================================
// SYMMETRY 2026
// QR FOOD RECEIVED VERIFICATION SYSTEM
// ============================================================
// Backend: Firebase Firestore
//
// Lookup key:
//   registration_id (FIELD inside participant_list)
//
// Food preference:
//   food_preference
//
// Food verification:
//   food_received = "yes"
//   food_received_at = serverTimestamp()
//
// QR scanner:
//   html5-qrcode
// ============================================================

import { Html5Qrcode } from
    "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.esm.js";

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
    getFirestore,
    collection,
    query,
    where,
    limit,
    getDocs,
    updateDoc,
    serverTimestamp
} from
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyAiq2xnBHR5oRvRgTxVCuA1J2aJYS7nwrM",
    authDomain: "symmetry-annual-fest.firebaseapp.com",
    projectId: "symmetry-annual-fest",
    storageBucket: "symmetry-annual-fest.firebasestorage.app",
    messagingSenderId: "854008910944",
    appId: "1:854008910944:web:cf20ff04a22831cb6b5f05",
    measurementId: "G-FEDPP8GWRR"
};


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

const app = initializeApp(firebaseConfig);

// IMPORTANT:
// Your Firestore database is named "symmetry"
const db = getFirestore(app, "symmetry");

const PARTICIPANT_COLLECTION = "participant_list";


// ============================================================
// DOM ELEMENTS
// ============================================================

const reader = document.getElementById("reader");
const resultSection = document.getElementById("result-section");
const resultCard = document.getElementById("result-card");
const scannerStatus = document.getElementById("scanner-status");
const scanAgainButton = document.getElementById("scan-again");


// ============================================================
// SCANNER STATE
// ============================================================

let scanner = null;
let scanning = false;
let processingScan = false;


// ============================================================
// SECURITY / HTML ESCAPING
// ============================================================

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// NORMALIZE FOOD PREFERENCE
// ============================================================

function formatFoodPreference(value) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        return "Not specified";
    }

    const preference = String(value)
        .trim()
        .toLowerCase();

    if (preference === "veg" ||
        preference === "vegetarian") {
        return "VEG";
    }

    if (preference === "non-veg" ||
        preference === "nonveg" ||
        preference === "non vegetarian" ||
        preference === "non-vegetarian") {
        return "NON-VEG";
    }

    // If your database uses another value,
    // display it without destroying the original information.
    return String(value).trim().toUpperCase();
}


// ============================================================
// CHECK WHETHER FOOD HAS ALREADY BEEN RECEIVED
// ============================================================

function isFoodReceived(value) {

    if (value === true) {
        return true;
    }

    if (typeof value === "string") {
        return value.trim().toLowerCase() === "yes";
    }

    return false;
}


// ============================================================
// EXTRACT REGISTRATION ID FROM QR CONTENT
// ============================================================
//
// Supported formats:
//
// 1. Plain:
//    SYM26-MTYM771D
//
// 2. JSON:
//    {"registration_id":"SYM26-MTYM771D"}
//
// 3. JSON:
//    {"participantID":"SYM26-MTYM771D"}
//
// 4. URL:
//    https://example.com/?registration_id=SYM26-MTYM771D
//
// 5. URL:
//    https://example.com/?participant_id=SYM26-MTYM771D
// ============================================================

function extractRegistrationId(decodedText) {

    if (!decodedText) {
        return null;
    }

    const raw = String(decodedText).trim();

    if (!raw) {
        return null;
    }


    // --------------------------------------------------------
    // Try JSON
    // --------------------------------------------------------

    try {

        const parsed = JSON.parse(raw);

        if (parsed && typeof parsed === "object") {

            if (parsed.registration_id) {
                return String(parsed.registration_id).trim();
            }

            if (parsed.participantID) {
                return String(parsed.participantID).trim();
            }

            if (parsed.participant_id) {
                return String(parsed.participant_id).trim();
            }

            if (parsed.registrationId) {
                return String(parsed.registrationId).trim();
            }
        }

    } catch (error) {
        // Not JSON — continue.
    }


    // --------------------------------------------------------
    // Try URL parameters
    // --------------------------------------------------------

    try {

        const url = new URL(raw);

        const registrationId =
            url.searchParams.get("registration_id") ||
            url.searchParams.get("registrationId") ||
            url.searchParams.get("participant_id") ||
            url.searchParams.get("participantID");

        if (registrationId) {
            return registrationId.trim();
        }

    } catch (error) {
        // Not a URL — continue.
    }


    // --------------------------------------------------------
    // Plain registration ID
    // --------------------------------------------------------

    return raw;
}


// ============================================================
// FIND PARTICIPANT
// ============================================================

async function findParticipant(registrationId) {

    const participantsRef =
        collection(db, PARTICIPANT_COLLECTION);

    const participantQuery = query(
        participantsRef,
        where("registration_id", "==", registrationId),
        limit(1)
    );

    const snapshot = await getDocs(participantQuery);

    if (snapshot.empty) {
        return null;
    }

    const docSnapshot = snapshot.docs[0];

    return {
        id: docSnapshot.id,
        ref: docSnapshot.ref,
        data: docSnapshot.data()
    };
}


// ============================================================
// STOP SCANNER
// ============================================================

async function stopScanner() {

    if (!scanner || !scanning) {
        return;
    }

    try {

        await scanner.stop();

    } catch (error) {

        console.warn(
            "Scanner stop warning:",
            error
        );

    }

    scanning = false;
}


// ============================================================
// DISPLAY PARTICIPANT
// ============================================================

function displayParticipant(participant) {

    const data = participant.data;

    const name =
        data.name ||
        data.full_name ||
        data.fullName ||
        "Participant";

    const registrationId =
        data.registration_id ||
        "N/A";

    const foodPreference =
        formatFoodPreference(data.food_preference);


    resultSection.hidden = false;


    resultCard.innerHTML = `
        <div class="result-success">

            <div class="result-icon">
                ✓
            </div>

            <h2>Food Verified</h2>

            <div class="participant-details">

                <div class="detail-row">
                    <span class="detail-label">
                        Name
                    </span>

                    <span class="detail-value">
                        ${escapeHTML(name)}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">
                        Registration ID
                    </span>

                    <span class="detail-value">
                        ${escapeHTML(registrationId)}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">
                        Food Preference
                    </span>

                    <span class="detail-value food-preference">
                        ${escapeHTML(foodPreference)}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">
                        Status
                    </span>

                    <span class="detail-value">
                        Food Received
                    </span>
                </div>

            </div>

        </div>
    `;

    resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ============================================================
// DISPLAY ALREADY RECEIVED
// ============================================================

function displayAlreadyReceived(participant) {

    const data = participant.data;

    const name =
        data.name ||
        data.full_name ||
        data.fullName ||
        "Participant";

    const registrationId =
        data.registration_id ||
        "N/A";

    const foodPreference =
        formatFoodPreference(data.food_preference);


    resultSection.hidden = false;


    resultCard.innerHTML = `
        <div class="result-warning">

            <div class="result-icon">
                !
            </div>

            <h2>Already Received</h2>

            <p>
                This participant has already received food.
            </p>

            <div class="participant-details">

                <div class="detail-row">
                    <span class="detail-label">
                        Name
                    </span>

                    <span class="detail-value">
                        ${escapeHTML(name)}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">
                        Registration ID
                    </span>

                    <span class="detail-value">
                        ${escapeHTML(registrationId)}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">
                        Food Preference
                    </span>

                    <span class="detail-value food-preference">
                        ${escapeHTML(foodPreference)}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">
                        Status
                    </span>

                    <span class="detail-value">
                        Already Received
                    </span>
                </div>

            </div>

        </div>
    `;

    resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ============================================================
// DISPLAY INVALID REGISTRATION
// ============================================================

function displayInvalid(registrationId) {

    resultSection.hidden = false;


    resultCard.innerHTML = `
        <div class="result-error">

            <div class="result-icon">
                ✕
            </div>

            <h2>Invalid Registration</h2>

            <p>
                No participant was found for this QR code.
            </p>

            <div class="invalid-id">
                ${escapeHTML(registrationId)}
            </div>

        </div>
    `;

    resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ============================================================
// DISPLAY DATABASE ERROR
// ============================================================

function displayDatabaseError() {

    resultSection.hidden = false;


    resultCard.innerHTML = `
        <div class="result-error">

            <div class="result-icon">
                ✕
            </div>

            <h2>Verification Error</h2>

            <p>
                Unable to verify this participant.
                Please check the internet connection
                and try again.
            </p>

        </div>
    `;

    resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ============================================================
// MARK FOOD AS RECEIVED
// ============================================================

async function markFoodReceived(participant) {

    await updateDoc(
        participant.ref,
        {
            food_received: "yes",
            food_received_at: serverTimestamp()
        }
    );
}


// ============================================================
// PROCESS SCANNED QR
// ============================================================

async function processQRCode(decodedText) {

    if (processingScan) {
        return;
    }

    processingScan = true;


    try {

        // ----------------------------------------------------
        // Extract registration ID
        // ----------------------------------------------------

        const registrationId =
            extractRegistrationId(decodedText);


        if (!registrationId) {

            displayInvalid("");

            return;
        }


        // ----------------------------------------------------
        // Stop scanner while processing
        // ----------------------------------------------------

        await stopScanner();


        scannerStatus.textContent =
            "Verifying participant...";


        // ----------------------------------------------------
        // Search Firestore
        // ----------------------------------------------------

        const participant =
            await findParticipant(registrationId);


        if (!participant) {

            displayInvalid(registrationId);

            scannerStatus.textContent =
                "Participant not found.";

            return;
        }


        const data =
            participant.data;


        // ----------------------------------------------------
        // Check whether food was already received
        // ----------------------------------------------------

        if (isFoodReceived(data.food_received)) {

            displayAlreadyReceived(participant);

            scannerStatus.textContent =
                "Food was already received.";

            return;
        }


        // ----------------------------------------------------
        // Mark food as received
        // ----------------------------------------------------

        await markFoodReceived(participant);


        // ----------------------------------------------------
        // Update local data so display is consistent
        // ----------------------------------------------------

        participant.data.food_received = "yes";


        // ----------------------------------------------------
        // Display success
        // ----------------------------------------------------

        displayParticipant(participant);


        scannerStatus.textContent =
            "Food successfully verified.";


    } catch (error) {

        console.error(
            "QR processing error:",
            error
        );

        displayDatabaseError();

        scannerStatus.textContent =
            "Verification failed.";


    } finally {

        processingScan = false;
    }
}


// ============================================================
// QR SCAN SUCCESS CALLBACK
// ============================================================

function onScanSuccess(decodedText, decodedResult) {

    if (processingScan) {
        return;
    }

    console.log(
        "QR detected:",
        decodedText
    );

    processQRCode(decodedText);
}


// ============================================================
// QR SCAN ERROR CALLBACK
// ============================================================

function onScanError(errorMessage) {

    // html5-qrcode continuously reports
    // "QR code not found" while searching.
    //
    // Do not display these messages to the user.
}


// ============================================================
// START CAMERA + SCANNER
// ============================================================

async function startScanner() {

    if (scanning) {
        return;
    }


    try {

        scannerStatus.textContent =
            "Requesting camera permission...";


        // ====================================================
        // STEP 1
        // Explicitly request camera permission
        // ====================================================
        //
        // This is important because some browsers will not
        // show the permission prompt simply because a QR
        // scanner object was created.
        //
        // ====================================================

        let temporaryStream = null;


        try {

            temporaryStream =
                await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });


        } finally {

            if (temporaryStream) {

                temporaryStream
                    .getTracks()
                    .forEach(track => track.stop());

            }
        }


        // ====================================================
        // STEP 2
        // Create html5-qrcode scanner
        // ====================================================

        scanner =
            new Html5Qrcode("reader");


        // ====================================================
        // STEP 3
        // Find available cameras
        // ====================================================

        scannerStatus.textContent =
            "Finding camera...";


        const cameras =
            await Html5Qrcode.getCameras();


        if (!cameras || cameras.length === 0) {

            throw new Error(
                "No camera was found."
            );
        }


        // ====================================================
        // STEP 4
        // Prefer rear camera
        // ====================================================

        let selectedCamera =
            cameras[0];


        const rearCamera =
            cameras.find(camera =>
                /back|rear|environment/i
                    .test(camera.label || "")
            );


        if (rearCamera) {
            selectedCamera = rearCamera;
        }


        console.log(
            "Selected camera:",
            selectedCamera
        );


        // ====================================================
        // STEP 5
        // Scanner configuration
        // ====================================================

        const scannerConfig = {

            fps: 10,

            qrbox: function (
                viewfinderWidth,
                viewfinderHeight
            ) {

                const minDimension =
                    Math.min(
                        viewfinderWidth,
                        viewfinderHeight
                    );

                return {
                    width: Math.floor(
                        minDimension * 0.70
                    ),
                    height: Math.floor(
                        minDimension * 0.70
                    )
                };
            },

            aspectRatio: 1.0,

            rememberLastUsedCamera: true

        };


        // ====================================================
        // STEP 6
        // Start scanner
        // ====================================================

        scannerStatus.textContent =
            "Starting camera...";


        await scanner.start(
            selectedCamera.id,
            scannerConfig,
            onScanSuccess,
            onScanError
        );


        scanning = true;


        scannerStatus.textContent =
            "Camera ready — scan participant QR";


        console.log(
            "QR scanner started successfully."
        );


    } catch (error) {

        console.error(
            "Camera initialization error:",
            error
        );


        scanning = false;


        let message =
            "Unable to access the camera.";


        if (
            error &&
            error.name === "NotAllowedError"
        ) {

            message =
                "Camera permission was denied. Please allow camera access in your browser settings.";

        } else if (
            error &&
            error.name === "NotFoundError"
        ) {

            message =
                "No camera was found on this device.";

        } else if (
            error &&
            error.name === "NotReadableError"
        ) {

            message =
                "The camera is already being used by another application.";

        } else if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            message =
                "Camera access is unavailable. Please open this page using HTTPS or localhost.";

        }


        scannerStatus.textContent =
            message;
    }
}


// ============================================================
// SCAN AGAIN BUTTON
// ============================================================

if (scanAgainButton) {

    scanAgainButton.addEventListener(
        "click",
        async () => {

            // Hide previous result
            resultSection.hidden = true;

            resultCard.innerHTML = "";

            scannerStatus.textContent =
                "Preparing camera...";


            // Reset state
            processingScan = false;


            // If an old scanner exists, clean it up
            if (scanner) {

                try {

                    if (scanning) {
                        await scanner.stop();
                    }

                } catch (error) {

                    console.warn(
                        "Scanner cleanup warning:",
                        error
                    );

                }

                scanner = null;
                scanning = false;
            }


            // Start again
            await startScanner();
        }
    );
}


// ============================================================
// CLEAN UP CAMERA WHEN LEAVING PAGE
// ============================================================

window.addEventListener(
    "beforeunload",
    async () => {

        if (scanner && scanning) {

            try {
                await scanner.stop();
            } catch (error) {
                console.warn(error);
            }

        }
    }
);


// ============================================================
// INITIALIZE
// ============================================================

if (!reader) {

    console.error(
        'QR reader element "#reader" was not found.'
    );

} else {

    startScanner();

}
