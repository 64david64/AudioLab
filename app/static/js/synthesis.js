import {
    resizeCanvasToDisplaySize,
    clearCanvas
} from "./audio-utils.js";

import { saveGeneratedAudioBuffer } from "./audio-store.js";

const SYNTH_SAMPLE_RATE = 44100;
const MAX_SPECTRUM_FREQUENCY = 5000;
const TWO_PI = Math.PI * 2;

export function initSynthesisPage() {
    const waveformCanvas = document.getElementById("synth-waveform-canvas");
    const spectrumCanvas = document.getElementById("synth-spectrum-canvas");

    if (!waveformCanvas || !spectrumCanvas) return;

    const elements = {
        waveTypeSelect: document.getElementById("synth-wave-type"),
        frequencyInput: document.getElementById("synth-frequency"),
        amplitudeInput: document.getElementById("synth-amplitude"),
        harmonic2Input: document.getElementById("synth-harmonic-2"),
        harmonic3Input: document.getElementById("synth-harmonic-3"),
        harmonic2Output: document.getElementById("synth-harmonic-2-output"),
        harmonic3Output: document.getElementById("synth-harmonic-3-output"),
        additiveControls: document.getElementById("additive-controls"),
        durationSelect: document.getElementById("synth-duration"),
        frequencyOutput: document.getElementById("synth-frequency-output"),
        amplitudeOutput: document.getElementById("synth-amplitude-output"),
        playButton: document.getElementById("synth-play-btn"),
        stopButton: document.getElementById("synth-stop-btn"),
        shareAnalysisButton: document.getElementById("synth-share-analysis-btn"),
        shareSimulationButton: document.getElementById("synth-share-simulation-btn"),
        statusOutput: document.getElementById("synth-status"),
        technicalOutput: document.getElementById("synth-technical-output"),
        perceptionOutput: document.getElementById("synth-perception-output"),
        cautionOutput: document.getElementById("synth-caution-output"),
        waveformCanvas,
        spectrumCanvas
    };

    const missingElement = Object.entries(elements).find(([, element]) => !element);
    if (missingElement) {
        console.warn(`AudioLab: falta el elemento requerido para síntesis: ${missingElement[0]}`);
        return;
    }

    const controller = createSynthesisController(elements);
    controller.initialize();
}

