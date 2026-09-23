// ============================================================
// SYMMETRY 2026
// QR FOOD RECEIVED VERIFICATION SYSTEM
// ============================================================
// Backend: Firebase Firestore
//
// Participant lookup:
//     registration_id
//
// Food preference:
//     food_preference
//
// Food verification:
//     food_received = "yes"
//     food_received_at = serverTimestamp()
//
// QR Library:
//     html5-qrcode 2.3.8
//
// IMPORTANT:
// html5-qrcode is loaded in HTML using:
//
// <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
//
// Therefore DO NOT import Html5Qrcode in this file.
// ============================================================


// ============================================================
// FIREBASE IMPORTS
// ============================================================

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
// HTML ESCAPE
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
// FOOD PREFERENCE FORMATTER
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


    if (
        preference === "veg" ||
        preference === "vegetarian"
    ) {
        return "VEG";
    }


    if (
        preference === "non-veg" ||
        preference === "nonveg" ||
        preference === "non vegetarian" ||
        preference === "non-vegetarian"
    ) {
        return "NON-VEG";
    }


    return String(value)
        .trim()
        .toUpperCase();
}


// ============================================================
// CHECK FOOD RECEIVED STATUS
// ============================================================

function isFoodReceived(value) {

    if (value === true) {
        return true;
    }

    if (typeof value === "string") {

        return value
            .trim()
            .toLowerCase() === "yes";
    }

    return false;
}


// ============================================================
// EXTRACT REGISTRATION ID FROM QR
// ============================================================
//
// Supported QR formats:
//
// 1. Plain registration ID
//
//    SYM26-MTYM771D
//
// 2. JSON
//
//    {
//        "registration_id": "SYM26-MTYM771D"
//    }
//
// 3. JSON using participantID
//
//    {
//        "participantID": "SYM26-MTYM771D"
//    }
//
// 4. URL
//
//    https://example.com/?registration_id=SYM26-MTYM771D
//
// 5. URL
//
//    https://example.com/?participant_id=SYM26-MTYM771D
//
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
    // TRY JSON
    // --------------------------------------------------------

    try {

        const parsed = JSON.parse(raw);

        if (
            parsed &&
            typeof parsed === "object"
        ) {

            if (parsed.registration_id) {
                return String(
                    parsed.registration_id
                ).trim();
            }

            if (parsed.registrationId) {
                return String(
                    parsed.registrationId
                ).trim();
            }

            if (parsed.participantID) {
                return String(
                    parsed.participantID
                ).trim();
            }

            if (parsed.participant_id) {
                return String(
                    parsed.participant_id
                ).trim();
            }
        }

    } catch (error) {

        // QR is not JSON.
    }


    // --------------------------------------------------------
    // TRY URL
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

        // QR is not a URL.
    }


    // --------------------------------------------------------
    // OTHERWISE TREAT IT AS PLAIN REGISTRATION ID
    // --------------------------------------------------------

    return raw;
}


// ============================================================
// FIND PARTICIPANT IN FIRESTORE
// ============================================================

async function findParticipant(registrationId) {

    const participantsRef =
        collection(
            db,
            PARTICIPANT_COLLECTION
        );


    const participantQuery = query(
        participantsRef,

        where(
            "registration_id",
            "==",
            registrationId
        ),

        limit(1)
    );


    const snapshot =
        await getDocs(participantQuery);


    if (snapshot.empty) {

        return null;
    }


    const participantDoc =
        snapshot.docs[0];


    return {

        id: participantDoc.id,

        ref: participantDoc.ref,

        data: participantDoc.data()

    };
}


// ============================================================
// STOP SCANNER
// ============================================================

