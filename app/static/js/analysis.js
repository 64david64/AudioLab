import {
    formatTime,
    formatInputValue,
    resizeCanvasToDisplaySize,
    clearCanvas,
    drawEmptyState,
    applyHannWindow,
    computeDFTMagnitude
} from "./audio-utils.js";

import {
    classifyFrequencyBands,
    normalizeBands,
    getDominantBandKey,
    renderDominantPeaks,
    renderInterpretation
} from "./interpretation-ui.js";

import {
    saveAnalysisAudioFile,
    getStoredAnalysisAudioFile,
    formatStoredAudioSummary
} from "./audio-store.js";

const DFT_SAMPLE_LIMIT = 2048;
const MIN_DFT_SAMPLES = 64;
const PEAK_COUNT_LIMIT = 5;
const PEAK_MIN_SEPARATION_HZ = 120;
const SPECTROGRAM_MAX_TIME_BINS = 96;
const SPECTROGRAM_MAX_FREQUENCY_BINS = 72;

export function createAnalysisController(elements) {
    const {
        fileStatus,
        metaName,
        metaDuration,
        metaSampleRate,
        metaChannels,
        viewStartInput,
        viewWindowInput,
        viewSlider,
        fftMaxFrequencyInput,
        waveformCanvas,
        fftCanvas,
        spectrogramCanvas,
        spectrogramWindowSizeSelect,
        spectrogramStatusOutput,
        dominantPeaksOutput,
        bandLow,
        bandMid,
        bandHigh,
        interpretationOutput,
        analysisQualityOutput,
        bandCardLow,
        bandCardMid,
        bandCardHigh
    } = elements;

    const waveformCtx = waveformCanvas.getContext("2d");
    const fftCtx = fftCanvas.getContext("2d");
    const spectrogramCtx = spectrogramCanvas.getContext("2d");
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();

    let currentAudioBuffer = null;
    let plotsRendered = false;

    const temporalWindowStartOutput = document.getElementById("temporal-window-start");
    const temporalWindowEndOutput = document.getElementById("temporal-window-end");
    const temporalWindowDurationOutput = document.getElementById("temporal-window-duration");
    const temporalWindowSamplesOutput = document.getElementById("temporal-window-samples");

    function updateTemporalSummaryDisplay(audioBuffer, startTime = null, visibleDuration = null) {
        if (!temporalWindowStartOutput || !temporalWindowEndOutput || !temporalWindowDurationOutput || !temporalWindowSamplesOutput) {
            return;
        }

        if (!audioBuffer || startTime === null || visibleDuration === null) {
            temporalWindowStartOutput.textContent = "—";
            temporalWindowEndOutput.textContent = "—";
            temporalWindowDurationOutput.textContent = "—";
            temporalWindowSamplesOutput.textContent = "—";
            return;
        }

        const safeStart = Math.max(0, startTime);
        const safeDuration = Math.max(0, visibleDuration);
        const safeEnd = Math.min(audioBuffer.duration, safeStart + safeDuration);
        const sampleCount = Math.max(0, Math.floor((safeEnd - safeStart) * audioBuffer.sampleRate));

        temporalWindowStartOutput.textContent = `${formatInputValue(safeStart)} s`;
        temporalWindowEndOutput.textContent = `${formatInputValue(safeEnd)} s`;
        temporalWindowDurationOutput.textContent = `${formatInputValue(safeEnd - safeStart)} s`;
        temporalWindowSamplesOutput.textContent = sampleCount.toLocaleString("es-CO");
    }

    function setAnalysisQualityMessage(message, type = "info") {
        if (!analysisQualityOutput) return;

        analysisQualityOutput.classList.remove("info", "ok", "warning", "error");
        analysisQualityOutput.classList.add(type);
        analysisQualityOutput.textContent = message;
    }

    function setSpectrogramStatusMessage(message, type = "info") {
        if (!spectrogramStatusOutput) return;

        spectrogramStatusOutput.classList.remove("info", "ok", "warning", "error");
        spectrogramStatusOutput.classList.add(type);
        spectrogramStatusOutput.textContent = message;
    }

    function getSignalStats(signal) {
        if (!signal || signal.length === 0) {
            return { peak: 0, rms: 0 };
        }

        let peak = 0;
        let sumSquares = 0;

        for (let i = 0; i < signal.length; i++) {
            const value = signal[i];
            const absValue = Math.abs(value);
            if (absValue > peak) peak = absValue;
            sumSquares += value * value;
        }

        return {
            peak,
            rms: Math.sqrt(sumSquares / signal.length)
        };
    }

    function describeSignalQuality(signal, sampleRate) {
        const stats = getSignalStats(signal);
        const durationMs = (signal.length / sampleRate) * 1000;

        if (stats.peak < 0.0005 || stats.rms < 0.00005) {
            return {
                type: "warning",
                text: `El fragmento central analizado tiene amplitud muy baja (${durationMs.toFixed(0)} ms). El espectro puede no ser representativo o puede corresponder a silencio.`
            };
        }

        if (signal.length < DFT_SAMPLE_LIMIT) {
            return {
                type: "warning",
                text: `La ventana visible contiene pocas muestras para la DFT (${signal.length}). La lectura puede ser menos estable.`
            };
        }

        return {
            type: "ok",
            text: `Lectura calculada sobre ${signal.length} muestras centrales de la ventana visible (${durationMs.toFixed(0)} ms aprox.).`
        };
    }

    function resetInterpretation() {
        setAnalysisQualityMessage("Carga y procesa un archivo para evaluar la calidad del fragmento analizado.", "info");
        setSpectrogramStatusMessage("Carga y procesa un archivo para calcular el espectrograma de la ventana visible.", "info");

        if (dominantPeaksOutput) {
            dominantPeaksOutput.textContent = "Aún no hay datos disponibles.";
        }

        if (bandLow) bandLow.textContent = "—";
        if (bandMid) bandMid.textContent = "—";
        if (bandHigh) bandHigh.textContent = "—";

        if (bandCardLow) bandCardLow.classList.remove("is-dominant", "low", "mid", "high");
        if (bandCardMid) bandCardMid.classList.remove("is-dominant", "low", "mid", "high");
        if (bandCardHigh) bandCardHigh.classList.remove("is-dominant", "low", "mid", "high");

        if (interpretationOutput) {
            interpretationOutput.textContent = "Aún no hay interpretación disponible.";
        }
    }

    function getValidatedViewRange(audioBuffer) {
        const totalDuration = audioBuffer.duration;

        let startTime = parseFloat(viewStartInput.value);
        let visibleDuration = parseFloat(viewWindowInput.value);

        if (Number.isNaN(startTime)) startTime = 0;
        if (Number.isNaN(visibleDuration) || visibleDuration <= 0) visibleDuration = 10;

        if (startTime < 0) startTime = 0;
        if (startTime >= totalDuration) startTime = Math.max(0, totalDuration - 0.1);

        if (visibleDuration > totalDuration) {
            visibleDuration = totalDuration;
        }

        const maxVisibleFromStart = totalDuration - startTime;
        if (visibleDuration > maxVisibleFromStart) {
            visibleDuration = maxVisibleFromStart;
        }

        if (visibleDuration <= 0) {
            visibleDuration = Math.min(0.1, totalDuration);
        }

        return {
            startTime,
            endTime: startTime + visibleDuration,
            visibleDuration
        };
    }

    function updateSliderBounds(audioBuffer, startTimeOverride = null) {
        if (!audioBuffer) return null;

        const totalDuration = audioBuffer.duration;
        let visibleDuration = parseFloat(viewWindowInput.value);

        if (Number.isNaN(visibleDuration) || visibleDuration <= 0) {
            visibleDuration = 10;
        }

        if (visibleDuration > totalDuration) {
            visibleDuration = totalDuration;
        }

        const maxStart = Math.max(0, totalDuration - visibleDuration);

        let currentStart = startTimeOverride;
        if (currentStart === null) {
            currentStart = parseFloat(viewStartInput.value);
        }

        if (Number.isNaN(currentStart) || currentStart < 0) {
            currentStart = 0;
        }

        if (currentStart > maxStart) {
            currentStart = maxStart;
        }

        viewSlider.min = 0;
        viewSlider.max = maxStart;
        viewSlider.step = 0.01;
        viewSlider.value = currentStart;

        viewStartInput.value = formatInputValue(currentStart);
        viewWindowInput.value = formatInputValue(visibleDuration);
        updateTemporalSummaryDisplay(audioBuffer, currentStart, visibleDuration);

        return {
            currentStart,
            visibleDuration
        };
    }

    function getValidatedFftMaxFrequency(sampleRate) {
        const nyquist = sampleRate / 2;
        let maxFrequency = parseFloat(fftMaxFrequencyInput.value);

        if (Number.isNaN(maxFrequency) || maxFrequency <= 0) {
            maxFrequency = 5000;
        }

        if (maxFrequency > nyquist) {
            maxFrequency = nyquist;
        }

        fftMaxFrequencyInput.value = Math.round(maxFrequency);
        return maxFrequency;
    }

    function drawWaveAxes(startTime, endTime, plotLeft, plotTop, plotWidth, plotHeight) {
        const plotBottom = plotTop + plotHeight;
        const plotRight = plotLeft + plotWidth;
        const middleY = plotTop + plotHeight / 2;
        const visibleDuration = endTime - startTime;

        waveformCtx.save();

        waveformCtx.strokeStyle = "#cbd5e1";
        waveformCtx.lineWidth = 1;
        waveformCtx.fillStyle = "#64748b";
        waveformCtx.font = "12px Arial";
        waveformCtx.textAlign = "center";
        waveformCtx.textBaseline = "top";

        waveformCtx.beginPath();
        waveformCtx.moveTo(plotLeft, plotBottom);
        waveformCtx.lineTo(plotRight, plotBottom);
        waveformCtx.stroke();

        waveformCtx.beginPath();
        waveformCtx.moveTo(plotLeft, plotTop);
        waveformCtx.lineTo(plotLeft, plotBottom);
        waveformCtx.stroke();

        waveformCtx.strokeStyle = "#94a3b8";
        waveformCtx.beginPath();
        waveformCtx.moveTo(plotLeft, middleY);
        waveformCtx.lineTo(plotRight, middleY);
        waveformCtx.stroke();

        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
            const ratio = i / tickCount;
            const x = plotLeft + ratio * plotWidth;
            const timeValue = startTime + visibleDuration * ratio;

            waveformCtx.strokeStyle = "#cbd5e1";
            waveformCtx.beginPath();
            waveformCtx.moveTo(x, plotBottom);
            waveformCtx.lineTo(x, plotBottom + 6);
            waveformCtx.stroke();

            waveformCtx.fillText(formatTime(timeValue), x, plotBottom + 8);
        }

        waveformCtx.textAlign = "right";
        waveformCtx.textBaseline = "middle";
        waveformCtx.fillText("1.0", plotLeft - 8, plotTop);
        waveformCtx.fillText("0", plotLeft - 8, middleY);
        waveformCtx.fillText("-1.0", plotLeft - 8, plotBottom);

        waveformCtx.restore();
    }

    function drawFftAxes(maxFrequency, maxMagnitude, plotLeft, plotTop, plotWidth, plotHeight) {
        const plotBottom = plotTop + plotHeight;
        const plotRight = plotLeft + plotWidth;

        fftCtx.save();

        fftCtx.strokeStyle = "#cbd5e1";
        fftCtx.lineWidth = 1;
        fftCtx.fillStyle = "#64748b";
        fftCtx.font = "12px Arial";
        fftCtx.textAlign = "center";
        fftCtx.textBaseline = "top";

        fftCtx.beginPath();
        fftCtx.moveTo(plotLeft, plotBottom);
        fftCtx.lineTo(plotRight, plotBottom);
        fftCtx.stroke();

        fftCtx.beginPath();
        fftCtx.moveTo(plotLeft, plotTop);
        fftCtx.lineTo(plotLeft, plotBottom);
        fftCtx.stroke();

        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
            const ratio = i / tickCount;
            const x = plotLeft + ratio * plotWidth;
            const freqValue = maxFrequency * ratio;

            fftCtx.strokeStyle = "#cbd5e1";
            fftCtx.beginPath();
            fftCtx.moveTo(x, plotBottom);
            fftCtx.lineTo(x, plotBottom + 6);
            fftCtx.stroke();

            fftCtx.fillText(`${Math.round(freqValue)} Hz`, x, plotBottom + 8);
        }

        fftCtx.textAlign = "right";
        fftCtx.textBaseline = "middle";

        const yTickCount = 4;
        for (let i = 0; i <= yTickCount; i++) {
            const ratio = i / yTickCount;
            const y = plotBottom - ratio * plotHeight;
            const magValue = maxMagnitude * ratio;

            fftCtx.strokeStyle = "#e5e7eb";
            fftCtx.beginPath();
            fftCtx.moveTo(plotLeft, y);
            fftCtx.lineTo(plotRight, y);
            fftCtx.stroke();

            fftCtx.fillStyle = "#64748b";
            fftCtx.fillText(magValue.toFixed(3), plotLeft - 8, y);
        }

        fftCtx.restore();
    }

    function drawFrequencyBandsBackground(ctx, plotLeft, plotTop, plotWidth, plotHeight, maxFrequency, dominantBand) {
        const bands = [
            { key: "low", max: 250, baseColor: [59, 130, 246] },
            { key: "mid", max: 2000, baseColor: [34, 197, 94] },
            { key: "high", max: maxFrequency, baseColor: [239, 68, 68] }
        ];

        let currentStartFreq = 0;

        bands.forEach((band) => {
            const bandEndFreq = Math.min(band.max, maxFrequency);
            if (bandEndFreq <= currentStartFreq) return;

            const xStart = plotLeft + (currentStartFreq / maxFrequency) * plotWidth;
            const xEnd = plotLeft + (bandEndFreq / maxFrequency) * plotWidth;

            const isDominant = band.key === dominantBand;
            const opacity = isDominant ? 0.28 : 0.10;

            const [r, g, b] = band.baseColor;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.fillRect(xStart, plotTop, xEnd - xStart, plotHeight);

            currentStartFreq = bandEndFreq;
        });
    }

    function getVisibleChannelData(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        const { startTime } = getValidatedViewRange(audioBuffer);
        const synced = updateSliderBounds(audioBuffer, startTime);

        const finalStartTime = synced.currentStart;
        const finalVisibleDuration = synced.visibleDuration;
        const finalEndTime = finalStartTime + finalVisibleDuration;

        const startSample = Math.floor(finalStartTime * sampleRate);
        const endSample = Math.min(channelData.length, Math.floor(finalEndTime * sampleRate));
        const visibleData = channelData.slice(startSample, endSample);

        return {
            visibleData,
            sampleRate,
            startTime: finalStartTime,
            endTime: finalEndTime
        };
    }

    function getPeakAbs(signal) {
        let peak = 0;

        for (let i = 0; i < signal.length; i++) {
            const absValue = Math.abs(signal[i]);
            if (absValue > peak) peak = absValue;
        }

        return peak > 0 ? peak : 1;
    }

    function getCentralAnalysisSlice(visibleData) {
        const N = Math.min(DFT_SAMPLE_LIMIT, visibleData.length);
        const start = Math.max(0, Math.floor((visibleData.length - N) / 2));
        const end = start + N;

        return visibleData.slice(start, end);
    }

    function findDominantPeaks(filteredData, maxPeaks = PEAK_COUNT_LIMIT, minSeparationHz = PEAK_MIN_SEPARATION_HZ) {
        if (!filteredData || filteredData.length < 3) return [];

        const maxMagnitude = Math.max(...filteredData.map(p => p.mag), 1e-12);
        const minPeakThreshold = maxMagnitude * 0.15;

        const candidatePeaks = [];

        for (let i = 1; i < filteredData.length - 1; i++) {
            const prev = filteredData[i - 1];
            const curr = filteredData[i];
            const next = filteredData[i + 1];

            const isLocalPeak = curr.mag > prev.mag && curr.mag > next.mag;
            const isStrongEnough = curr.mag >= minPeakThreshold;
            const isUsefulFrequency = curr.freq > 0;

            if (isLocalPeak && isStrongEnough && isUsefulFrequency) {
                candidatePeaks.push(curr);
            }
        }

        candidatePeaks.sort((a, b) => b.mag - a.mag);

        const selected = [];

        for (const peak of candidatePeaks) {
            const tooClose = selected.some(
                existingPeak => Math.abs(existingPeak.freq - peak.freq) < minSeparationHz
            );

            if (!tooClose) {
                selected.push(peak);
            }

            if (selected.length >= maxPeaks) break;
        }

        return selected.sort((a, b) => a.freq - b.freq);
    }

    function drawFftPeakLabels(peaks, fftMaxFrequency, maxMagnitude, plotLeft, plotBottom, plotWidth, plotHeight) {
        if (!peaks || peaks.length === 0) return;

        fftCtx.save();
        fftCtx.font = "12px Arial";
        fftCtx.textAlign = "center";
        fftCtx.textBaseline = "bottom";
        fftCtx.lineWidth = 1;

        peaks.forEach((peak) => {
            const x = plotLeft + (peak.freq / fftMaxFrequency) * plotWidth;
            const rawY = plotBottom - (peak.mag / maxMagnitude) * plotHeight;
            const y = Math.max(rawY, 28);

            fftCtx.strokeStyle = "#111827";
            fftCtx.beginPath();
            fftCtx.moveTo(x, y);
            fftCtx.lineTo(x, y - 10);
            fftCtx.stroke();

            const label = `${Math.round(peak.freq)} Hz`;
            const paddingX = 6;
            const boxHeight = 18;
            const textWidth = fftCtx.measureText(label).width;
            const boxWidth = textWidth + paddingX * 2;

            const boxX = x - boxWidth / 2;
            const boxY = y - 30;

            fftCtx.fillStyle = "rgba(255, 255, 255, 0.92)";
            fftCtx.fillRect(boxX, boxY, boxWidth, boxHeight);

            fftCtx.strokeStyle = "#cbd5e1";
            fftCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

            fftCtx.fillStyle = "#111827";
            fftCtx.fillText(label, x, boxY + 14);
        });

        fftCtx.restore();
    }

    function drawWaveform(audioBuffer) {
        if (!audioBuffer) return;

        const { width: canvasWidth, height: canvasHeight } = resizeCanvasToDisplaySize(waveformCanvas);
        clearCanvas(waveformCtx, waveformCanvas);

        const { visibleData, startTime, endTime } = getVisibleChannelData(audioBuffer);

        const padding = {
            top: 16,
            right: 16,
            bottom: 42,
            left: 56
        };

        const plotLeft = padding.left;
        const plotTop = padding.top;
        const plotWidth = canvasWidth - padding.left - padding.right;
        const plotHeight = canvasHeight - padding.top - padding.bottom;
        const middleY = plotTop + plotHeight / 2;

        drawWaveAxes(startTime, endTime, plotLeft, plotTop, plotWidth, plotHeight);

        const samplesPerPixel = Math.max(1, Math.ceil(visibleData.length / plotWidth));
        const peakAbs = getPeakAbs(visibleData);

        waveformCtx.save();
        waveformCtx.strokeStyle = "#2563eb";
        waveformCtx.lineWidth = 1;
        waveformCtx.beginPath();

        for (let x = 0; x < plotWidth; x++) {
            const start = x * samplesPerPixel;
            const end = Math.min(start + samplesPerPixel, visibleData.length);

            if (start >= visibleData.length) break;

            let min = 1;
            let max = -1;

            for (let i = start; i < end; i++) {
                const sample = visibleData[i] / peakAbs;
                if (sample < min) min = sample;
                if (sample > max) max = sample;
            }

            const canvasX = plotLeft + x;
            const yMin = middleY - max * (plotHeight / 2);
            const yMax = middleY - min * (plotHeight / 2);

            waveformCtx.moveTo(canvasX, yMin);
            waveformCtx.lineTo(canvasX, yMax);
        }

        waveformCtx.stroke();
        waveformCtx.restore();
    }

    function drawFFT(audioBuffer) {
        if (!audioBuffer) return;

        const { width: canvasWidth, height: canvasHeight } = resizeCanvasToDisplaySize(fftCanvas);
        clearCanvas(fftCtx, fftCanvas);

        const { visibleData, sampleRate } = getVisibleChannelData(audioBuffer);

        if (visibleData.length < MIN_DFT_SAMPLES) {
            drawEmptyState(fftCtx, fftCanvas, "La ventana temporal es demasiado pequeña para calcular la DFT");
            setAnalysisQualityMessage("La ventana seleccionada es demasiado pequeña para una lectura espectral estable.", "warning");
            renderDominantPeaks(dominantPeaksOutput, []);
            renderInterpretation([], {
                bandLow,
                bandMid,
                bandHigh,
                interpretationOutput,
                bandCardLow,
                bandCardMid,
                bandCardHigh
            });
            return;
        }

        const analysisSignal = getCentralAnalysisSlice(visibleData);
        const quality = describeSignalQuality(analysisSignal, sampleRate);
        setAnalysisQualityMessage(quality.text, quality.type);

        const windowedSignal = applyHannWindow(analysisSignal);
        const { frequencies, magnitudes } = computeDFTMagnitude(windowedSignal, sampleRate);
        const fftMaxFrequency = getValidatedFftMaxFrequency(sampleRate);

        const filteredData = frequencies
            .map((freq, i) => ({ freq, mag: magnitudes[i] }))
            .filter(point => point.freq <= fftMaxFrequency);

        if (filteredData.length === 0) {
            drawEmptyState(fftCtx, fftCanvas, "No hay datos espectrales en el rango seleccionado");
            setAnalysisQualityMessage("No se encontraron datos espectrales dentro del rango de frecuencia visible.", "warning");
            renderDominantPeaks(dominantPeaksOutput, []);
            renderInterpretation([], {
                bandLow,
                bandMid,
                bandHigh,
                interpretationOutput,
                bandCardLow,
                bandCardMid,
                bandCardHigh
            });
            return;
        }

        const maxMagnitude = Math.max(...filteredData.map(p => p.mag), 1e-12);

        const padding = {
            top: 40,
            right: 16,
            bottom: 42,
            left: 56
        };

        const plotLeft = padding.left;
        const plotTop = padding.top;
        const plotWidth = canvasWidth - padding.left - padding.right;
        const plotHeight = canvasHeight - padding.top - padding.bottom;
        const plotBottom = plotTop + plotHeight;

        const dominantPeaks = findDominantPeaks(filteredData);
        const bandDistribution = classifyFrequencyBands(filteredData, { usePower: true });
        const normalized = normalizeBands(bandDistribution);
        const dominantBand = getDominantBandKey(normalized);

        drawFrequencyBandsBackground(
            fftCtx,
            plotLeft,
            plotTop,
            plotWidth,
            plotHeight,
            fftMaxFrequency,
            dominantBand
        );

        drawFftAxes(fftMaxFrequency, maxMagnitude, plotLeft, plotTop, plotWidth, plotHeight);

        fftCtx.save();
        fftCtx.strokeStyle = "#dc2626";
        fftCtx.lineWidth = 1.5;
        fftCtx.beginPath();

        filteredData.forEach((point, i) => {
            const x = plotLeft + (point.freq / fftMaxFrequency) * plotWidth;
            const y = plotBottom - (point.mag / maxMagnitude) * plotHeight;

            if (i === 0) {
                fftCtx.moveTo(x, y);
            } else {
                fftCtx.lineTo(x, y);
            }
        });

        fftCtx.stroke();
        fftCtx.restore();

        fftCtx.save();

        const mainPeak = dominantPeaks.length > 0
            ? [...dominantPeaks].sort((a, b) => b.mag - a.mag)[0]
            : null;

        dominantPeaks.forEach((peak) => {
            const x = plotLeft + (peak.freq / fftMaxFrequency) * plotWidth;
            const y = plotBottom - (peak.mag / maxMagnitude) * plotHeight;
            const isMain = mainPeak && peak === mainPeak;

            fftCtx.beginPath();

            if (isMain) {
                fftCtx.fillStyle = "#f59e0b";
                fftCtx.arc(x, y, 5, 0, Math.PI * 2);
            } else {
                fftCtx.fillStyle = "#2563eb";
                fftCtx.arc(x, y, 3, 0, Math.PI * 2);
            }

            fftCtx.fill();
        });

        fftCtx.restore();

        drawFftPeakLabels(
            dominantPeaks,
            fftMaxFrequency,
            maxMagnitude,
            plotLeft,
            plotBottom,
            plotWidth,
            plotHeight
        );

        renderDominantPeaks(dominantPeaksOutput, dominantPeaks);
        renderInterpretation(dominantPeaks, {
            bandLow,
            bandMid,
            bandHigh,
            interpretationOutput,
            bandCardLow,
            bandCardMid,
            bandCardHigh
        }, bandDistribution);
    }

    function getValidatedSpectrogramWindowSize() {
        const allowed = [256, 512, 1024];
        const selected = Number(spectrogramWindowSizeSelect.value);
        return allowed.includes(selected) ? selected : 512;
    }

    function getSpectrogramColor(intensity) {
        const clamped = Math.max(0, Math.min(1, intensity));
        const hue = 228 - clamped * 215;
        const saturation = 82;
        const lightness = 90 - clamped * 42;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    function computeSpectrogramRows(windowedSignal, sampleRate, maxFrequency, rowCount) {
        const N = windowedSignal.length;
        const rows = new Float32Array(rowCount);

        for (let row = 0; row < rowCount; row++) {
            const frequency = ((row + 0.5) / rowCount) * maxFrequency;
            let real = 0;
            let imag = 0;

            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * frequency * n) / sampleRate;
                real += windowedSignal[n] * Math.cos(angle);
                imag -= windowedSignal[n] * Math.sin(angle);
            }

            rows[row] = Math.sqrt(real * real + imag * imag) / N;
        }

        return rows;
    }

    function drawSpectrogramAxes(startTime, endTime, maxFrequency, plotLeft, plotTop, plotWidth, plotHeight) {
        const plotBottom = plotTop + plotHeight;
        const plotRight = plotLeft + plotWidth;
        const visibleDuration = endTime - startTime;

        spectrogramCtx.save();
        spectrogramCtx.strokeStyle = "#cbd5e1";
        spectrogramCtx.lineWidth = 1;
        spectrogramCtx.fillStyle = "#64748b";
        spectrogramCtx.font = "12px Arial";

        spectrogramCtx.beginPath();
        spectrogramCtx.moveTo(plotLeft, plotTop);
        spectrogramCtx.lineTo(plotLeft, plotBottom);
        spectrogramCtx.lineTo(plotRight, plotBottom);
        spectrogramCtx.stroke();

        spectrogramCtx.textAlign = "center";
        spectrogramCtx.textBaseline = "top";

        for (let i = 0; i <= 5; i++) {
            const ratio = i / 5;
            const x = plotLeft + ratio * plotWidth;
            const timeValue = startTime + visibleDuration * ratio;

            spectrogramCtx.strokeStyle = "rgba(203, 213, 225, 0.8)";
            spectrogramCtx.beginPath();
            spectrogramCtx.moveTo(x, plotBottom);
            spectrogramCtx.lineTo(x, plotBottom + 6);
            spectrogramCtx.stroke();

            spectrogramCtx.fillStyle = "#64748b";
            spectrogramCtx.fillText(formatTime(timeValue), x, plotBottom + 10);
        }

        spectrogramCtx.textAlign = "right";
        spectrogramCtx.textBaseline = "middle";

        for (let i = 0; i <= 4; i++) {
            const ratio = i / 4;
            const y = plotBottom - ratio * plotHeight;
            const freqValue = maxFrequency * ratio;

            spectrogramCtx.strokeStyle = "rgba(229, 231, 235, 0.72)";
            spectrogramCtx.beginPath();
            spectrogramCtx.moveTo(plotLeft, y);
            spectrogramCtx.lineTo(plotRight, y);
            spectrogramCtx.stroke();

            spectrogramCtx.fillStyle = "#64748b";
            spectrogramCtx.fillText(`${Math.round(freqValue)} Hz`, plotLeft - 8, y);
        }

        spectrogramCtx.restore();
    }

    function drawSpectrogram(audioBuffer) {
        if (!audioBuffer) return;

        const { width: canvasWidth, height: canvasHeight } = resizeCanvasToDisplaySize(spectrogramCanvas);
        clearCanvas(spectrogramCtx, spectrogramCanvas);

        const { visibleData, sampleRate, startTime, endTime } = getVisibleChannelData(audioBuffer);
        const windowSize = getValidatedSpectrogramWindowSize();

        if (visibleData.length < windowSize) {
            drawEmptyState(spectrogramCtx, spectrogramCanvas, "La ventana visible es muy corta para este tamaño de análisis");
            setSpectrogramStatusMessage("Reduce el tamaño de ventana del espectrograma o aumenta la duración visible.", "warning");
            return;
        }

        const fftMaxFrequency = getValidatedFftMaxFrequency(sampleRate);
        const hopSize = Math.max(32, Math.floor(windowSize / 2));
        const rawSegmentCount = Math.max(1, Math.floor((visibleData.length - windowSize) / hopSize) + 1);
        const segmentSkip = Math.max(1, Math.ceil(rawSegmentCount / SPECTROGRAM_MAX_TIME_BINS));
        const timeBins = Math.ceil(rawSegmentCount / segmentSkip);
        const freqBins = SPECTROGRAM_MAX_FREQUENCY_BINS;
        const matrix = [];
        let maxMagnitude = 0;

        for (let segmentIndex = 0; segmentIndex < rawSegmentCount; segmentIndex += segmentSkip) {
            const startSample = segmentIndex * hopSize;
            const slice = visibleData.slice(startSample, startSample + windowSize);
            if (slice.length < windowSize) break;

            const windowed = applyHannWindow(slice);
            const rows = computeSpectrogramRows(windowed, sampleRate, fftMaxFrequency, freqBins);

            for (let i = 0; i < rows.length; i++) {
                if (rows[i] > maxMagnitude) maxMagnitude = rows[i];
            }

            matrix.push(rows);
        }

        if (matrix.length === 0 || maxMagnitude <= 0) {
            drawEmptyState(spectrogramCtx, spectrogramCanvas, "No se detectó energía suficiente para construir el espectrograma");
            setSpectrogramStatusMessage("El fragmento visible parece tener muy baja amplitud o silencio.", "warning");
            return;
        }

        const padding = { top: 22, right: 18, bottom: 48, left: 64 };
        const plotLeft = padding.left;
        const plotTop = padding.top;
        const plotWidth = canvasWidth - padding.left - padding.right;
        const plotHeight = canvasHeight - padding.top - padding.bottom;
        const plotBottom = plotTop + plotHeight;
        const cellWidth = plotWidth / matrix.length;
        const cellHeight = plotHeight / freqBins;

        spectrogramCtx.save();
        spectrogramCtx.fillStyle = "#f8fafc";
        spectrogramCtx.fillRect(plotLeft, plotTop, plotWidth, plotHeight);

        for (let xIndex = 0; xIndex < matrix.length; xIndex++) {
            const rows = matrix[xIndex];

            for (let row = 0; row < freqBins; row++) {
                const rawIntensity = rows[row] / maxMagnitude;
                const intensity = Math.log10(1 + 9 * rawIntensity);
                const x = plotLeft + xIndex * cellWidth;
                const y = plotBottom - (row + 1) * cellHeight;

                spectrogramCtx.fillStyle = getSpectrogramColor(intensity);
                spectrogramCtx.fillRect(x, y, Math.ceil(cellWidth) + 0.5, Math.ceil(cellHeight) + 0.5);
            }
        }
        spectrogramCtx.restore();

        drawSpectrogramAxes(startTime, endTime, fftMaxFrequency, plotLeft, plotTop, plotWidth, plotHeight);

        const durationMs = ((windowSize / sampleRate) * 1000).toFixed(0);
        const skipNote = segmentSkip > 1 ? ` Se omitieron ventanas intermedias para mantener fluida la visualización.` : "";
        setSpectrogramStatusMessage(`Espectrograma calculado con ${matrix.length} ventanas visibles de ${durationMs} ms aprox.${skipNote}`, "ok");
    }

    function renderPlots() {
        if (!currentAudioBuffer) return;
        drawWaveform(currentAudioBuffer);
        drawFFT(currentAudioBuffer);
        drawSpectrogram(currentAudioBuffer);
        plotsRendered = true;
    }

    async function handleAudioChange(file) {
        if (!file) return;

        fileStatus.textContent = `Archivo cargado: ${file.name}. Pulsa “Procesar audio” para actualizar los gráficos.`;
        metaName.textContent = file.name;

        try {
            if (audioContext.state === "suspended") {
                await audioContext.resume();
            }

            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

            currentAudioBuffer = audioBuffer;
            plotsRendered = false;

            metaDuration.textContent = formatTime(audioBuffer.duration);
            metaSampleRate.textContent = `${audioBuffer.sampleRate} Hz`;

            const channels = audioBuffer.numberOfChannels;
            metaChannels.textContent = channels === 1 ? "Mono" : `${channels} canales`;

            viewStartInput.value = "0";
            viewWindowInput.value = formatInputValue(Math.min(10, audioBuffer.duration));
            fftMaxFrequencyInput.value = "5000";

            updateSliderBounds(audioBuffer);
            resetInterpretation();

            try {
                await saveAnalysisAudioFile(file, arrayBuffer, audioBuffer);
                fileStatus.textContent = `Archivo cargado: ${file.name}. También quedó disponible como fuente sonora en Simulación acústica.`;
            } catch (storageError) {
                console.warn("AudioLab: no se pudo guardar el audio para simulación.", storageError);
                fileStatus.textContent = `Archivo cargado: ${file.name}. Pulsa “Procesar audio” para actualizar los gráficos. No fue posible compartirlo con Simulación en este navegador.`;
            }

            drawEmptyState(
                waveformCtx,
                waveformCanvas,
                "Carga un archivo y pulsa “Procesar audio” para ver la forma de onda"
            );

            drawEmptyState(
                fftCtx,
                fftCanvas,
                "Pulsa “Procesar audio” para ver la DFT del fragmento central de la ventana"
            );

            drawEmptyState(
                spectrogramCtx,
                spectrogramCanvas,
                "Pulsa “Procesar audio” para ver el espectrograma de la ventana visible"
            );
        } catch (error) {
            console.error(error);
            fileStatus.textContent = "Error al procesar el archivo. Verifica que sea un audio válido y compatible con el navegador.";
            currentAudioBuffer = null;
            plotsRendered = false;
            resetInterpretation();
            updateTemporalSummaryDisplay(null);
            setAnalysisQualityMessage("No fue posible decodificar el archivo de audio.", "error");

            drawEmptyState(waveformCtx, waveformCanvas, "No se pudo cargar la forma de onda");
            drawEmptyState(fftCtx, fftCanvas, "No se pudo calcular la DFT");
            drawEmptyState(spectrogramCtx, spectrogramCanvas, "No se pudo calcular el espectrograma");
        }
    }

    async function loadStoredAudio() {
        try {
            const record = await getStoredAnalysisAudioFile();

            if (!record) {
                fileStatus.textContent = "No hay audio compartido desde Síntesis o Análisis. Genera o carga una señal primero.";
                setAnalysisQualityMessage("No hay una fuente compartida disponible para cargar.", "warning");
                return;
            }

            if (audioContext.state === "suspended") {
                await audioContext.resume();
            }

            const arrayBuffer = record.arrayBuffer.slice(0);
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

            currentAudioBuffer = audioBuffer;
            plotsRendered = false;

            metaName.textContent = record.name || "audio compartido";
            metaDuration.textContent = formatTime(audioBuffer.duration);
            metaSampleRate.textContent = `${audioBuffer.sampleRate} Hz`;
            metaChannels.textContent = audioBuffer.numberOfChannels === 1 ? "Mono" : `${audioBuffer.numberOfChannels} canales`;

            viewStartInput.value = "0";
            viewWindowInput.value = formatInputValue(Math.min(10, audioBuffer.duration));
            fftMaxFrequencyInput.value = "5000";

            updateSliderBounds(audioBuffer);
            resetInterpretation();
            updateTemporalSummaryDisplay(audioBuffer, 0, Math.min(10, audioBuffer.duration));

            fileStatus.textContent = `Audio compartido cargado: ${formatStoredAudioSummary(record)}. Pulsa “Procesar audio” para actualizar los gráficos.`;
            setAnalysisQualityMessage("Audio compartido cargado correctamente. Puedes analizarlo como una señal local.", "ok");

            drawEmptyState(
                waveformCtx,
                waveformCanvas,
                "Pulsa “Procesar audio” para ver la forma de onda del audio compartido"
            );

            drawEmptyState(
                fftCtx,
                fftCanvas,
                "Pulsa “Procesar audio” para ver la DFT del audio compartido"
            );

            drawEmptyState(
                spectrogramCtx,
                spectrogramCanvas,
                "Pulsa “Procesar audio” para ver el espectrograma del audio compartido"
            );
        } catch (error) {
            console.warn("AudioLab: no se pudo cargar el audio compartido.", error);
            fileStatus.textContent = "No se pudo cargar el audio compartido. Vuelve a generarlo o cargarlo.";
            setAnalysisQualityMessage("El audio compartido no pudo decodificarse en este navegador.", "error");
        }
    }

    function processAudio() {
        if (!currentAudioBuffer) {
            fileStatus.textContent = "Primero debes cargar un archivo válido.";
            setAnalysisQualityMessage("No hay señal disponible para analizar.", "warning");
            return;
        }

        renderPlots();
    }

    function updateView() {
        if (!currentAudioBuffer) {
            fileStatus.textContent = "Primero debes cargar un archivo válido.";
            setAnalysisQualityMessage("No hay señal disponible para actualizar la vista.", "warning");
            return;
        }

        updateSliderBounds(currentAudioBuffer);
        renderPlots();
    }

    function updateFFT() {
        if (!currentAudioBuffer) {
            fileStatus.textContent = "Primero debes cargar un archivo válido.";
            setAnalysisQualityMessage("No hay señal disponible para recalcular la DFT.", "warning");
            return;
        }

        drawFFT(currentAudioBuffer);
    }

    function handleSliderInput() {
        if (!currentAudioBuffer) return;

        const sliderStart = parseFloat(viewSlider.value);
        viewStartInput.value = formatInputValue(sliderStart);
        updateSliderBounds(currentAudioBuffer, sliderStart);

        if (plotsRendered) {
            renderPlots();
        }
    }

    function handleViewWindowChange() {
        if (!currentAudioBuffer) return;

        updateSliderBounds(currentAudioBuffer);

        if (plotsRendered) {
            renderPlots();
        }
    }

    function handleViewStartChange() {
        if (!currentAudioBuffer) return;

        updateSliderBounds(currentAudioBuffer);

        if (plotsRendered) {
            renderPlots();
        }
    }

    function handleMaxFrequencyChange() {
        if (!currentAudioBuffer) return;

        if (plotsRendered) {
            drawFFT(currentAudioBuffer);
            drawSpectrogram(currentAudioBuffer);
        }
    }

    function handleSpectrogramWindowChange() {
        if (!currentAudioBuffer) return;

        if (plotsRendered) {
            drawSpectrogram(currentAudioBuffer);
        }
    }

    function handleResize() {
        if (plotsRendered && currentAudioBuffer) {
            renderPlots();
        } else {
            drawEmptyState(
                waveformCtx,
                waveformCanvas,
                "Carga un archivo y pulsa “Procesar audio” para ver la forma de onda"
            );
            drawEmptyState(
                fftCtx,
                fftCanvas,
                "Pulsa “Procesar audio” para ver la DFT del fragmento central de la ventana"
            );
            drawEmptyState(
                spectrogramCtx,
                spectrogramCanvas,
                "Pulsa “Procesar audio” para ver el espectrograma de la ventana visible"
            );
        }
    }

    function initializeEmptyState() {
        drawEmptyState(
            waveformCtx,
            waveformCanvas,
            "Carga un archivo y pulsa “Procesar audio” para ver la forma de onda"
        );
        drawEmptyState(
            fftCtx,
            fftCanvas,
            "Pulsa “Procesar audio” para ver la DFT del fragmento central de la ventana"
        );
        drawEmptyState(
            spectrogramCtx,
            spectrogramCanvas,
            "Pulsa “Procesar audio” para ver el espectrograma de la ventana visible"
        );
        resetInterpretation();
        updateTemporalSummaryDisplay(null);
    }

    return {
        handleAudioChange,
        loadStoredAudio,
        processAudio,
        updateView,
        updateFFT,
        handleSliderInput,
        handleViewWindowChange,
        handleViewStartChange,
        handleMaxFrequencyChange,
        handleSpectrogramWindowChange,
        handleResize,
        initializeEmptyState
    };
}