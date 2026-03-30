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

    const viewStartInput = document.getElementById("view-start");
    const viewWindowInput = document.getElementById("view-window");

    const waveformCanvas = document.getElementById("waveform-canvas");
    const waveformCtx = waveformCanvas.getContext("2d");

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    let currentAudioBuffer = null;
    let waveformRendered = false;

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
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

    function clearCanvas() {
        waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        waveformCtx.fillStyle = "#f8fafc";
        waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    }

    function drawEmptyState() {
        resizeCanvasToDisplaySize(waveformCanvas);
        clearCanvas();

        waveformCtx.fillStyle = "#64748b";
        waveformCtx.font = "16px Arial";
        waveformCtx.textAlign = "center";
        waveformCtx.textBaseline = "middle";
        waveformCtx.fillText(
            "Carga un archivo y pulsa “Procesar audio” para ver la forma de onda",
            waveformCanvas.width / 2,
            waveformCanvas.height / 2
        );
    }

    function drawAxes(startTime, endTime, plotLeft, plotTop, plotWidth, plotHeight) {
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

        // Eje X
        waveformCtx.beginPath();
        waveformCtx.moveTo(plotLeft, plotBottom);
        waveformCtx.lineTo(plotRight, plotBottom);
        waveformCtx.stroke();

        // Eje Y
        waveformCtx.beginPath();
        waveformCtx.moveTo(plotLeft, plotTop);
        waveformCtx.lineTo(plotLeft, plotBottom);
        waveformCtx.stroke();

        // Línea de cero
        waveformCtx.strokeStyle = "#94a3b8";
        waveformCtx.beginPath();
        waveformCtx.moveTo(plotLeft, middleY);
        waveformCtx.lineTo(plotRight, middleY);
        waveformCtx.stroke();

        // Ticks de tiempo
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

    function getValidatedViewRange(audioBuffer) {
        const totalDuration = audioBuffer.duration;

        let startTime = parseFloat(viewStartInput.value);
        let visibleDuration = parseFloat(viewWindowInput.value);

        if (Number.isNaN(startTime)) {
            startTime = 0;
        }

        if (Number.isNaN(visibleDuration) || visibleDuration <= 0) {
            visibleDuration = 10;
        }

        if (startTime < 0) {
            startTime = 0;
        }

        if (visibleDuration > totalDuration) {
            visibleDuration = totalDuration;
        }

        const maxStart = Math.max(0, totalDuration - visibleDuration);
        if (startTime > maxStart) {
            startTime = maxStart;
        }

        const endTime = startTime + visibleDuration;

        viewStartInput.value = startTime.toFixed(2).replace(/\.00$/, "");
        viewWindowInput.value = visibleDuration.toFixed(2).replace(/\.00$/, "");

        return { startTime, endTime };
    }

        function drawWaveform(audioBuffer) {
            if (!audioBuffer) return;

            resizeCanvasToDisplaySize(waveformCanvas);
            clearCanvas();

            const channelData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            const { startTime, endTime } = getValidatedViewRange(audioBuffer);

            const startSample = Math.floor(startTime * sampleRate);
            const endSample = Math.min(channelData.length, Math.floor(endTime * sampleRate));
            const visibleData = channelData.slice(startSample, endSample);

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

            drawAxes(startTime, endTime, plotLeft, plotTop, plotWidth, plotHeight);

            const samplesPerPixel = Math.max(1, Math.ceil(visibleData.length / plotWidth));

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
                    const sample = visibleData[i];
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

        audioInput.addEventListener("change", async () => {
            const file = audioInput.files[0];
            if (!file) return;

            fileStatus.textContent = `Archivo cargado: ${file.name}`;
            metaName.textContent = file.name;

            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                currentAudioBuffer = audioBuffer;
                waveformRendered = false;

                metaDuration.textContent = formatTime(audioBuffer.duration);
                metaSampleRate.textContent = `${audioBuffer.sampleRate} Hz`;

                const channels = audioBuffer.numberOfChannels;
                metaChannels.textContent = channels === 1 ? "Mono" : `${channels} canales`;

                viewStartInput.value = 0;
                viewWindowInput.value = 10;

                drawEmptyState();
            } catch (error) {
                console.error(error);
                fileStatus.textContent = "Error al procesar el archivo.";
                currentAudioBuffer = null;
                waveformRendered = false;
                drawEmptyState();
            }
    });

    processButton.addEventListener("click", () => {
        if (!currentAudioBuffer) {
            fileStatus.textContent = "Primero debes cargar un archivo válido.";
            return;
        }

        drawWaveform(currentAudioBuffer);
        waveformRendered = true;
    });

    updateViewButton.addEventListener("click", () => {
        if (!currentAudioBuffer) {
            fileStatus.textContent = "Primero debes cargar un archivo válido.";
            return;
        }

        drawWaveform(currentAudioBuffer);
        waveformRendered = true;
    });

    window.addEventListener("resize", () => {
        if (waveformRendered && currentAudioBuffer) {
            drawWaveform(currentAudioBuffer);
        } else {
            drawEmptyState();
        }
    });

    drawEmptyState();
});