async function stopScanner() {

    if (
        !scanner ||
        !scanning
    ) {
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
// DISPLAY SUCCESS — simplified to show only Veg/Non-Veg
// ============================================================

function displayParticipant(participant) {

    const data =
        participant.data;

    const foodPreference =
        formatFoodPreference(
            data.food_preference
        );

    const isVeg =
        foodPreference === "VEG";


    resultSection.hidden = false;


    resultCard.innerHTML = `

        <div class="result-success">

            <div class="result-icon">
                ✓
            </div>

            <h2>
                Food Verified
            </h2>


            <div class="food-preference-display ${isVeg ? "pref-veg" : "pref-nonveg"}">
                ${escapeHTML(foodPreference)}
            </div>


        </div>
    `;


    resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ============================================================
// DISPLAY ALREADY RECEIVED — simplified to show only Veg/Non-Veg
// ============================================================

function displayAlreadyReceived(participant) {

    const data =
        participant.data;

    const foodPreference =
        formatFoodPreference(
            data.food_preference
        );

    const isVeg =
        foodPreference === "VEG";


    resultSection.hidden = false;


    resultCard.innerHTML = `

        <div class="result-warning">

            <div class="result-icon">
                !
            </div>

            <h2>
                Already Received
            </h2>

            <p>
                This participant has already received food.
            </p>


            <div class="food-preference-display ${isVeg ? "pref-veg" : "pref-nonveg"}">
                ${escapeHTML(foodPreference)}
            </div>


        </div>
    `;


    resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ============================================================
// DISPLAY INVALID QR
// ============================================================

function displayInvalid(registrationId) {

    resultSection.hidden = false;


    resultCard.innerHTML = `

        <div class="result-error">

            <div class="result-icon">
                ✕
            </div>

            <h2>
                Invalid Registration
            </h2>

            <p>
                No participant was found for this QR code.
            </p>


            ${
                registrationId
                    ? `
                        <div class="invalid-id">
                            ${escapeHTML(registrationId)}
                        </div>
                    `
                    : ""
            }

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

            <h2>
                Verification Error
            </h2>

            <p>
                Unable to verify this participant.
                Please check your internet connection
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

            food_received_at:
                serverTimestamp()

        }
    );
}


// ============================================================
// PROCESS QR CODE
// ============================================================

async function processQRCode(decodedText) {

    if (processingScan) {
        return;
    }


    processingScan = true;


    try {

        // ----------------------------------------------------
        // EXTRACT REGISTRATION ID
        // ----------------------------------------------------

        const registrationId =
            extractRegistrationId(
                decodedText
            );


        if (!registrationId) {

            displayInvalid("");

            return;
        }


        // ----------------------------------------------------
        // STOP CAMERA WHILE PROCESSING
        // ----------------------------------------------------

        await stopScanner();


        scannerStatus.textContent =
            "Verifying participant...";


        // ----------------------------------------------------
        // FIND PARTICIPANT
        // ----------------------------------------------------

        const participant =
            await findParticipant(
                registrationId
            );


        if (!participant) {

            displayInvalid(
                registrationId
            );

            scannerStatus.textContent =
                "Participant not found.";

            return;
        }


        const data =
            participant.data;


        // ----------------------------------------------------
        // CHECK FOOD RECEIVED
        // ----------------------------------------------------

        if (
            isFoodReceived(
                data.food_received
            )
        ) {

            displayAlreadyReceived(
                participant
            );

            scannerStatus.textContent =
                "Food was already received.";

            return;
        }


        // ----------------------------------------------------
        // MARK FOOD RECEIVED
        // ----------------------------------------------------

        await markFoodReceived(
            participant
        );


        // Update local copy
        participant.data.food_received =
            "yes";


        // ----------------------------------------------------
        // DISPLAY SUCCESS
        // ----------------------------------------------------

        displayParticipant(
            participant
        );


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
// QR SCAN SUCCESS
// ============================================================

function onScanSuccess(
    decodedText,
    decodedResult
) {

    if (processingScan) {
        return;
    }


    console.log(
        "QR detected:",
        decodedText
    );


    processQRCode(
        decodedText
    );
}


// ============================================================
// QR SCAN ERROR
// ============================================================

function onScanError(errorMessage) {

    // html5-qrcode continuously calls this function
    // while searching for a QR code.
    //
    // Therefore we intentionally do not display
    // these messages to the user.
}


// ============================================================
// START SCANNER
// ============================================================

async function startScanner() {

    if (scanning) {
        return;
    }


    try {

        // ----------------------------------------------------
        // CHECK BROWSER SUPPORT
        // ----------------------------------------------------

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Camera API is not available."
            );
        }


        // ----------------------------------------------------
        // CHECK HTTPS
        // ----------------------------------------------------

        if (
            location.protocol !== "https:" &&
            location.hostname !== "localhost" &&
            location.hostname !== "127.0.0.1"
        ) {

            throw new Error(
                "Camera requires HTTPS or localhost."
            );
        }


        // ----------------------------------------------------
        // CHECK HTML5-QRCODE LIBRARY
        // ----------------------------------------------------

        if (
            typeof Html5Qrcode ===
            "undefined"
        ) {

            throw new Error(
                "html5-qrcode library was not loaded."
            );
        }


        scannerStatus.textContent =
            "Requesting camera permission...";


        // ----------------------------------------------------
        // EXPLICIT CAMERA PERMISSION REQUEST
        // ----------------------------------------------------

        let temporaryStream = null;


        try {

            temporaryStream =
                await navigator.mediaDevices
                    .getUserMedia({

                        video: true,

                        audio: false

                    });


        } finally {

            if (temporaryStream) {

                temporaryStream
                    .getTracks()
                    .forEach(
                        track => track.stop()
                    );
            }
        }


        // ----------------------------------------------------
        // CREATE QR SCANNER
        // ----------------------------------------------------

        scanner =
            new Html5Qrcode(
                "reader"
            );


        // ----------------------------------------------------
        // GET AVAILABLE CAMERAS
        // ----------------------------------------------------

        scannerStatus.textContent =
            "Finding camera...";


        const cameras =
            await Html5Qrcode.getCameras();


        if (
            !cameras ||
            cameras.length === 0
        ) {

            throw new Error(
                "No camera found."
            );
        }


        console.log(
            "Available cameras:",
            cameras
        );


        // ----------------------------------------------------
        // SELECT REAR CAMERA
        // ----------------------------------------------------

        let selectedCamera =
            cameras[0];


        const rearCamera =
            cameras.find(
                camera =>
                    /back|rear|environment/i
                        .test(
                            camera.label || ""
                        )
            );


        if (rearCamera) {

            selectedCamera =
                rearCamera;
        }


        console.log(
            "Selected camera:",
            selectedCamera
        );


        // ----------------------------------------------------
        // SCANNER CONFIGURATION
        // ----------------------------------------------------

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


                const boxSize =
                    Math.floor(
                        minDimension * 0.70
                    );


                return {

                    width: boxSize,

                    height: boxSize

                };
            },


            aspectRatio: 1.0,

            rememberLastUsedCamera: true

        };


        // ----------------------------------------------------
        // START SCANNER
        // ----------------------------------------------------

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
            error.name ===
            "NotAllowedError"
        ) {

            message =
                "Camera permission was denied. Please allow camera access in your browser settings.";

        } else if (
            error &&
            error.name ===
            "NotFoundError"
        ) {

            message =
                "No camera was found on this device.";

        } else if (
            error &&
            error.name ===
            "NotReadableError"
        ) {

            message =
                "The camera is already being used by another application.";

        } else if (
            error &&
            error.message ===
            "Camera requires HTTPS or
