 // ============================================================
// SYMMETRY 2026
// QR FOOD RECEIVED VERIFICATION SYSTEM
// ============================================================
// Backend: Firebase Firestore
// Lookup key: registration_id
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
    if (value === null || value === undefined) return "";

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
    if (value === null || value === undefined || String(value).trim() === "") {
        return "Not specified";
    }

    const preference = String(value).trim().toLowerCase();

    if (preference === "veg" || preference === "vegetarian") {
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

    return String(value).trim().toUpperCase();
}


// ============================================================
// CHECK FOOD RECEIVED STATUS
// ============================================================

function isFoodReceived(value) {
    if (value === true || value === 1) return true;

    if (typeof value === "string") {
        return value.trim().toLowerCase() === "yes";
    }

    return false;
}


// ============================================================
// EXTRACT REGISTRATION ID FROM QR
// ============================================================

function extractRegistrationId(decodedText) {
    if (!decodedText) return null;

    const raw = String(decodedText).trim();
    if (!raw) return null;

    if (raw.toUpperCase().startsWith("SYM26-")) {
        return raw;
    }

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            if (parsed.registration_id) return String(parsed.registration_id).trim();
            if (parsed.registrationId) return String(parsed.registrationId).trim();
            if (parsed.participantID) return String(parsed.participantID).trim();
            if (parsed.participant_id) return String(parsed.participant_id).trim();
        }
    } catch (error) {
        // Not JSON
    }

    try {
        const url = new URL(raw);
        const registrationId =
            url.searchParams.get("registration_id") ||
            url.searchParams.get("registrationId") ||
            url.searchParams.get("participant_id") ||
            url.searchParams.get("participantID");

        if (registrationId) return registrationId.trim();
    } catch (error) {
        // Not a URL
    }

    return raw;
}


// ============================================================
// FIND PARTICIPANT IN FIRESTORE
// ============================================================

async function findParticipant(registrationId) {
    const participantsRef = collection(db, PARTICIPANT_COLLECTION);
    const participantQuery = query(
        participantsRef,
        where("registration_id", "==", registrationId),
        limit(1)
    );

    const snapshot = await getDocs(participantQuery);

    if (snapshot.empty) return null;

    const participantDoc = snapshot.docs[0];

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
    if (!scanner) {
        scanning = false;
        return;
    }

    try {
        if (scanning) await scanner.stop();
    } catch (error) {
        console.warn("Scanner stop warning:", error);
    }

    try {
        scanner.clear();
    } catch (error) {
        console.warn("Scanner clear warning:", error);
    }

    scanner = null;
    scanning = false;
}


// ============================================================
// DISPLAY SUCCESS
// ============================================================

function displayParticipant(participant) {
    const data = participant.data;
    const name = data.name || data.full_name || data.fullName || "Participant";
    const registrationId = data.registration_id || "N/A";
    const foodPreference = formatFoodPreference(data.food_preference);

    resultSection.classList.remove("hidden");
    scanAgainButton.classList.remove("hidden");

    resultCard.innerHTML = `
        <div class="result-success">
            <div class="result-icon">✓</div>
            <h2>Food Verified</h2>
            <div class="participant-details">
                <div class="detail-row">
                    <span class="detail-label">Name</span>
                    <span class="detail-value">${escapeHTML(name)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Registration ID</span>
                    <span class="detail-value">${escapeHTML(registrationId)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Food Preference</span>
                    <span class="detail-value food-preference">${escapeHTML(foodPreference)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">Food Received</span>
                </div>
            </div>
        </div>
    `;

    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}


// ============================================================
// DISPLAY ALREADY RECEIVED
// ============================================================

function displayAlreadyReceived(participant) {
    const data = participant.data;
    const name = data.name || data.full_name || data.fullName || "Participant";
    const registrationId = data.registration_id || "N/A";
    const foodPreference = formatFoodPreference(data.food_preference);

    resultSection.classList.remove("hidden");
    scanAgainButton.classList.remove("hidden");

    resultCard.innerHTML = `
        <div class="result-warning">
            <div class="result-icon">!</div>
            <h2>Already Received</h2>
            <p>This participant has already received food.</p>
            <div class="participant-details">
                <div class="detail-row">
                    <span class="detail-label">Name</span>
                    <span class="detail-value">${escapeHTML(name)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Registration ID</span>
                    <span class="detail-value">${escapeHTML(registrationId)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Food Preference</span>
                    <span class="detail-value food-preference">${escapeHTML(foodPreference)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">Already Received</span>
                </div>
            </div>
        </div>
    `;

    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}


// ============================================================
// DISPLAY INVALID QR
// ============================================================

function displayInvalid(registrationId) {
    resultSection.classList.remove("hidden");
    scanAgainButton.classList.remove("hidden");

    resultCard.innerHTML = `
        <div class="result-error">
            <div class="result-icon">✕</div>
            <h2>Invalid Registration</h2>
            <p>No participant was found for this QR code.</p>
            ${registrationId ? `<div class="invalid-id">${escapeHTML(registrationId)}</div>` : ""}
        </div>
    `;

    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}


