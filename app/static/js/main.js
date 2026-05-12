import { createAnalysisController } from "./analysis.js";
import { initDopplerSimulation } from "./doppler-simulation.js";
import { initSynthesisPage } from "./synthesis.js";
import { initOpticsPage } from "./optics.js";

document.addEventListener("DOMContentLoaded", () => {
    initSynthesisPage();
    initAnalysisPage();
    initDopplerSimulation();
    initOpticsPage();
});

function initAnalysisPage() {
    const audioInput = document.getElementById("audio-file");
    if (!audioInput) return;

    const requiredElements = {
        fileStatus: document.getElementById("file-status"),
        metaName: document.getElementById("meta-name"),
        metaDuration: document.getElementById("meta-duration"),
        metaSampleRate: document.getElementById("meta-samplerate"),
        metaChannels: document.getElementById("meta-channels"),
        viewStartInput: document.getElementById("view-start"),
        viewWindowInput: document.getElementById("view-window"),
        viewSlider: document.getElementById("view-slider"),
        fftMaxFrequencyInput: document.getElementById("fft-max-frequency"),
        dominantPeaksOutput: document.getElementById("dominant-peaks-output"),
        bandLow: document.getElementById("band-low"),
        bandMid: document.getElementById("band-mid"),
        bandHigh: document.getElementById("band-high"),
        interpretationOutput: document.getElementById("interpretation-output"),
        analysisQualityOutput: document.getElementById("analysis-quality-output"),
        bandCardLow: document.getElementById("band-card-low"),
        bandCardMid: document.getElementById("band-card-mid"),
        bandCardHigh: document.getElementById("band-card-high"),
        waveformCanvas: document.getElementById("waveform-canvas"),
        fftCanvas: document.getElementById("fft-canvas"),
        spectrogramCanvas: document.getElementById("spectrogram-canvas"),
        spectrogramWindowSizeSelect: document.getElementById("spectrogram-window-size"),
        spectrogramStatusOutput: document.getElementById("spectrogram-status-output")
    };

    const missingElement = Object.entries(requiredElements).find(([, element]) => !element);
    if (missingElement) {
        console.warn(`AudioLab: falta el elemento requerido para análisis: ${missingElement[0]}`);
        return;
    }

    const controller = createAnalysisController(requiredElements);

    audioInput.addEventListener("change", async () => {
        const file = audioInput.files[0];
        await controller.handleAudioChange(file);
    });

    document.getElementById("process-audio-btn")
        .addEventListener("click", controller.processAudio);

    const loadSharedAudioButton = document.getElementById("load-shared-audio-btn");
    if (loadSharedAudioButton && controller.loadStoredAudio) {
        loadSharedAudioButton.addEventListener("click", controller.loadStoredAudio);
    }

    document.querySelectorAll("[data-analysis-preset]").forEach(button => {
        button.addEventListener("click", () => {
            const preset = button.dataset.analysisPreset;
            if (preset === "voice") {
                requiredElements.viewWindowInput.value = "4";
                requiredElements.fftMaxFrequencyInput.value = "4000";
                requiredElements.spectrogramWindowSizeSelect.value = "512";
            } else if (preset === "music") {
                requiredElements.viewWindowInput.value = "8";
                requiredElements.fftMaxFrequencyInput.value = "8000";
                requiredElements.spectrogramWindowSizeSelect.value = "1024";
            } else if (preset === "transient") {
                requiredElements.viewWindowInput.value = "2";
                requiredElements.fftMaxFrequencyInput.value = "6000";
                requiredElements.spectrogramWindowSizeSelect.value = "256";
            }
            controller.updateView();
        });
    });

    document.getElementById("update-view-btn")
        .addEventListener("click", controller.updateView);

    document.getElementById("update-fft-btn")
        .addEventListener("click", controller.updateFFT);

    document.getElementById("view-slider")
        .addEventListener("input", controller.handleSliderInput);

    document.getElementById("view-window")
        .addEventListener("change", controller.handleViewWindowChange);

    document.getElementById("view-start")
        .addEventListener("change", controller.handleViewStartChange);

    document.getElementById("fft-max-frequency")
        .addEventListener("change", controller.handleMaxFrequencyChange);

    document.getElementById("spectrogram-window-size")
        .addEventListener("change", controller.handleSpectrogramWindowChange);

    window.addEventListener("resize", controller.handleResize);

    controller.initializeEmptyState();
}