// app.js
// ProtoTimer Plus - Dynamic TRT and Break Logic

// --- A. State Variables ---
let totalRunTimeMs = 0;
let contentTimeMs = 0;
let breakDurationMs = 0;
let breakCount = 0;

let trtInterval = null;
let breakInterval = null;

let isRunning = false;
let currentTrtElapsedMs = 0; // TRT Elapsed time (always counts up)
let nextBreakTrtStartMs = 0;
let currentBreakIndex = 0;
let isBreakActive = false; // Flag to control the break timer display
let lastUpdateTime = 0;

// --- Utility Functions ---

/** Converts M:SS string to milliseconds. */
function timeToMs(timeStr) {
    if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        const minutes = parseInt(parts[0]) || 0;
        const seconds = parseInt(parts[1]) || 0;
        return (minutes * 60 + seconds) * 1000;
    }
    // Fallback for whole minutes (e.g., '5')
    return (parseFloat(timeStr) * 60 * 1000) || 0;
}

/** Formats milliseconds into MM:SS string. */
function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Updates the status message in the control panel. */
function updateStatus(message, colorClass = 'text-yellow-400') {
    document.getElementById('status-message').innerHTML = `Status: <span class="${colorClass}">${message}</span>`;
}


// --- B. Core Functions ---

function parseInputsAndCalculate() {
    // 1. Get DOM element values and convert
    totalRunTimeMs = timeToMs(document.getElementById('trt-input').value);
    breakDurationMs = timeToMs(document.getElementById('break-duration-input').value);
    breakCount = parseInt(document.getElementById('break-count-input').value) || 0;

    // 2. Calculate content time and reset state
    // Total content time is TRT minus all scheduled break durations
    contentTimeMs = totalRunTimeMs - (breakCount * breakDurationMs);
    currentTrtElapsedMs = 0;
    currentBreakIndex = 0;
    
    // 3. Set the first break trigger point (time into content)
    if (breakCount > 0 && contentTimeMs > 0) {
        // Content time is split into (breakCount + 1) segments
        const segmentDuration = contentTimeMs / (breakCount + 1);
        nextBreakTrtStartMs = segmentDuration;
    } else {
        nextBreakTrtStartMs = totalRunTimeMs + 1; // Effectively disables auto-trigger
    }

    // 4. Update Display
    document.getElementById('trt-timer-value').textContent = formatTime(totalRunTimeMs);
    document.getElementById('content-remaining').textContent = formatTime(contentTimeMs);
    document.getElementById('breaks-remaining').textContent = breakCount;
    updateStatus('Rundown Prepared.', 'text-indigo-400');
}

function resetApp() {
    // Stop and clear all intervals
    if (trtInterval) clearInterval(trtInterval);
    if (breakInterval) clearInterval(breakInterval);
    isRunning = false;
    isBreakActive = false;
    
    // Hide the break timer overlay
    document.getElementById('break-timer-container').classList.remove('active');
    
    // Recalculate and reset all state variables
    parseInputsAndCalculate(); 
    document.getElementById('trt-timer-value').textContent = formatTime(totalRunTimeMs);
    document.getElementById('clock-status').textContent = formatTime(0);
}