// ============================================================
// DISPLAY DATABASE ERROR
// ============================================================

function displayDatabaseError() {
    resultSection.classList.remove("hidden");
    scanAgainButton.classList.remove("hidden");

    resultCard.innerHTML = `
        <div class="result-error">
            <div class="result-icon">✕</div>
            <h2>Verification Error</h2>
            <p>Unable to verify this participant. Please check your internet connection and try again.</p>
        </div>
    `;

    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}


// ============================================================
// MARK FOOD AS RECEIVED
// ============================================================

async function markFoodReceived(participant) {
    await updateDoc(participant.ref, {
        food_received: "yes",
        food_received_at: serverTimestamp()
    });
}


// ============================================================
// PROCESS QR CODE
// ============================================================

async function processQRCode(decodedText) {
    if (processingScan) return;

    processingScan = true;

    try {
        const registrationId = extractRegistrationId(decodedText);

        if (!registrationId) {
            displayInvalid("");
            return;
        }

        await stopScanner();
        scannerStatus.textContent = "Verifying participant...";

        const participant = await findParticipant(registrationId);

        if (!participant) {
            displayInvalid(registrationId);
            scannerStatus.textContent = "Participant not found.";
            return;
        }

        const data = participant.data;

        if (isFoodReceived(data.food_received)) {
            displayAlreadyReceived(participant);
            scannerStatus.textContent = "Food was already received.";
            return;
        }

        await markFoodReceived(participant);

        participant.data.food_received = "yes";
        displayParticipant(participant);
        scannerStatus.textContent = "Food successfully verified.";

    } catch (error) {
        console.error("QR processing error:", error);
        displayDatabaseError();
        scannerStatus.textContent = "Verification failed.";
    } finally {
        processingScan = false;
    }
}


// ============================================================
// QR SCAN SUCCESS / ERROR
// ============================================================

function onScanSuccess(decodedText, decodedResult) {
    if (processingScan || !scanning) return;
    console.log("QR detected:", decodedText);
    processQRCode(decodedText);
}

function onScanError(errorMessage) {
    // Continuous polling errors ignored
}


// ============================================================
// START SCANNER
// ============================================================

async function startScanner() {
    scanning = false;
    processingScan = false;

    resultSection.classList.add("hidden");
    scanAgainButton.classList.add("hidden");
    resultCard.innerHTML = "";

    scannerStatus.textContent = "Requesting camera permission...";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        scannerStatus.innerHTML = "<strong>Camera API unavailable.</strong><br>Use HTTPS or localhost.";
        return;
    }

    if (typeof Html5Qrcode === "undefined") {
        scannerStatus.innerHTML = "<strong>html5-qrcode library failed to load.</strong>";
        return;
    }

    await stopScanner();

    let temporaryStream = null;

    try {
        temporaryStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });
    } catch (error) {
        console.error("Camera permission error:", error);
        scannerStatus.innerHTML = "<strong>Camera permission denied.</strong><br>Please enable camera access.";
        return;
    }

    if (temporaryStream) {
        temporaryStream.getTracks().forEach(track => track.stop());
    }

    try {
        scanner = new Html5Qrcode("reader");
    } catch (error) {
        console.error("Html5Qrcode init error:", error);
        scannerStatus.innerHTML = "<strong>QR scanner initialization failed.</strong>";
        return;
    }

    let cameras;

    try {
        cameras = await Html5Qrcode.getCameras();
    } catch (error) {
        console.error("Camera enumeration error:", error);
        scannerStatus.innerHTML = "<strong>Could not detect camera.</strong>";
        return;
    }

    if (!cameras || cameras.length === 0) {
        scannerStatus.innerHTML = "<strong>No camera detected.</strong>";
        return;
    }

    let selectedCamera = cameras[0];
    const rearCamera = cameras.find(camera => /back|rear|environment/i.test(camera.label || ""));
    if (rearCamera) selectedCamera = rearCamera;

    const scannerConfig = {
        fps: 10,
        qrbox: function (viewfinderWidth, viewfinderHeight) {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return { width: Math.floor(minEdge * 0.70), height: Math.floor(minEdge * 0.70) };
        },
        aspectRatio: 1.0
    };

    try {
        await scanner.start(
            selectedCamera.id,
            scannerConfig,
            onScanSuccess,
            onScanError
        );
        scanning = true;
        scannerStatus.textContent = "Camera ready — scan participant QR code";
    } catch (error) {
        console.error("Camera start error:", error);
        scanning = false;
        scannerStatus.innerHTML = "<strong>Camera could not be started.</strong>";
    }
}


// ============================================================
// SCAN AGAIN EVENT LISTENER
// ============================================================

scanAgainButton.addEventListener("click", async function () {
    await startScanner();
});


// ============================================================
// INITIALIZE
// ============================================================

startScanner();
