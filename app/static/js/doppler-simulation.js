import {
    resizeCanvasToDisplaySize,
    clearCanvas,
    getCanvasDisplaySize
} from "./audio-utils.js";

import {
    clearStoredAnalysisAudioFile,
    formatStoredAudioSummary,
    getStoredAnalysisAudioFile
} from "./audio-store.js";

export function initDopplerSimulation() {
    const canvas = document.getElementById("doppler-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const frequencyInput = document.getElementById("source-frequency");
    const speedInput = document.getElementById("source-speed");
    const toggleButton = document.getElementById("toggle-doppler-btn");
    const resetButton = document.getElementById("reset-doppler-btn");

    const sourceModeTone = document.getElementById("source-mode-tone");
    const sourceModeUploaded = document.getElementById("source-mode-uploaded");
    const storedAudioStatus = document.getElementById("stored-audio-status");
    const refreshStoredAudioButton = document.getElementById("refresh-stored-audio-btn");
    const clearStoredAudioButton = document.getElementById("clear-stored-audio-btn");

    const intensityInput = document.getElementById("source-intensity");
    const intensityValueOutput = document.getElementById("source-intensity-value");
    const pitchInput = document.getElementById("source-pitch");
    const pitchValueOutput = document.getElementById("source-pitch-value");
    const autoDopplerAudioInput = document.getElementById("auto-doppler-audio");
    const autoDistanceGainInput = document.getElementById("auto-distance-gain");
    const toggleAudioButton = document.getElementById("toggle-doppler-audio-btn");
    const audioStatus = document.getElementById("doppler-audio-status");

    const emittedFrequencyOutput = document.getElementById("doppler-emitted-frequency");
    const perceivedFrequencyOutput = document.getElementById("doppler-perceived-frequency");
    const distanceOutput = document.getElementById("doppler-distance");
    const intensityOutput = document.getElementById("doppler-intensity");
    const interpretationOutput = document.getElementById("doppler-interpretation");
    const liveCaptionOutput = document.getElementById("doppler-live-caption");

    const lamp = document.getElementById("intensity-lamp");
    const lampIntensityLabel = document.getElementById("lamp-intensity-label");
    const spectrumCanvas = document.getElementById("doppler-spectrum-canvas");
    const spectrumCtx = spectrumCanvas ? spectrumCanvas.getContext("2d") : null;

    const requiredElements = [
        frequencyInput,
        speedInput,
        toggleButton,
        resetButton,
        emittedFrequencyOutput,
        perceivedFrequencyOutput,
        distanceOutput,
        intensityOutput
    ];

    if (requiredElements.some(element => !element)) return;

    const SPEED_OF_SOUND = 343;
    const PIXELS_PER_METER = 8;
    const MIN_DISTANCE_M = 1;

    // Escala visual: no representa tiempo real físico. Hace que las ondas sean legibles.
    const VISUAL_WAVE_SPEED_PX = SPEED_OF_SOUND * PIXELS_PER_METER * 0.12;
    const MAX_WAVE_RADIUS = 900;
    const MAX_WAVEFRONTS = 34;
    const MAX_TRAIL_POINTS = 42;
    const MIN_WAVE_ALPHA = 0.035;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    let observer = { x: 0, y: 0 };
    let source = { x: 0, y: 0 };
    let animationId = null;
    let isRunning = false;
    let lastTime = null;
    let simulationTime = 0;
    let timeSinceLastWave = 0;

    let wavefronts = [];
    let sourceTrail = [];
    let waveCounter = 0;

    let audioContext = null;
    let activeOscillator = null;
    let activeBufferSource = null;
    let activeGainNode = null;
    let isAudioPlaying = false;
    let storedAudioRecord = null;
    let decodedStoredAudio = null;

    const visualState = {
        emittedFrequency: 440,
        perceivedFrequency: 440,
        lampLevel: 0.35,
        observerPulse: 0,
        sourceGlow: 0.45
    };

    function getCanvasSize() {
        return getCanvasDisplaySize(canvas);
    }

    function clampNumber(value, fallback, min, max = Number.POSITIVE_INFINITY) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(max, Math.max(min, parsed));
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function lerp(current, target, factor) {
        return current + (target - current) * factor;
    }

    function getSmoothFactor(deltaSeconds, strength = 8) {
        const dt = clamp(deltaSeconds, 0, 0.08);
        return 1 - Math.exp(-strength * dt);
    }

    function resetPositions() {
        const { width, height } = resizeCanvasToDisplaySize(canvas);

        observer.x = width / 2;
        observer.y = height / 2;

        source.x = width * 0.20;
        source.y = height / 2;

        simulationTime = 0;
        timeSinceLastWave = 0;
        sourceTrail = [];
        seedWavefronts();
    }

    function getSourceMode() {
        return sourceModeUploaded?.checked ? "uploaded" : "tone";
    }

    function getEmittedFrequency() {
        return clampNumber(frequencyInput.value, 440, 20, 20000);
    }

    function getSourceSpeed() {
        return clampNumber(speedInput.value, 0, -120, 120);
    }

    function getSourceVelocityPx() {
        return getSourceSpeed() * PIXELS_PER_METER;
    }

    function getManualIntensity() {
        return clampNumber(intensityInput?.value, 70, 0, 100) / 100;
    }

    function getManualPitchFactor() {
        return clampNumber(pitchInput?.value, 1, 0.5, 1.5);
    }

    function getDistanceMeters() {
        const dx = observer.x - source.x;
        const dy = observer.y - source.y;
        const distancePixels = Math.sqrt(dx * dx + dy * dy);
        return Math.max(distancePixels / PIXELS_PER_METER, MIN_DISTANCE_M);
    }

    function getRadialVelocity() {
        const speed = getSourceSpeed();
        return source.x < observer.x ? speed : -speed;
    }

    function getPerceivedFrequency() {
        const emittedFrequency = getEmittedFrequency();
        const radialVelocity = getRadialVelocity();
        const denominator = SPEED_OF_SOUND - radialVelocity;

        if (denominator <= 1) return emittedFrequency;

        return emittedFrequency * SPEED_OF_SOUND / denominator;
    }

    function getDopplerRatio() {
        const emittedFrequency = getEmittedFrequency();
        if (emittedFrequency <= 0) return 1;
        return clamp(getPerceivedFrequency() / emittedFrequency, 0.4, 2.2);
    }

    function getEffectivePitchFactor() {
        const manualPitch = getManualPitchFactor();
        const dopplerFactor = autoDopplerAudioInput?.checked ? getDopplerRatio() : 1;
        return clamp(manualPitch * dopplerFactor, 0.35, 2.4);
    }

    function getRelativeIntensity(distanceM) {
        return 1 / (distanceM * distanceM);
    }

    function getRelativeDb(intensity) {
        return 10 * Math.log10(Math.max(intensity, 1e-12));
    }

    function getDistanceVolumeFactor(distanceM) {
        if (!autoDistanceGainInput?.checked) return 1;
        return clamp(12 / Math.max(distanceM, MIN_DISTANCE_M), 0.08, 1);
    }

    function getEffectiveGain(distanceM) {
        const manualIntensity = getManualIntensity();
        return clamp(manualIntensity * getDistanceVolumeFactor(distanceM), 0, 1);
    }

    function getVisualWaveInterval() {
        // Una frecuencia mayor emite más frentes visuales, sin intentar dibujar ciclos reales por segundo.
        const frequency = getEmittedFrequency();
        const normalized = clamp((Math.log10(frequency) - Math.log10(80)) / (Math.log10(2200) - Math.log10(80)), 0, 1);
        return 0.58 - normalized * 0.32;
    }

    function getWaveColor() {
        const diff = getPerceivedFrequency() - getEmittedFrequency();
        const speed = getSourceSpeed();

        if (Math.abs(speed) < 0.5) return { r: 37, g: 99, b: 235 };
        if (diff > 0) return { r: 22, g: 163, b: 74 };
        return { r: 220, g: 38, b: 38 };
    }

    function colorWithAlpha(color, alpha) {
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    }

    function setStatus(element, message, type = "info") {
        if (!element) return;

        element.classList.remove("info", "ok", "warning", "error");
        element.classList.add(type);
        element.textContent = message;
    }

    function updateRangeLabels() {
        if (intensityValueOutput) {
            intensityValueOutput.textContent = `${Math.round(getManualIntensity() * 100)}%`;
        }

        if (pitchValueOutput) {
            const factor = getManualPitchFactor();
            let label = `${factor.toFixed(2)}×`;
            if (factor < 0.98) label += " · más grave";
            if (factor > 1.02) label += " · más agudo";
            pitchValueOutput.textContent = label;
        }
    }

    async function ensureAudioContext() {
        if (!AudioContextClass) {
            throw new Error("Este navegador no permite usar Web Audio API.");
        }

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        return audioContext;
    }

    async function refreshStoredAudio() {
        try {
            storedAudioRecord = await getStoredAnalysisAudioFile();
            decodedStoredAudio = null;

            if (!storedAudioRecord) {
                if (sourceModeUploaded) sourceModeUploaded.disabled = false;
                setStatus(storedAudioStatus, "No hay audio cargado desde Análisis. Puedes usar el tono sintético o cargar un archivo primero.", "warning");
                return null;
            }

            setStatus(storedAudioStatus, formatStoredAudioSummary(storedAudioRecord), "ok");
            return storedAudioRecord;
        } catch (error) {
            console.warn("AudioLab: no se pudo leer el audio almacenado.", error);
            storedAudioRecord = null;
            decodedStoredAudio = null;
            setStatus(storedAudioStatus, "No se pudo leer el audio compartido desde el navegador.", "error");
            return null;
        }
    }

    async function getDecodedStoredAudio() {
        if (decodedStoredAudio) return decodedStoredAudio;

        if (!storedAudioRecord) {
            await refreshStoredAudio();
        }

        if (!storedAudioRecord) {
            throw new Error("No hay audio cargado desde Análisis.");
        }

        const ctxAudio = await ensureAudioContext();
        decodedStoredAudio = await ctxAudio.decodeAudioData(storedAudioRecord.arrayBuffer.slice(0));
        return decodedStoredAudio;
    }

    function stopAudio() {
        if (activeOscillator) {
            try { activeOscillator.stop(); } catch (_) { /* node already stopped */ }
            activeOscillator.disconnect();
            activeOscillator = null;
        }

        if (activeBufferSource) {
            try { activeBufferSource.stop(); } catch (_) { /* node already stopped */ }
            activeBufferSource.disconnect();
            activeBufferSource = null;
        }

        if (activeGainNode) {
            activeGainNode.disconnect();
            activeGainNode = null;
        }

        isAudioPlaying = false;
        if (toggleAudioButton) toggleAudioButton.textContent = "Reproducir fuente";
        setStatus(audioStatus, "El sonido está detenido.", "info");
    }

    function updateAudioEngine() {
        if (!isAudioPlaying || !audioContext || !activeGainNode) return;

        const now = audioContext.currentTime;
        const distanceM = getDistanceMeters();
        const gainValue = getEffectiveGain(distanceM);
        const pitchFactor = getEffectivePitchFactor();

        activeGainNode.gain.setTargetAtTime(gainValue, now, 0.055);

        if (activeOscillator) {
            const perceivedFrequency = getEmittedFrequency() * pitchFactor;
            activeOscillator.frequency.setTargetAtTime(perceivedFrequency, now, 0.055);
        }

        if (activeBufferSource) {
            activeBufferSource.playbackRate.setTargetAtTime(pitchFactor, now, 0.055);
        }
    }

    async function startToneAudio() {
        const ctxAudio = await ensureAudioContext();
        const oscillator = ctxAudio.createOscillator();
        const gainNode = ctxAudio.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = getEmittedFrequency() * getEffectivePitchFactor();
        gainNode.gain.value = getEffectiveGain(getDistanceMeters());

        oscillator.connect(gainNode);
        gainNode.connect(ctxAudio.destination);
        oscillator.start();

        activeOscillator = oscillator;
        activeGainNode = gainNode;
        isAudioPlaying = true;

        oscillator.onended = () => {
            if (activeOscillator === oscillator) stopAudio();
        };

        setStatus(audioStatus, "Reproduciendo tono sintético con los controles actuales.", "ok");
    }

    async function startUploadedAudio() {
        const ctxAudio = await ensureAudioContext();
        const audioBuffer = await getDecodedStoredAudio();
        const sourceNode = ctxAudio.createBufferSource();
        const gainNode = ctxAudio.createGain();

        sourceNode.buffer = audioBuffer;
        sourceNode.loop = true;
        sourceNode.playbackRate.value = getEffectivePitchFactor();
        gainNode.gain.value = getEffectiveGain(getDistanceMeters());

        sourceNode.connect(gainNode);
        gainNode.connect(ctxAudio.destination);
        sourceNode.start();

        activeBufferSource = sourceNode;
        activeGainNode = gainNode;
        isAudioPlaying = true;

        sourceNode.onended = () => {
            if (activeBufferSource === sourceNode) stopAudio();
        };

        setStatus(audioStatus, "Reproduciendo audio cargado desde Análisis con tono e intensidad modificables.", "ok");
    }

    async function toggleAudioPlayback() {
        if (isAudioPlaying) {
            stopAudio();
            return;
        }

        stopAudio();

        try {
            if (getSourceMode() === "uploaded") {
                await startUploadedAudio();
            } else {
                await startToneAudio();
            }

            if (toggleAudioButton) toggleAudioButton.textContent = "Detener fuente";
            updateAudioEngine();
        } catch (error) {
            console.warn("AudioLab: no se pudo iniciar la fuente sonora.", error);
            setStatus(audioStatus, error.message || "No se pudo iniciar la reproducción.", "error");
            if (sourceModeTone) sourceModeTone.checked = true;
            stopAudio();
        }
    }

    function emitWavefront(originX = source.x, originY = source.y, birthTime = simulationTime, initialReachedObserver = false) {
        const color = getWaveColor();
        wavefronts.push({
            id: waveCounter,
            x: originX,
            y: originY,
            birthTime,
            radius: Math.max(0, (simulationTime - birthTime) * VISUAL_WAVE_SPEED_PX),
            previousRadius: 0,
            reachedObserver: initialReachedObserver,
            color
        });
        waveCounter += 1;

        if (wavefronts.length > MAX_WAVEFRONTS) {
            wavefronts = wavefronts.slice(-MAX_WAVEFRONTS);
        }
    }

    function seedWavefronts() {
        wavefronts = [];
        const interval = getVisualWaveInterval();
        const velocityPx = getSourceVelocityPx();
        const maxAge = 2.55;
        const count = Math.min(MAX_WAVEFRONTS, Math.ceil(maxAge / interval));

        for (let i = count; i >= 1; i--) {
            const age = i * interval;
            const originX = source.x - velocityPx * age;
            const originY = source.y;
            const birthTime = simulationTime - age;
            emitWavefront(originX, originY, birthTime, true);
        }

        timeSinceLastWave = 0;
    }

    function updateWavefronts(deltaSeconds) {
        const waveSpeedStep = VISUAL_WAVE_SPEED_PX * clamp(deltaSeconds, 0, 0.1);

        wavefronts = wavefronts
            .map(wave => {
                const age = Math.max(0, simulationTime - wave.birthTime);
                const previousRadius = wave.radius;
                const radius = age * VISUAL_WAVE_SPEED_PX;
                const dx = observer.x - wave.x;
                const dy = observer.y - wave.y;
                const observerDistance = Math.sqrt(dx * dx + dy * dy);

                if (!wave.reachedObserver && previousRadius + waveSpeedStep >= observerDistance && radius >= observerDistance) {
                    visualState.observerPulse = 1;
                    return { ...wave, radius, previousRadius, reachedObserver: true };
                }

                return { ...wave, radius, previousRadius };
            })
            .filter(wave => {
                const alpha = getWaveAlpha(wave.radius);
                return wave.radius < MAX_WAVE_RADIUS && alpha > MIN_WAVE_ALPHA;
            });
    }

    function emitWavesDuringFrame(deltaSeconds) {
        if (!isRunning) return;

        timeSinceLastWave += deltaSeconds;
        const interval = getVisualWaveInterval();
        let safety = 0;

        while (timeSinceLastWave >= interval && safety < 6) {
            timeSinceLastWave -= interval;
            emitWavefront();
            visualState.sourceGlow = 1;
            safety += 1;
        }
    }

    function updateSourceTrail() {
        if (!isRunning) return;

        sourceTrail.push({ x: source.x, y: source.y, time: simulationTime });
        if (sourceTrail.length > MAX_TRAIL_POINTS) {
            sourceTrail = sourceTrail.slice(-MAX_TRAIL_POINTS);
        }
    }

    function getWaveAlpha(radius) {
        const fadeStart = MAX_WAVE_RADIUS * 0.18;
        const fadeEnd = MAX_WAVE_RADIUS;
        const distanceFade = 1 - clamp((radius - fadeStart) / (fadeEnd - fadeStart), 0, 1);
        return clamp(0.30 * distanceFade, 0, 0.30);
    }

    function updateVisualState(deltaSeconds) {
        const smooth = getSmoothFactor(deltaSeconds, 9);
        const distanceM = getDistanceMeters();
        const targetLampLevel = clamp(12 / Math.max(distanceM, MIN_DISTANCE_M), 0.12, 1);

        visualState.emittedFrequency = lerp(visualState.emittedFrequency, getEmittedFrequency(), smooth);
        visualState.perceivedFrequency = lerp(visualState.perceivedFrequency, getPerceivedFrequency(), smooth);
        visualState.lampLevel = lerp(visualState.lampLevel, targetLampLevel, smooth);
        visualState.observerPulse = Math.max(0, visualState.observerPulse - deltaSeconds * 2.6);
        visualState.sourceGlow = Math.max(0.42, visualState.sourceGlow - deltaSeconds * 2.2);
    }

    function generateDopplerInterpretation(emittedFrequency, perceivedFrequency, distanceM, speed, sourceMode) {
        const diff = perceivedFrequency - emittedFrequency;
        const absDiff = Math.abs(diff);

        let technical = "";
        let perceptual = "";
        let caution = "La simulación usa un modelo simplificado: observador fijo, fuente móvil y velocidad del sonido constante.";

        if (sourceMode === "uploaded") {
            caution += " En audio cargado, el cambio de frecuencia se aproxima mediante velocidad de reproducción, por lo que cambia el tono global del archivo.";
        }

        if (Math.abs(speed) < 0.5) {
            technical = "La fuente está prácticamente en reposo respecto al observador. Los frentes de onda se expanden de forma casi simétrica.";
            perceptual = "En esta condición, el cambio de altura tonal sería mínimo; la distancia es el factor que más afecta la intensidad relativa.";
        } else if (absDiff < 1) {
            technical = "El cambio de frecuencia percibida es muy pequeño para los valores actuales.";
            perceptual = "El efecto Doppler sería débil y probablemente difícil de distinguir de forma auditiva.";
        } else if (diff > 0) {
            technical = "La fuente se acerca al observador. Cada frente de onda nace desde una posición distinta y llega más junto al observador.";
            perceptual = "El sonido tendería a percibirse más agudo mientras la fuente se aproxima. El pico conceptual del espectro se desplaza hacia la derecha.";
        } else {
            technical = "La fuente se aleja del observador. Los frentes emitidos llegan más separados y la frecuencia percibida disminuye.";
            perceptual = "El sonido tendería a percibirse más grave mientras la fuente se aleja. El pico conceptual del espectro se desplaza hacia la izquierda.";
        }

        if (distanceM < 15) {
            perceptual += " Además, la fuente está cerca, por lo que la intensidad relativa y el brillo de la lámpara son altos.";
        } else if (distanceM < 35) {
            perceptual += " La distancia es intermedia, por lo que la intensidad relativa se mantiene en un nivel moderado.";
        } else {
            perceptual += " La fuente está lejos, por lo que la intensidad relativa disminuye de forma notable.";
        }

        return { technical, perceptual, caution };
    }

    function renderDopplerInterpretation(sections) {
        return `
            <div class="doppler-interpretation-grid">
                <div>
                    <span>Observación técnica</span>
                    <p>${sections.technical}</p>
                </div>
                <div>
                    <span>Lectura perceptual</span>
                    <p>${sections.perceptual}</p>
                </div>
                <div class="caution">
                    <span>Precaución</span>
                    <p>${sections.caution}</p>
                </div>
            </div>
        `;
    }

    function drawSpaceGrid(width, height) {
        ctx.save();
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
        ctx.lineWidth = 1;

        const step = 38;
        for (let x = step; x < width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let y = step; y < height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        const gradient = ctx.createRadialGradient(observer.x, observer.y, 12, observer.x, observer.y, Math.max(width, height) * 0.65);
        gradient.addColorStop(0, "rgba(219, 234, 254, 0.35)");
        gradient.addColorStop(1, "rgba(248, 250, 252, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.restore();
    }

    function drawSourceTrail() {
        if (sourceTrail.length < 2) return;

        ctx.save();

        for (let i = 1; i < sourceTrail.length; i++) {
            const previous = sourceTrail[i - 1];
            const current = sourceTrail[i];
            const age = simulationTime - current.time;
            const alpha = clamp(0.18 * (1 - age / 1.8), 0, 0.18);

            if (alpha <= 0) continue;

            ctx.beginPath();
            ctx.moveTo(previous.x, previous.y);
            ctx.lineTo(current.x, current.y);
            ctx.strokeStyle = `rgba(15, 23, 42, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawObserver() {
        ctx.save();

        if (visualState.observerPulse > 0) {
            const pulseRadius = 18 + visualState.observerPulse * 38;
            ctx.beginPath();
            ctx.arc(observer.x, observer.y, pulseRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(37, 99, 235, ${0.28 * visualState.observerPulse})`;
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(observer.x, observer.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = "#111827";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(observer.x, observer.y, 23, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(15, 23, 42, 0.16)";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "#111827";
        ctx.font = "13px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Observador", observer.x, observer.y + 38);

        ctx.restore();
    }

    function drawSource() {
        const perceivedFrequency = getPerceivedFrequency();
        const emittedFrequency = getEmittedFrequency();
        const diff = perceivedFrequency - emittedFrequency;
        const speed = getSourceSpeed();
        const sourceMode = getSourceMode();

        let sourceColor = "#2563eb";
        let stateText = sourceMode === "uploaded" ? "Audio" : "Tono";

        if (Math.abs(speed) < 0.5) {
            sourceColor = "#2563eb";
            stateText += " · reposo";
        } else if (diff > 0) {
            sourceColor = "#16a34a";
            stateText += " · se acerca";
        } else {
            sourceColor = "#dc2626";
            stateText += " · se aleja";
        }

        ctx.save();

        const glowRadius = 28 + visualState.sourceGlow * 16;
        ctx.beginPath();
        ctx.arc(source.x, source.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = sourceColor;
        ctx.globalAlpha = 0.10 + visualState.sourceGlow * 0.12;
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(source.x, source.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = sourceColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(source.x, source.y, 27, 0, Math.PI * 2);
        ctx.strokeStyle = sourceColor;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.globalAlpha = 1;

        ctx.fillStyle = sourceColor;
        ctx.font = "13px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Fuente", source.x, source.y + 42);

        ctx.font = "12px Arial";
        ctx.fillText(stateText, source.x, source.y - 36);

        ctx.restore();
    }

    function drawWavefronts() {
        ctx.save();

        wavefronts.forEach(wave => {
            const alpha = getWaveAlpha(wave.radius);
            if (alpha <= MIN_WAVE_ALPHA) return;

            const lineWidth = 1.4 + clamp(1 - wave.radius / 420, 0, 1) * 1.1;

            ctx.beginPath();
            ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
            ctx.strokeStyle = colorWithAlpha(wave.color, alpha);
            ctx.lineWidth = lineWidth;
            ctx.stroke();

            if (wave.radius < 80) {
                ctx.beginPath();
                ctx.arc(wave.x, wave.y, wave.radius + 5, 0, Math.PI * 2);
                ctx.strokeStyle = colorWithAlpha(wave.color, alpha * 0.38);
                ctx.lineWidth = 5;
                ctx.stroke();
            }
        });

        ctx.restore();
    }

    function drawReferenceLine() {
        ctx.save();

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(observer.x, observer.y);
        ctx.strokeStyle = "rgba(100, 116, 139, 0.42)";
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const midX = (source.x + observer.x) / 2;
        const midY = (source.y + observer.y) / 2 - 12;
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(15, 23, 42, 0.58)";
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${getDistanceMeters().toFixed(1)} m`, midX, midY);

        ctx.restore();
    }

    function drawDirectionArrow() {
        const speed = getSourceSpeed();
        if (Math.abs(speed) < 0.5) return;

        const perceivedFrequency = getPerceivedFrequency();
        const emittedFrequency = getEmittedFrequency();
        const isApproaching = perceivedFrequency > emittedFrequency;
        const arrowColor = isApproaching ? "#16a34a" : "#dc2626";

        ctx.save();

        const arrowDirection = speed > 0 ? 1 : -1;
        const startX = source.x - 46 * arrowDirection;
        const endX = source.x + 46 * arrowDirection;
        const y = source.y - 52;

        ctx.strokeStyle = arrowColor;
        ctx.fillStyle = arrowColor;
        ctx.lineWidth = 2.8;

        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(endX, y);
        ctx.lineTo(endX - 10 * arrowDirection, y - 7);
        ctx.lineTo(endX - 10 * arrowDirection, y + 7);
        ctx.closePath();
        ctx.fill();

        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.abs(speed).toFixed(0)} m/s`, (startX + endX) / 2, y - 10);

        ctx.restore();
    }

    function updateLamp(distanceM, intensity) {
        if (!lamp) return;

        lamp.style.setProperty("--lamp-level", visualState.lampLevel.toFixed(3));

        if (lampIntensityLabel) {
            lampIntensityLabel.textContent = `Intensidad relativa: ${intensity.toFixed(4)}`;
        }
    }

    function drawDopplerSpectrum() {
        if (!spectrumCanvas || !spectrumCtx) return;

        const { width, height } = resizeCanvasToDisplaySize(spectrumCanvas);
        clearCanvas(spectrumCtx, spectrumCanvas);

        const emittedFrequency = visualState.emittedFrequency;
        const perceivedFrequency = visualState.perceivedFrequency;
        const maxFrequency = Math.max(1200, emittedFrequency * 1.8, perceivedFrequency * 1.8);

        const padding = { top: 26, right: 18, bottom: 32, left: 38 };
        const plotLeft = padding.left;
        const plotTop = padding.top;
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const plotBottom = plotTop + plotHeight;

        spectrumCtx.save();

        const gradient = spectrumCtx.createLinearGradient(plotLeft, 0, plotLeft + plotWidth, 0);
        gradient.addColorStop(0, "rgba(37, 99, 235, 0.16)");
        gradient.addColorStop(0.5, "rgba(22, 163, 74, 0.14)");
        gradient.addColorStop(1, "rgba(220, 38, 38, 0.14)");
        spectrumCtx.fillStyle = gradient;
        spectrumCtx.fillRect(plotLeft, plotTop, plotWidth, plotHeight);

        spectrumCtx.strokeStyle = "#cbd5e1";
        spectrumCtx.lineWidth = 1;
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(plotLeft, plotBottom);
        spectrumCtx.lineTo(plotLeft + plotWidth, plotBottom);
        spectrumCtx.moveTo(plotLeft, plotTop);
        spectrumCtx.lineTo(plotLeft, plotBottom);
        spectrumCtx.stroke();

        spectrumCtx.fillStyle = "#64748b";
        spectrumCtx.font = "11px Arial";
        spectrumCtx.textAlign = "center";
        spectrumCtx.fillText("bajas", plotLeft + plotWidth * 0.16, plotBottom + 20);
        spectrumCtx.fillText("medias", plotLeft + plotWidth * 0.50, plotBottom + 20);
        spectrumCtx.fillText("altas", plotLeft + plotWidth * 0.84, plotBottom + 20);

        function xFromFrequency(freq) {
            return plotLeft + clamp(freq / maxFrequency, 0, 1) * plotWidth;
        }

        function drawPeak(freq, color, label, heightRatio) {
            const x = xFromFrequency(freq);
            const peakHeight = plotHeight * heightRatio;

            spectrumCtx.strokeStyle = color;
            spectrumCtx.fillStyle = color;
            spectrumCtx.lineWidth = 3;
            spectrumCtx.beginPath();
            spectrumCtx.moveTo(x, plotBottom);
            spectrumCtx.lineTo(x, plotBottom - peakHeight);
            spectrumCtx.stroke();

            spectrumCtx.beginPath();
            spectrumCtx.arc(x, plotBottom - peakHeight, 5, 0, Math.PI * 2);
            spectrumCtx.fill();

            spectrumCtx.font = "12px Arial";
            spectrumCtx.textAlign = "center";
            spectrumCtx.fillText(label, x, plotBottom - peakHeight - 10);
        }

        const emittedX = xFromFrequency(emittedFrequency);
        const perceivedX = xFromFrequency(perceivedFrequency);
        const shiftColor = perceivedFrequency >= emittedFrequency ? "#16a34a" : "#dc2626";

        if (Math.abs(perceivedX - emittedX) > 3) {
            const arrowY = plotTop + 16;
            const direction = perceivedX > emittedX ? 1 : -1;
            spectrumCtx.strokeStyle = shiftColor;
            spectrumCtx.fillStyle = shiftColor;
            spectrumCtx.lineWidth = 2;
            spectrumCtx.beginPath();
            spectrumCtx.moveTo(emittedX, arrowY);
            spectrumCtx.lineTo(perceivedX, arrowY);
            spectrumCtx.stroke();
            spectrumCtx.beginPath();
            spectrumCtx.moveTo(perceivedX, arrowY);
            spectrumCtx.lineTo(perceivedX - 7 * direction, arrowY - 5);
            spectrumCtx.lineTo(perceivedX - 7 * direction, arrowY + 5);
            spectrumCtx.closePath();
            spectrumCtx.fill();
        }

        drawPeak(emittedFrequency, "#2563eb", "emitida", 0.64);
        drawPeak(perceivedFrequency, shiftColor, "percibida", 0.86);

        spectrumCtx.restore();
    }

    function updateLiveCaption(emittedFrequency, perceivedFrequency, speed) {
        if (!liveCaptionOutput) return;

        const diff = perceivedFrequency - emittedFrequency;
        const sourceModeLabel = getSourceMode() === "uploaded" ? "audio cargado" : "tono sintético";
        let message = "La fuente está casi quieta: los frentes de onda se expanden de manera casi uniforme alrededor del emisor.";

        if (Math.abs(speed) >= 0.5 && diff > 0) {
            message = `La fuente se acerca: los frentes emitidos desde posiciones anteriores llegan más juntos al observador y el ${sourceModeLabel} tiende a sonar más agudo.`;
        } else if (Math.abs(speed) >= 0.5 && diff < 0) {
            message = `La fuente se aleja: los frentes llegan más separados al observador y el ${sourceModeLabel} tiende a sonar más grave.`;
        }

        liveCaptionOutput.textContent = message;
    }

    function updateOutputs() {
        const emittedFrequency = getEmittedFrequency();
        const perceivedFrequency = getPerceivedFrequency();
        const distanceM = getDistanceMeters();
        const intensity = getRelativeIntensity(distanceM);
        const db = getRelativeDb(intensity);
        const speed = getSourceSpeed();
        const sourceMode = getSourceMode();

        emittedFrequencyOutput.textContent = `${Math.round(emittedFrequency)} Hz`;
        perceivedFrequencyOutput.textContent = `${perceivedFrequency.toFixed(1)} Hz`;
        distanceOutput.textContent = `${distanceM.toFixed(1)} m`;
        intensityOutput.textContent = `${intensity.toFixed(4)} (${db.toFixed(1)} dB rel.)`;

        updateRangeLabels();
        updateLamp(distanceM, intensity);
        drawDopplerSpectrum();
        updateAudioEngine();
        updateLiveCaption(emittedFrequency, perceivedFrequency, speed);

        if (interpretationOutput) {
            const sections = generateDopplerInterpretation(
                emittedFrequency,
                perceivedFrequency,
                distanceM,
                speed,
                sourceMode
            );
            interpretationOutput.innerHTML = renderDopplerInterpretation(sections);
        }
    }

    function drawScene(deltaSeconds = 0.016) {
        const { width, height } = resizeCanvasToDisplaySize(canvas);
        clearCanvas(ctx, canvas);

        updateVisualState(deltaSeconds);

        drawSpaceGrid(width, height);
        drawWavefronts();
        drawSourceTrail();
        drawReferenceLine();
        drawDirectionArrow();
        drawObserver();
        drawSource();
        updateOutputs();
    }

    function animate(timestamp) {
        if (!lastTime) lastTime = timestamp;

        const rawDelta = (timestamp - lastTime) / 1000;
        const deltaSeconds = clamp(rawDelta, 0.001, 0.08);
        lastTime = timestamp;
        simulationTime += deltaSeconds;

        const speed = getSourceSpeed();
        const { width } = getCanvasSize();
        source.x += speed * PIXELS_PER_METER * deltaSeconds;

        if (source.x > width - 40) {
            source.x = width - 40;
            speedInput.value = -Math.abs(speed);
            seedWavefronts();
        }

        if (source.x < 40) {
            source.x = 40;
            speedInput.value = Math.abs(speed);
            seedWavefronts();
        }

        emitWavesDuringFrame(deltaSeconds);
        updateWavefronts(deltaSeconds);
        updateSourceTrail();
        drawScene(deltaSeconds);

        if (isRunning) {
            animationId = requestAnimationFrame(animate);
        }
    }

    function startSimulation() {
        isRunning = true;
        lastTime = null;
        toggleButton.textContent = "Pausar simulación";
        animationId = requestAnimationFrame(animate);
    }

    function pauseSimulation() {
        isRunning = false;
        toggleButton.textContent = "Iniciar simulación";

        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    function handleSourceModeChange() {
        stopAudio();

        if (getSourceMode() === "uploaded" && !storedAudioRecord) {
            setStatus(audioStatus, "Seleccionaste audio cargado, pero todavía no hay archivo disponible desde Análisis.", "warning");
        } else if (getSourceMode() === "uploaded") {
            setStatus(audioStatus, "Audio cargado listo. Pulsa “Reproducir fuente” para escucharlo en la simulación.", "info");
        } else {
            setStatus(audioStatus, "Modo tono sintético listo.", "info");
        }

        seedWavefronts();
        drawScene();
    }

    function handleVisualParameterChange() {
        if (!isRunning) {
            seedWavefronts();
        }
        drawScene();
    }


    function applyDopplerPreset(presetName) {
        const presets = {
            approach: { frequency: 440, speed: 35, intensity: 75, pitch: 1, autoPitch: true, autoGain: true },
            away: { frequency: 440, speed: -35, intensity: 75, pitch: 1, autoPitch: true, autoGain: true },
            still: { frequency: 440, speed: 0, intensity: 60, pitch: 1, autoPitch: false, autoGain: true },
            fast: { frequency: 620, speed: 80, intensity: 80, pitch: 1, autoPitch: true, autoGain: true }
        };

        const preset = presets[presetName];
        if (!preset) return;

        frequencyInput.value = preset.frequency;
        speedInput.value = preset.speed;
        if (intensityInput) intensityInput.value = preset.intensity;
        if (pitchInput) pitchInput.value = preset.pitch;
        if (autoDopplerAudioInput) autoDopplerAudioInput.checked = preset.autoPitch;
        if (autoDistanceGainInput) autoDistanceGainInput.checked = preset.autoGain;

        pauseSimulation();
        resetPositions();
        updateRangeLabels();
        updateAudioEngine();
        drawScene();
        setStatus(audioStatus, "Preset aplicado. Puedes iniciar la simulación o reproducir la fuente sonora.", "info");
    }

    document.querySelectorAll("[data-doppler-preset]").forEach(button => {
        button.addEventListener("click", () => applyDopplerPreset(button.dataset.dopplerPreset));
    });

    frequencyInput.addEventListener("input", () => {
        handleVisualParameterChange();
        updateAudioEngine();
    });

    speedInput.addEventListener("input", handleVisualParameterChange);

    intensityInput?.addEventListener("input", () => {
        updateRangeLabels();
        updateAudioEngine();
        drawScene();
    });

    pitchInput?.addEventListener("input", () => {
        updateRangeLabels();
        updateAudioEngine();
        drawDopplerSpectrum();
    });

    autoDopplerAudioInput?.addEventListener("change", () => {
        updateAudioEngine();
        drawScene();
    });

    autoDistanceGainInput?.addEventListener("change", updateAudioEngine);

    sourceModeTone?.addEventListener("change", handleSourceModeChange);
    sourceModeUploaded?.addEventListener("change", handleSourceModeChange);

    toggleAudioButton?.addEventListener("click", toggleAudioPlayback);

    refreshStoredAudioButton?.addEventListener("click", async () => {
        await refreshStoredAudio();
        handleSourceModeChange();
    });

    clearStoredAudioButton?.addEventListener("click", async () => {
        stopAudio();
        try {
            await clearStoredAnalysisAudioFile();
            storedAudioRecord = null;
            decodedStoredAudio = null;
            if (sourceModeTone) sourceModeTone.checked = true;
            setStatus(storedAudioStatus, "Audio compartido limpiado. Puedes cargar otro archivo desde Análisis.", "info");
            setStatus(audioStatus, "Modo tono sintético listo.", "info");
        } catch (error) {
            console.warn("AudioLab: no se pudo limpiar el audio compartido.", error);
            setStatus(storedAudioStatus, "No se pudo limpiar el audio compartido.", "error");
        }
        seedWavefronts();
        drawScene();
    });

    toggleButton.addEventListener("click", () => {
        if (isRunning) {
            pauseSimulation();
        } else {
            startSimulation();
        }
    });

    resetButton.addEventListener("click", () => {
        pauseSimulation();
        resetPositions();
        drawScene();
    });

    window.addEventListener("resize", () => {
        resetPositions();
        drawScene();
    });

    window.addEventListener("beforeunload", stopAudio);

    refreshStoredAudio();
    updateRangeLabels();
    resetPositions();
    visualState.emittedFrequency = getEmittedFrequency();
    visualState.perceivedFrequency = getPerceivedFrequency();
    drawScene();
}