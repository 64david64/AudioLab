export function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatInputValue(value) {
    if (!Number.isFinite(value)) return "0";
    return Number(value.toFixed(2)).toString();
}

export function formatMagnitude(value) {
    if (!Number.isFinite(value)) return "0.00000";
    return value.toFixed(5);
}

export function formatPercentage(value) {
    if (!Number.isFinite(value)) return "0.0%";
    return `${(value * 100).toFixed(1)}%`;
}

export function applyHannWindow(signal) {
    const N = signal.length;
    const windowed = new Float32Array(N);

    if (N <= 1) return signal;

    for (let n = 0; n < N; n++) {
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
        windowed[n] = signal[n] * w;
    }

    return windowed;
}

export function computeDFTMagnitude(signal, sampleRate) {
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

export function frequencyToNote(freq) {
    if (!freq || freq <= 0) return "—";

    const A4 = 440;
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    const midi = Math.round(69 + 12 * Math.log2(freq / A4));
    const noteName = noteNames[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;

    return `${noteName}${octave}`;
}

export function resizeCanvasToDisplaySize(canvas) {
    const rect = canvas.getBoundingClientRect();
    const displayWidth = Math.max(300, Math.floor(rect.width));
    const displayHeight = Math.max(220, Math.floor(rect.height));
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    const pixelWidth = displayWidth * dpr;
    const pixelHeight = displayHeight * dpr;

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }

    canvas.dataset.logicalWidth = String(displayWidth);
    canvas.dataset.logicalHeight = String(displayHeight);

    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return {
        width: displayWidth,
        height: displayHeight,
        dpr
    };
}

export function getCanvasDisplaySize(canvas) {
    const width = Number(canvas.dataset.logicalWidth) || Math.max(300, Math.floor(canvas.getBoundingClientRect().width));
    const height = Number(canvas.dataset.logicalHeight) || Math.max(220, Math.floor(canvas.getBoundingClientRect().height));

    return { width, height };
}

export function clearCanvas(ctx, canvas) {
    const { width, height } = getCanvasDisplaySize(canvas);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);
}

export function drawEmptyState(ctx, canvas, message) {
    const { width, height } = resizeCanvasToDisplaySize(canvas);
    clearCanvas(ctx, canvas);

    ctx.fillStyle = "#64748b";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, width / 2, height / 2);
}