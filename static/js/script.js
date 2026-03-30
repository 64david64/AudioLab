document.addEventListener("DOMContentLoaded", () => {
    const audioInput = document.getElementById("audio-file");
    if (!audioInput) return;

    const fileStatus = document.getElementById("file-status");
    const metaName = document.getElementById("meta-name");
    const metaDuration = document.getElementById("meta-duration");
    const metaSampleRate = document.getElementById("meta-samplerate");
    const metaChannels = document.getElementById("meta-channels");

    const processButton = document.getElementById("process-audio-btn");
    const updateViewButton = document.getElementById("update-view-btn");
    const updateFftButton = document.getElementById("update-fft-btn");

    const viewStartInput = document.getElementById("view-start");
    const viewWindowInput = document.getElementById("view-window");
    const viewSlider = document.getElementById("view-slider");

    const fftMaxFrequencyInput = document.getElementById("fft-max-frequency");

    const waveformCanvas = document.getElementById("waveform-canvas");
    const waveformCtx = waveformCanvas.getContext("2d");

    const fftCanvas = document.getElementById("fft-canvas");
    const fftCtx = fftCanvas.getContext("2d");

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    let currentAudioBuffer = null;
    let plotsRendered = false;

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    function formatInputValue(value) {
        return Number(value.toFixed(2)).toString();
    }

    function resizeCanvasToDisplaySize(canvas) {
        const rect = canvas.getBoundingClientRect();
        const displayWidth = Math.max(300, Math.floor(rect.width));
        const displayHeight = Math.max(220, Math.floor(rect.height));

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
    }

    function clearCanvas(ctx, canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawEmptyState(ctx, canvas, message) {
        resizeCanvasToDisplaySize(canvas);
        clearCanvas(ctx, canvas);

        ctx.fillStyle = "#64748b";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);
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

    function drawFftAxes(maxFrequency, plotLeft, plotTop, plotWidth, plotHeight) {
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
        fftCtx.fillText("Mag", plotLeft - 8, plotTop + 10);

        fftCtx.restore();
    }

    function getVisibleChannelData(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        const { startTime, visibleDuration } = getValidatedViewRange(audioBuffer);
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

    function drawWaveform(audioBuffer) {
        if (!audioBuffer) return;

        resizeCanvasToDisplaySize(waveformCanvas);
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
        const plotWidth = waveformCanvas.width - padding.left - padding.right;
        const plotHeight = waveformCanvas.height - padding.top - padding.bottom;
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

    function applyHannWindow(signal) {
        const N = signal.length;
        const windowed = new Float32Array(N);

        for (let n = 0; n < N; n++) {
            const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
            windowed[n] = signal[n] * w;
        }

        return windowed;
    }

    function computeDFTMagnitude(signal, sampleRate) {
        const N = signal.length;
        const halfN = Math.floor(N / 2);

        const frequencies = [];
        const magnitudes = [];

        for (let k = 0; k < halfN; k++) {
            let real = 0;
            let imag = 0;

            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                real += signal[n] * Math.cos(angle);
                imag -= signal[n] * Math.sin(angle);
            }

            const magnitude = Math.sqrt(real * real + imag * imag) / N;
            const frequency = (k * sampleRate) / N;

            frequencies.push(frequency);
            magnitudes.push(magnitude);
        }

        return { frequencies, magnitudes };
    }

    function findDominantPeaks(filteredData, maxPeaks = 5, minSeparationHz = 120) {
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

            if (isLocalPeak && isStrongEnough) {
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

            fftCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
            fftCtx.fillRect(boxX, boxY, boxWidth, boxHeight);

            fftCtx.strokeStyle = "#cbd5e1";
            fftCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

            fftCtx.fillStyle = "#111827";
            fftCtx.fillText(label, x, boxY + 14);
        });

        fftCtx.restore();
    }

    function drawFFT(audioBuffer) {
        if (!audioBuffer) return;

        resizeCanvasToDisplaySize(fftCanvas);
        clearCanvas(fftCtx, fftCanvas);

        const { visibleData, sampleRate } = getVisibleChannelData(audioBuffer);

        if (visibleData.length < 64) {
            drawEmptyState(fftCtx, fftCanvas, "La ventana temporal es demasiado pequeña para calcular la FFT");
            return;
        }

        const N = Math.min(2048, visibleData.length);
        const fftInput = visibleData.slice(0, N);
        const windowedSignal = applyHannWindow(fftInput);
        const { frequencies, magnitudes } = computeDFTMagnitude(windowedSignal, sampleRate);

        const fftMaxFrequency = getValidatedFftMaxFrequency(sampleRate);

        const filteredData = frequencies
            .map((freq, i) => ({ freq, mag: magnitudes[i] }))
            .filter(point => point.freq <= fftMaxFrequency);

        if (filteredData.length === 0) {
            drawEmptyState(fftCtx, fftCanvas, "No hay datos espectrales en el rango seleccionado");
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
        const plotWidth = fftCanvas.width - padding.left - padding.right;
        const plotHeight = fftCanvas.height - padding.top - padding.bottom;
        const plotBottom = plotTop + plotHeight;

        drawFftAxes(fftMaxFrequency, plotLeft, plotTop, plotWidth, plotHeight);

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

        const dominantPeaks = findDominantPeaks(filteredData, 5, 120);
        drawFftPeakLabels(
            dominantPeaks,
            fftMaxFrequency,
            maxMagnitude,
            plotLeft,
            plotBottom,
            plotWidth,
            plotHeight
        );
    }

    function renderPlots() {
        if (!currentAudioBuffer) return;
        drawWaveform(currentAudioBuffer);
        drawFFT(currentAudioBuffer);
        plotsRendered = true;
    }

    audioInput.addEventListener("change", async () => {
        const file = audioInput.files[0];
        if (!file) return;

        fileStatus.textContent = `Archivo cargado: ${file.name}`;
        metaName.textContent = file.name;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            currentAudioBuffer = audioBuffer;
            plotsRendered = false;

            metaDuration.textContent = formatTime(audioBuffer.duration);
            metaSampleRate.textContent = `${audioBuffer.sampleRate} Hz`;

            const channels = audioBuffer.numberOfChannels;
            metaChannels.textContent = channels === 1 ? "Mono" : `${channels} canales`;

            viewStartInput.value = "0";
            viewWindowInput.value = "10";
            fftMaxFrequencyInput.value = "5000";

            updateSliderBounds(audioBuffer);

            drawEmptyState(
                waveformCtx,
                waveformCanvas,
                "Carga un archivo y pulsa “Procesar audio” para ver la forma de onda"
            );

            drawEmptyState(
                fftCtx,
                fftCanvas,
                "Pulsa “Procesar audio” para ver el espectro de frecuencia"
            );
        } catch (error) {
            console.error(error);
            fileStatus.textContent = "Error al procesar el archivo.";
            currentAudioBuffer = null;
            plotsRendered = false;

            drawEmptyState(waveformCtx, waveformCanvas, "No se pudo cargar la forma de onda");
            drawEmptyState(fftCtx, fftCanvas, "No se pudo calcular la FFT");
        }
    });

    processButton.addEventListener("click", () => {
        if (!currentAudioBuffer) {
            fileStatus.textContent = "Primero debes cargar un archivo válido.";
            return;
        }

        renderPlots();
    });

    updateViewButton.addEventListener("click", () => {
        if (!currentAudioBuffer) {
            fileStatus.textContent = "Primero debes cargar un archivo válido.";
            return;
        }

        updateSliderBounds(currentAudioBuffer);
        renderPlots();
    });

    updateFftButton.addEventListener("click", () => {
        if (!currentAudioBuffer) {
            fileStatus.textContent = "Primero debes cargar un archivo válido.";
            return;
        }

        drawFFT(currentAudioBuffer);
    });

    viewSlider.addEventListener("input", () => {
        if (!currentAudioBuffer) return;

        viewStartInput.value = formatInputValue(parseFloat(viewSlider.value));

        if (plotsRendered) {
            renderPlots();
        }
    });

    viewWindowInput.addEventListener("change", () => {
        if (!currentAudioBuffer) return;

        updateSliderBounds(currentAudioBuffer);

        if (plotsRendered) {
            renderPlots();
        }
    });

    window.addEventListener("resize", () => {
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
                "Pulsa “Procesar audio” para ver el espectro de frecuencia"
            );
        }
    });

    drawEmptyState(
        waveformCtx,
        waveformCanvas,
        "Carga un archivo y pulsa “Procesar audio” para ver la forma de onda"
    );
    drawEmptyState(
        fftCtx,
        fftCanvas,
        "Pulsa “Procesar audio” para ver el espectro de frecuencia"
    );
});