function createSynthesisController(elements) {
    const {
        waveTypeSelect,
        frequencyInput,
        amplitudeInput,
        harmonic2Input,
        harmonic3Input,
        harmonic2Output,
        harmonic3Output,
        additiveControls,
        durationSelect,
        frequencyOutput,
        amplitudeOutput,
        playButton,
        stopButton,
        shareAnalysisButton,
        shareSimulationButton,
        statusOutput,
        technicalOutput,
        perceptionOutput,
        cautionOutput,
        waveformCanvas,
        spectrumCanvas
    } = elements;

    const waveformCtx = waveformCanvas.getContext("2d");
    const spectrumCtx = spectrumCanvas.getContext("2d");
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    let audioContext = null;
    let activeNodes = [];
    let stopTimer = null;
    let isPlaying = false;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function getState() {
        return {
            waveType: waveTypeSelect.value,
            frequency: Number(frequencyInput.value) || 440,
            amplitude: (Number(amplitudeInput.value) || 0) / 100,
            harmonic2: (Number(harmonic2Input.value) || 0) / 100,
            harmonic3: (Number(harmonic3Input.value) || 0) / 100,
            duration: durationSelect.value
        };
    }

    function getWaveLabel(waveType) {
        const labels = {
            sine: "senoidal",
            square: "cuadrada",
            triangle: "triangular",
            sawtooth: "diente de sierra",
            additive: "suma de ondas"
        };
        return labels[waveType] || "senoidal";
    }

    function evaluateBaseWave(waveType, phase) {
        if (waveType === "square") {
            return Math.sin(phase) >= 0 ? 1 : -1;
        }

        if (waveType === "triangle") {
            return (2 / Math.PI) * Math.asin(Math.sin(phase));
        }

        if (waveType === "sawtooth") {
            const normalized = (phase / TWO_PI) % 1;
            return 2 * (normalized - Math.floor(normalized + 0.5));
        }

        return Math.sin(phase);
    }

    function evaluateSignalAtPhase(state, phase) {
        if (state.waveType !== "additive") {
            return evaluateBaseWave(state.waveType, phase);
        }

        const fundamental = Math.sin(phase);
        const harmonic2 = state.harmonic2 * Math.sin(phase * 2);
        const harmonic3 = state.harmonic3 * Math.sin(phase * 3);
        const normalizer = Math.max(1, 1 + state.harmonic2 + state.harmonic3);
        return (fundamental + harmonic2 + harmonic3) / normalizer;
    }

    function getHarmonics(waveType, frequency, amplitude, harmonic2 = 0, harmonic3 = 0) {
        const harmonics = [];
        const maxHarmonic = Math.max(1, Math.floor(MAX_SPECTRUM_FREQUENCY / frequency));

        if (waveType === "additive") {
            const components = [
                { order: 1, relative: 1 },
                { order: 2, relative: harmonic2 },
                { order: 3, relative: harmonic3 }
            ];

            components.forEach(component => {
                const componentFrequency = component.order * frequency;
                if (componentFrequency <= MAX_SPECTRUM_FREQUENCY && component.relative > 0.01) {
                    harmonics.push({
                        order: component.order,
                        frequency: componentFrequency,
                        magnitude: component.relative * amplitude
                    });
                }
            });

            return harmonics;
        }

        for (let n = 1; n <= maxHarmonic; n++) {
            let relative = 0;

            if (waveType === "sine") {
                relative = n === 1 ? 1 : 0;
            } else if (waveType === "square") {
                relative = n % 2 === 1 ? 1 / n : 0;
            } else if (waveType === "triangle") {
                relative = n % 2 === 1 ? 1 / (n * n) : 0;
            } else if (waveType === "sawtooth") {
                relative = 1 / n;
            }

            if (relative > 0.015) {
                harmonics.push({
                    order: n,
                    frequency: n * frequency,
                    magnitude: relative * amplitude
                });
            }
        }

        return harmonics;
    }

    function setStatus(message, type = "info") {
        statusOutput.classList.remove("info", "ok", "warning", "error");
        statusOutput.classList.add(type);
        statusOutput.textContent = message;
    }

    function drawWaveform() {
        const state = getState();
        const { width, height } = resizeCanvasToDisplaySize(waveformCanvas);
        clearCanvas(waveformCtx, waveformCanvas);

        const padding = { top: 24, right: 20, bottom: 42, left: 54 };
        const plotLeft = padding.left;
        const plotTop = padding.top;
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const plotBottom = plotTop + plotHeight;
        const middleY = plotTop + plotHeight / 2;

        waveformCtx.save();
        waveformCtx.strokeStyle = "#cbd5e1";
        waveformCtx.lineWidth = 1;
        waveformCtx.beginPath();
        waveformCtx.moveTo(plotLeft, middleY);
        waveformCtx.lineTo(plotLeft + plotWidth, middleY);
        waveformCtx.stroke();

        waveformCtx.beginPath();
        waveformCtx.moveTo(plotLeft, plotTop);
        waveformCtx.lineTo(plotLeft, plotBottom);
        waveformCtx.lineTo(plotLeft + plotWidth, plotBottom);
        waveformCtx.stroke();

        waveformCtx.fillStyle = "#64748b";
        waveformCtx.font = "12px Arial";
        waveformCtx.textAlign = "right";
        waveformCtx.textBaseline = "middle";
        waveformCtx.fillText("+A", plotLeft - 8, plotTop + 2);
        waveformCtx.fillText("0", plotLeft - 8, middleY);
        waveformCtx.fillText("-A", plotLeft - 8, plotBottom - 2);

        waveformCtx.textAlign = "center";
        waveformCtx.textBaseline = "top";
        waveformCtx.fillText("tiempo", plotLeft + plotWidth / 2, plotBottom + 18);
        waveformCtx.restore();

        const visibleCycles = Math.max(2, Math.min(8, Math.round(state.frequency / 160)));
        const amplitudePx = (plotHeight / 2) * Math.max(0.08, state.amplitude);

        waveformCtx.save();
        waveformCtx.strokeStyle = state.waveType === "additive" ? "#7c3aed" : "#2563eb";
        waveformCtx.lineWidth = 2;
        waveformCtx.beginPath();

        for (let x = 0; x <= plotWidth; x++) {
            const t = x / plotWidth;
            const phase = TWO_PI * visibleCycles * t;
            const value = evaluateSignalAtPhase(state, phase);
            const y = middleY - value * amplitudePx;
            const canvasX = plotLeft + x;

            if (x === 0) waveformCtx.moveTo(canvasX, y);
            else waveformCtx.lineTo(canvasX, y);
        }

        waveformCtx.stroke();
        waveformCtx.restore();

        waveformCtx.save();
        waveformCtx.fillStyle = "#111827";
        waveformCtx.font = "13px Arial";
        waveformCtx.textAlign = "left";
        waveformCtx.textBaseline = "top";
        waveformCtx.fillText(`${getWaveLabel(state.waveType)} · ${Math.round(state.frequency)} Hz · amplitud ${(state.amplitude * 100).toFixed(0)}%`, plotLeft, 8);
        waveformCtx.restore();
    }

    function getSpectrumColor(intensity) {
        const clamped = Math.max(0, Math.min(1, intensity));
        const hue = 225 - clamped * 205;
        return `hsl(${hue}, 78%, ${62 - clamped * 14}%)`;
    }

    function drawSpectrum() {
        const state = getState();
        const { width, height } = resizeCanvasToDisplaySize(spectrumCanvas);
        clearCanvas(spectrumCtx, spectrumCanvas);

        const harmonics = getHarmonics(
            state.waveType,
            state.frequency,
            Math.max(state.amplitude, 0.01),
            state.harmonic2,
            state.harmonic3
        );
        const maxMagnitude = Math.max(...harmonics.map(h => h.magnitude), 1e-9);

        const padding = { top: 30, right: 20, bottom: 48, left: 58 };
        const plotLeft = padding.left;
        const plotTop = padding.top;
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const plotBottom = plotTop + plotHeight;

        const gradient = spectrumCtx.createLinearGradient(plotLeft, plotTop, plotLeft + plotWidth, plotTop);
        gradient.addColorStop(0, "rgba(59, 130, 246, 0.12)");
        gradient.addColorStop(0.5, "rgba(34, 197, 94, 0.10)");
        gradient.addColorStop(1, "rgba(239, 68, 68, 0.12)");
        spectrumCtx.fillStyle = gradient;
        spectrumCtx.fillRect(plotLeft, plotTop, plotWidth, plotHeight);

        spectrumCtx.save();
        spectrumCtx.strokeStyle = "#cbd5e1";
        spectrumCtx.lineWidth = 1;
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(plotLeft, plotTop);
        spectrumCtx.lineTo(plotLeft, plotBottom);
        spectrumCtx.lineTo(plotLeft + plotWidth, plotBottom);
        spectrumCtx.stroke();

        spectrumCtx.fillStyle = "#64748b";
        spectrumCtx.font = "12px Arial";
        spectrumCtx.textAlign = "center";
        spectrumCtx.textBaseline = "top";

        for (let i = 0; i <= 5; i++) {
            const ratio = i / 5;
            const x = plotLeft + ratio * plotWidth;
            const freq = Math.round(MAX_SPECTRUM_FREQUENCY * ratio);
            spectrumCtx.strokeStyle = "rgba(203, 213, 225, 0.75)";
            spectrumCtx.beginPath();
            spectrumCtx.moveTo(x, plotBottom);
            spectrumCtx.lineTo(x, plotBottom + 6);
            spectrumCtx.stroke();
            spectrumCtx.fillText(`${freq} Hz`, x, plotBottom + 10);
        }

        spectrumCtx.textAlign = "left";
        spectrumCtx.fillText("bajas", plotLeft, plotTop + plotHeight + 28);
        spectrumCtx.textAlign = "center";
        spectrumCtx.fillText("medias", plotLeft + plotWidth / 2, plotTop + plotHeight + 28);
        spectrumCtx.textAlign = "right";
        spectrumCtx.fillText("altas", plotLeft + plotWidth, plotTop + plotHeight + 28);
        spectrumCtx.restore();

        spectrumCtx.save();
        harmonics.forEach((harmonic) => {
            const x = plotLeft + (harmonic.frequency / MAX_SPECTRUM_FREQUENCY) * plotWidth;
            const normalized = harmonic.magnitude / maxMagnitude;
            const barHeight = normalized * plotHeight;
            const y = plotBottom - barHeight;
            const barWidth = harmonic.order === 1 ? 5 : 3;

            spectrumCtx.strokeStyle = getSpectrumColor(normalized);
            spectrumCtx.lineWidth = barWidth;
            spectrumCtx.beginPath();
            spectrumCtx.moveTo(x, plotBottom);
            spectrumCtx.lineTo(x, y);
            spectrumCtx.stroke();

            if (harmonic.order <= 9) {
                spectrumCtx.fillStyle = "#111827";
                spectrumCtx.font = "11px Arial";
                spectrumCtx.textAlign = "center";
                spectrumCtx.textBaseline = "bottom";
                spectrumCtx.fillText(`H${harmonic.order}`, x, Math.max(y - 4, plotTop + 12));
            }
        });
        spectrumCtx.restore();
    }

    function updateOutputs() {
        const state = getState();
        const label = getWaveLabel(state.waveType);
        frequencyOutput.textContent = `${Math.round(state.frequency)} Hz`;
        amplitudeOutput.textContent = `${Math.round(state.amplitude * 100)}%`;
        harmonic2Output.textContent = `${Math.round(state.harmonic2 * 100)}%`;
        harmonic3Output.textContent = `${Math.round(state.harmonic3 * 100)}%`;
        additiveControls.classList.toggle("is-muted", state.waveType !== "additive");

        const tonalRange = state.frequency < 220 ? "más grave" : state.frequency > 900 ? "más agudo" : "intermedio";
        const intensityText = state.amplitude < 0.25 ? "baja intensidad" : state.amplitude > 0.75 ? "alta intensidad" : "intensidad moderada";

        const technicalDescriptions = {
            sine: "La onda senoidal concentra casi toda la energía en la frecuencia fundamental.",
            square: "La onda cuadrada agrega armónicos impares, lo que produce un espectro más rico y una forma temporal abrupta.",
            triangle: "La onda triangular también usa armónicos impares, pero estos disminuyen más rápido y el timbre es más suave.",
            sawtooth: "La onda diente de sierra incluye armónicos consecutivos, por eso su espectro es más denso.",
            additive: "La señal se construye sumando la fundamental con el segundo y tercer armónico. Al cambiar sus aportes, cambia la forma de onda y el timbre."
        };

        technicalOutput.textContent = technicalDescriptions[state.waveType] || technicalDescriptions.sine;
        perceptionOutput.textContent = `La señal ${label} se ubica en un rango ${tonalRange} y se reproduce con ${intensityText}.`;
        cautionOutput.textContent = "La visualización es idealizada: en sonidos reales también influyen envolvente, ruido, resonancia y cambios temporales.";
    }

    function renderAll() {
        updateOutputs();
        drawWaveform();
        drawSpectrum();
    }

    async function ensureAudioContext() {
        if (!AudioContextClass) {
            throw new Error("Este navegador no soporta Web Audio API.");
        }

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }
    }

    function createOscillatorNode(ctx, frequency, gainValue, type = "sine") {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), ctx.currentTime + 0.04);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        return { oscillator, gain };
    }

    async function play() {
        const state = getState();

        if (state.amplitude <= 0) {
            setStatus("La amplitud está en 0%. Sube la intensidad para escuchar la señal.", "warning");
            return;
        }

        try {
            await ensureAudioContext();
            stop(false);

            const safeGain = Math.min(0.9, Math.max(0, state.amplitude)) * 0.34;
            const nodes = [];

            if (state.waveType === "additive") {
                const normalizer = Math.max(1, 1 + state.harmonic2 + state.harmonic3);
                nodes.push(createOscillatorNode(audioContext, state.frequency, safeGain * (1 / normalizer), "sine"));
                if (state.harmonic2 > 0.01) nodes.push(createOscillatorNode(audioContext, state.frequency * 2, safeGain * (state.harmonic2 / normalizer), "sine"));
                if (state.harmonic3 > 0.01) nodes.push(createOscillatorNode(audioContext, state.frequency * 3, safeGain * (state.harmonic3 / normalizer), "sine"));
            } else {
                nodes.push(createOscillatorNode(audioContext, state.frequency, safeGain, state.waveType));
            }

            nodes.forEach(({ oscillator }) => oscillator.start(audioContext.currentTime));
            activeNodes = nodes;
            isPlaying = true;

            playButton.disabled = true;
            stopButton.disabled = false;
            setStatus(`Reproduciendo ${getWaveLabel(state.waveType)} de ${Math.round(state.frequency)} Hz.`, "ok");

            if (state.duration !== "continuous") {
                stopTimer = window.setTimeout(() => stop(true), Number(state.duration) * 1000);
            }
        } catch (error) {
            console.warn("AudioLab: no se pudo reproducir la señal de síntesis.", error);
            setStatus(error.message || "No se pudo iniciar la reproducción.", "error");
            stop(false);
        }
    }

    function stop(showMessage = true) {
        if (stopTimer) {
            window.clearTimeout(stopTimer);
            stopTimer = null;
        }

        if (audioContext) {
            const now = audioContext.currentTime;
            activeNodes.forEach(({ oscillator, gain }) => {
                try {
                    gain.gain.cancelScheduledValues(now);
                    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
                    oscillator.stop(now + 0.06);
                } catch (error) {
                    console.warn("AudioLab: no se pudo detener un oscilador.", error);
                }
            });
        }

        activeNodes = [];
        isPlaying = false;
        playButton.disabled = false;
        stopButton.disabled = true;

        if (showMessage) {
            setStatus("Reproducción detenida. Puedes ajustar los controles y volver a escuchar.", "info");
        }
    }

    function applyLiveChanges() {
        const state = getState();
        renderAll();

        if (!isPlaying || !audioContext || activeNodes.length === 0) return;

        const now = audioContext.currentTime;
        if (state.waveType !== "additive" && activeNodes.length === 1) {
            activeNodes[0].oscillator.frequency.setTargetAtTime(state.frequency, now, 0.03);
            activeNodes[0].gain.gain.setTargetAtTime(Math.max(0.0001, state.amplitude * 0.34), now, 0.03);
        } else {
            stop(false);
            play();
        }
    }

    function synthesizeSamples(seconds = 3) {
        const state = getState();
        const sampleCount = Math.max(1, Math.floor(SYNTH_SAMPLE_RATE * seconds));
        const samples = new Float32Array(sampleCount);
        const fadeSamples = Math.floor(SYNTH_SAMPLE_RATE * 0.025);

        for (let i = 0; i < sampleCount; i++) {
            const time = i / SYNTH_SAMPLE_RATE;
            const phase = TWO_PI * state.frequency * time;
            let value = evaluateSignalAtPhase(state, phase) * state.amplitude * 0.85;

            if (i < fadeSamples) value *= i / fadeSamples;
            if (i > sampleCount - fadeSamples) value *= (sampleCount - i) / fadeSamples;

            samples[i] = clamp(value, -1, 1);
        }

        return samples;
    }

    function encodeWavMono(samples, sampleRate) {
        const bytesPerSample = 2;
        const blockAlign = bytesPerSample;
        const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
        const view = new DataView(buffer);

        function writeString(offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        writeString(0, "RIFF");
        view.setUint32(4, 36 + samples.length * bytesPerSample, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        writeString(36, "data");
        view.setUint32(40, samples.length * bytesPerSample, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            const sample = clamp(samples[i], -1, 1);
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        }

        return buffer;
    }

    async function shareGeneratedAudio(target) {
        const state = getState();
        if (state.amplitude <= 0) {
            setStatus("No se puede compartir una señal con amplitud 0%.", "warning");
            return;
        }

        try {
            const seconds = state.duration === "continuous" ? 3 : clamp(Number(state.duration) || 3, 1, 5);
            const samples = synthesizeSamples(seconds);
            const wavBuffer = encodeWavMono(samples, SYNTH_SAMPLE_RATE);
            const safeName = `sintesis_${state.waveType}_${Math.round(state.frequency)}Hz.wav`;
            const record = await saveGeneratedAudioBuffer({
                name: safeName,
                arrayBuffer: wavBuffer,
                duration: seconds,
                sampleRate: SYNTH_SAMPLE_RATE,
                channels: 1,
                source: "synthesis"
            });

            const destinationText = target === "analysis"
                ? "Análisis"
                : "Simulación acústica";

            setStatus(`Señal guardada como ${record.name}. Ya puedes usarla desde ${destinationText}.`, "ok");
        } catch (error) {
            console.warn("AudioLab: no se pudo compartir la señal generada.", error);
            setStatus("No se pudo guardar la señal generada en el navegador.", "error");
        }
    }

    function applyPreset(presetName) {
        const presets = {
            "pure-a4": { waveType: "sine", frequency: 440, amplitude: 55, h2: 0, h3: 0 },
            "deep-sine": { waveType: "sine", frequency: 160, amplitude: 70, h2: 0, h3: 0 },
            "rich-square": { waveType: "square", frequency: 440, amplitude: 50, h2: 0, h3: 0 },
            "bright-additive": { waveType: "additive", frequency: 330, amplitude: 62, h2: 45, h3: 30 }
        };

        const preset = presets[presetName];
        if (!preset) return;

        waveTypeSelect.value = preset.waveType;
        frequencyInput.value = preset.frequency;
        amplitudeInput.value = preset.amplitude;
        harmonic2Input.value = preset.h2;
        harmonic3Input.value = preset.h3;
        applyLiveChanges();
        setStatus("Preset aplicado. Puedes modificarlo o compartir la señal resultante.", "info");
    }

    function initialize() {
        waveTypeSelect.addEventListener("change", applyLiveChanges);
        frequencyInput.addEventListener("input", applyLiveChanges);
        amplitudeInput.addEventListener("input", applyLiveChanges);
        harmonic2Input.addEventListener("input", applyLiveChanges);
        harmonic3Input.addEventListener("input", applyLiveChanges);
        durationSelect.addEventListener("change", updateOutputs);
        playButton.addEventListener("click", play);
        stopButton.addEventListener("click", () => stop(true));
        shareAnalysisButton.addEventListener("click", () => shareGeneratedAudio("analysis"));
        shareSimulationButton.addEventListener("click", () => shareGeneratedAudio("simulation"));
        document.querySelectorAll("[data-synth-preset]").forEach(button => {
            button.addEventListener("click", () => applyPreset(button.dataset.synthPreset));
        });
        window.addEventListener("resize", renderAll);
        window.addEventListener("beforeunload", () => stop(false));

        stopButton.disabled = true;
        renderAll();
    }

    return { initialize };
}