function triggerBreak() {
    // Prevent starting a break if one is already running or all breaks are used
    if (isBreakActive || currentBreakIndex >= breakCount || !isRunning) {
        updateStatus(
            isBreakActive ? 'Break already active.' : (currentBreakIndex >= breakCount ? 'No breaks left.' : 'TRT not running.'), 
            isBreakActive ? 'text-red-500' : 'text-yellow-400'
        );
        return;
    }

    // 1. TRT timer is NOT PAUSED. It continues running in the background.
    isBreakActive = true;
    updateStatus(`Break ${currentBreakIndex + 1} of ${breakCount} started!`, 'text-red-500');

    // 2. Show Break Timer and initialize value
    let breakRemainingMs = breakDurationMs;
    document.getElementById('break-timer-value').textContent = formatTime(breakRemainingMs);
    document.getElementById('break-timer-container').classList.add('active');

    // 3. Recalculate and set the NEXT break start time
    currentBreakIndex++; 

    if (currentBreakIndex < breakCount && contentTimeMs > 0) {
        // FIX: Correctly calculate the number of remaining content segments
        const totalSegments = breakCount + 1;
        const remainingContentSegments = totalSegments - currentBreakIndex;
        
        // Content time consumed so far (excluding breaks)
        const contentConsumedMs = currentTrtElapsedMs - ((currentBreakIndex - 1) * breakDurationMs);
        const remainingContentTime = contentTimeMs - contentConsumedMs;
        
        // Calculate the new, equal duration for the remaining content segments
        const newSegmentDuration = remainingContentTime / remainingContentSegments;
        
        // The NEXT break is scheduled to start at the CURRENT TRT time plus the duration of the next content segment.
        nextBreakTrtStartMs = currentTrtElapsedMs + newSegmentDuration;
        
        console.log(`[Dynamic TRT] Next break (${currentBreakIndex + 1}) scheduled at TRT: ${formatTime(nextBreakTrtStartMs)}`);

    } else {
        // Last break (or only break) was just triggered. No more breaks to schedule.
        nextBreakTrtStartMs = totalRunTimeMs + 1;
    }

    // 4. Start Break Countdown
    lastUpdateTime = Date.now();
    breakInterval = setInterval(() => {
        const now = Date.now();
        const delta = now - lastUpdateTime;
        lastUpdateTime = now;

        breakRemainingMs -= delta;
        document.getElementById('break-timer-value').textContent = formatTime(breakRemainingMs);

        if (breakRemainingMs <= 0) {
            clearInterval(breakInterval);
            isBreakActive = false;
            document.getElementById('break-timer-container').classList.remove('active');
            updateStatus('Break finished. Resuming TRT countdown.', 'text-green-400');
            
            // 5. Update UI info panel
            document.getElementById('breaks-remaining').textContent = breakCount - currentBreakIndex;
            
            // Since startTrtTimer is running continuously, we don't need to restart it.
        }
    }, 100);
}

function startTrtTimer() {
    if (isRunning) return;
    isRunning = true;
    lastUpdateTime = Date.now();
    updateStatus('TRT Countdown Active.', 'text-green-400');

    trtInterval = setInterval(() => {
        // TRT timer runs continuously, regardless of whether a break is active.

        const now = Date.now();
        const delta = now - lastUpdateTime;
        lastUpdateTime = now;

        currentTrtElapsedMs += delta; // Always increment currentTrtElapsedMs
        
        // TRT Countdown Value (Remaining Time)
        let trtRemainingMs = totalRunTimeMs - currentTrtElapsedMs;
        
        // Check for End of Show
        if (trtRemainingMs <= 0) {
            clearInterval(trtInterval);
            isRunning = false;
            currentTrtElapsedMs = totalRunTimeMs;
            trtRemainingMs = 0;
            updateStatus('Show Finished. TRT completed!', 'text-green-500');
        }

        // Check for Auto-Trigger Break 
        if (currentTrtElapsedMs >= nextBreakTrtStartMs && currentBreakIndex < breakCount && !isBreakActive) {
            triggerBreak(); // Trigger the break based on time!
        }
        
        // Update TRT Display
        document.getElementById('trt-timer-value').textContent = formatTime(trtRemainingMs);
        document.getElementById('clock-status').textContent = formatTime(currentTrtElapsedMs);
        
    }, 100); // Check every 100ms
}


// --- C. Event Listeners (Setup on Load) ---
window.onload = () => {
    // 1. Initial setup
    parseInputsAndCalculate(); 
    
    // 2. Button Handlers
    document.getElementById('start-trt-button').addEventListener('click', startTrtTimer);
    document.getElementById('trigger-break-button').addEventListener('click', triggerBreak);
    document.getElementById('reset-button').addEventListener('click', resetApp);
    
    // 3. Input Handlers (re-calculate whenever settings change)
    const inputs = ['trt-input', 'break-count-input', 'break-duration-input'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        // Reset when the user leaves the field or changes the value
        input.addEventListener('blur', resetApp);
        input.addEventListener('change', resetApp);
    });
};