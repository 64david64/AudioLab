export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatInputValue(value) {
    return Number(value.toFixed(2)).toString();
}

export function formatMagnitude(value) {
    return value.toFixed(5);
}

export function formatPercentage(value) {
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

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
}

export function clearCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function drawEmptyState(ctx, canvas, message) {
    resizeCanvasToDisplaySize(canvas);
    clearCanvas(ctx, canvas);

    ctx.fillStyle = "#64748b";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}