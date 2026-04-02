import { createAnalysisController } from "./analysis.js";

document.addEventListener("DOMContentLoaded", () => {
    const audioInput = document.getElementById("audio-file");
    if (!audioInput) return;

    const controller = createAnalysisController({
        fileStatus: document.getElementById("file-status"),
        metaName: document.getElementById("meta-name"),
        metaDuration: document.getElementById("meta-duration"),
        metaSampleRate: document.getElementById("meta-samplerate"),
        metaChannels: document.getElementById("meta-channels"),

        processButton: document.getElementById("process-audio-btn"),
        updateViewButton: document.getElementById("update-view-btn"),
        updateFftButton: document.getElementById("update-fft-btn"),

        viewStartInput: document.getElementById("view-start"),
        viewWindowInput: document.getElementById("view-window"),
        viewSlider: document.getElementById("view-slider"),

        fftMaxFrequencyInput: document.getElementById("fft-max-frequency"),
        dominantPeaksOutput: document.getElementById("dominant-peaks-output"),

        bandLow: document.getElementById("band-low"),
        bandMid: document.getElementById("band-mid"),
        bandHigh: document.getElementById("band-high"),
        interpretationOutput: document.getElementById("interpretation-output"),

        bandCardLow: document.getElementById("band-card-low"),
        bandCardMid: document.getElementById("band-card-mid"),
        bandCardHigh: document.getElementById("band-card-high"),

        waveformCanvas: document.getElementById("waveform-canvas"),
        fftCanvas: document.getElementById("fft-canvas")
    });

    audioInput.addEventListener("change", async () => {
        const file = audioInput.files[0];
        await controller.handleAudioChange(file);
    });

    document.getElementById("process-audio-btn")
        .addEventListener("click", controller.processAudio);

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

    window.addEventListener("resize", controller.handleResize);

    controller.initializeEmptyState();
});