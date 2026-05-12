import {
    resizeCanvasToDisplaySize,
    clearCanvas,
    drawEmptyState
} from "./audio-utils.js";

const DEG_TO_RAD = Math.PI / 180;

export function initOpticsPage() {
    const canvas = document.getElementById("optics-canvas");
    if (!canvas) return;

    const elements = {
        canvas,
        modeSelect: document.getElementById("optics-mode"),
        angleInput: document.getElementById("optics-angle"),
        angleOutput: document.getElementById("optics-angle-output"),
        n1Input: document.getElementById("optics-n1"),
        n2Input: document.getElementById("optics-n2"),
        wavelengthInput: document.getElementById("optics-wavelength"),
        wavelengthOutput: document.getElementById("optics-wavelength-output"),
        slitInput: document.getElementById("optics-slit"),
        slitOutput: document.getElementById("optics-slit-output"),
        statusOutput: document.getElementById("optics-status"),
        sceneTitle: document.getElementById("optics-scene-title"),
        technicalOutput: document.getElementById("optics-technical-output"),
        visualOutput: document.getElementById("optics-visual-output"),
        cautionOutput: document.getElementById("optics-caution-output")
    };

    const missingElement = Object.entries(elements).find(([, element]) => !element);
    if (missingElement) {
        console.warn(`AudioLab: falta el elemento requerido para óptica: ${missingElement[0]}`);
        return;
    }

    createOpticsController(elements).initialize();
}

function createOpticsController(elements) {
    const {
        canvas,
        modeSelect,
        angleInput,
        angleOutput,
        n1Input,
        n2Input,
        wavelengthInput,
        wavelengthOutput,
        slitInput,
        slitOutput,
        statusOutput,
        sceneTitle,
        technicalOutput,
        visualOutput,
        cautionOutput
    } = elements;

    const ctx = canvas.getContext("2d");

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function getState() {
        return {
            mode: modeSelect.value,
            angleDeg: Number(angleInput.value) || 0,
            n1: clamp(Number(n1Input.value) || 1, 1, 2.5),
            n2: clamp(Number(n2Input.value) || 1.5, 1, 2.5),
            wavelength: Number(wavelengthInput.value) || 520,
            slit: Number(slitInput.value) || 1.2
        };
    }

    function setStatus(message, type = "info") {
        statusOutput.classList.remove("info", "ok", "warning", "error");
        statusOutput.classList.add(type);
        statusOutput.textContent = message;
    }

    function wavelengthToColor(wavelength) {
        const ratio = clamp((wavelength - 380) / (700 - 380), 0, 1);
        const hue = 270 - ratio * 270;
        return `hsl(${hue}, 86%, 55%)`;
    }

    function drawArrow(x1, y1, x2, y2, color, width = 3) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = 11;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawBackground(width, height) {
        ctx.save();
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
        ctx.lineWidth = 1;
        for (let x = 36; x < width; x += 36) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 36; y < height; y += 36) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawAngleArc(cx, cy, startAngle, endAngle, radius, color, label) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle, false);
        ctx.stroke();
        const mid = (startAngle + endAngle) / 2;
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(label, cx + Math.cos(mid) * (radius + 18), cy + Math.sin(mid) * (radius + 18));
        ctx.restore();
    }

    function drawReflection(state, width, height) {
        const color = wavelengthToColor(state.wavelength);
        const cx = width / 2;
        const cy = height / 2;
        const mirrorX = cx;
        const angle = state.angleDeg * DEG_TO_RAD;
        const length = Math.min(width, height) * 0.34;

        ctx.save();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(mirrorX, cy - height * 0.32);
        ctx.lineTo(mirrorX, cy + height * 0.32);
        ctx.stroke();

        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - width * 0.34, cy);
        ctx.lineTo(cx + width * 0.34, cy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#334155";
        ctx.font = "12px Arial";
        ctx.fillText("normal", cx + 18, cy - 10);
        ctx.restore();

        const startX = cx - Math.cos(angle) * length;
        const startY = cy - Math.sin(angle) * length;
        const endX = cx + Math.cos(angle) * length;
        const endY = cy - Math.sin(angle) * length;

        drawArrow(startX, startY, cx, cy, color, 3);
        drawArrow(cx, cy, endX, endY, "#16a34a", 3);
        drawAngleArc(cx, cy, Math.PI, Math.PI + angle, 42, color, `θi ${state.angleDeg}°`);
        drawAngleArc(cx, cy, -angle, 0, 58, "#16a34a", `θr ${state.angleDeg}°`);

        sceneTitle.textContent = "Reflexión en superficie plana";
        technicalOutput.textContent = `El ángulo de incidencia y el de reflexión son iguales: θi = θr = ${state.angleDeg}°.`;
        visualOutput.textContent = "El rayo reflejado aparece simétrico respecto a la normal. El color representa una longitud de onda visual aproximada.";
        cautionOutput.textContent = "Este modelo usa rayos ideales y una superficie perfectamente plana.";
        setStatus("Reflexión: el rayo rebota conservando el ángulo respecto a la normal.", "ok");
    }

    function drawRefraction(state, width, height) {
        const color = wavelengthToColor(state.wavelength);
        const cx = width / 2;
        const cy = height / 2;
        const angle1 = state.angleDeg * DEG_TO_RAD;
        const sinTheta2 = (state.n1 / state.n2) * Math.sin(angle1);
        const totalInternal = Math.abs(sinTheta2) > 1;
        const theta2 = totalInternal ? angle1 : Math.asin(sinTheta2);
        const length = Math.min(width, height) * 0.34;

        ctx.save();
        ctx.fillStyle = "rgba(191, 219, 254, 0.38)";
        ctx.fillRect(0, 0, width, cy);
        ctx.fillStyle = "rgba(187, 247, 208, 0.38)";
        ctx.fillRect(0, cy, width, height - cy);
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.stroke();

        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = "#334155";
        ctx.beginPath();
        ctx.moveTo(cx, cy - height * 0.34);
        ctx.lineTo(cx, cy + height * 0.34);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#334155";
        ctx.font = "12px Arial";
        ctx.fillText(`Medio 1 · n=${state.n1.toFixed(2)}`, 24, 28);
        ctx.fillText(`Medio 2 · n=${state.n2.toFixed(2)}`, 24, cy + 28);
        ctx.restore();

        const startX = cx - Math.sin(angle1) * length;
        const startY = cy - Math.cos(angle1) * length;
        drawArrow(startX, startY, cx, cy, color, 3);
        drawAngleArc(cx, cy, -Math.PI / 2, -Math.PI / 2 - angle1, 42, color, `θ1 ${state.angleDeg}°`);

        if (totalInternal) {
            const reflectedX = cx + Math.sin(angle1) * length;
            const reflectedY = cy - Math.cos(angle1) * length;
            drawArrow(cx, cy, reflectedX, reflectedY, "#dc2626", 3);
            sceneTitle.textContent = "Refracción con reflexión interna total";
            technicalOutput.textContent = "Como n₁ es mayor que n₂ y el ángulo supera el límite crítico, no hay rayo refractado visible.";
            visualOutput.textContent = "El rayo se refleja dentro del primer medio. Este caso ocurre cuando la luz intenta pasar de un medio más denso a uno menos denso con ángulo alto.";
            cautionOutput.textContent = "La reflexión interna total se muestra de forma conceptual; no se modelan pérdidas ni polarización.";
            setStatus("Refracción: se presenta reflexión interna total.", "warning");
        } else {
            const endX = cx + Math.sin(theta2) * length;
            const endY = cy + Math.cos(theta2) * length;
            drawArrow(cx, cy, endX, endY, "#16a34a", 3);
            drawAngleArc(cx, cy, Math.PI / 2, Math.PI / 2 - theta2, 58, "#16a34a", `θ2 ${(theta2 / DEG_TO_RAD).toFixed(1)}°`);
            sceneTitle.textContent = "Refracción entre dos medios";
            technicalOutput.textContent = `Ley de Snell: n₁·sin(θ₁)=n₂·sin(θ₂). Resultado: θ₂≈${(theta2 / DEG_TO_RAD).toFixed(1)}°.`;
            visualOutput.textContent = state.n2 > state.n1
                ? "Al entrar a un medio con mayor índice, el rayo se acerca a la normal."
                : "Al entrar a un medio con menor índice, el rayo se aleja de la normal.";
            cautionOutput.textContent = "El modelo considera medios homogéneos y una frontera plana entre ellos.";
            setStatus("Refracción: el rayo cambia de dirección según los índices de los medios.", "ok");
        }
    }

    function sinc(x) {
        if (Math.abs(x) < 1e-6) return 1;
        return Math.sin(x) / x;
    }

    function drawDiffraction(state, width, height) {
        const color = wavelengthToColor(state.wavelength);
        const cx = width * 0.38;
        const cy = height / 2;
        const slitHalf = 24 + state.slit * 10;
        const screenX = width * 0.82;

        ctx.save();
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx, 34);
        ctx.lineTo(cx, cy - slitHalf);
        ctx.moveTo(cx, cy + slitHalf);
        ctx.lineTo(cx, height - 34);
        ctx.stroke();

        ctx.strokeStyle = "rgba(37, 99, 235, 0.28)";
        ctx.lineWidth = 2;
        for (let x = 34; x < cx - 12; x += 28) {
            ctx.beginPath();
            ctx.moveTo(x, cy - height * 0.30);
            ctx.lineTo(x, cy + height * 0.30);
            ctx.stroke();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        const spread = clamp(2.4 / state.slit, 0.38, 2.6);
        for (let r = 38; r < width * 0.55; r += 34) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, -spread / 2, spread / 2);
            ctx.stroke();
        }

        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX, 36);
        ctx.lineTo(screenX, height - 36);
        ctx.stroke();

        for (let y = 44; y <= height - 44; y += 3) {
            const normalizedY = (y - cy) / (height * 0.35);
            const beta = Math.PI * state.slit * normalizedY;
            const intensity = sinc(beta) ** 2;
            const bar = intensity * 64;
            ctx.strokeStyle = `rgba(124, 58, 237, ${0.15 + intensity * 0.75})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screenX, y);
            ctx.lineTo(screenX + bar, y);
            ctx.stroke();
        }

        ctx.fillStyle = "#334155";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("abertura", cx, cy + slitHalf + 24);
        ctx.fillText("patrón conceptual", screenX + 38, 26);
        ctx.restore();

        sceneTitle.textContent = "Difracción por una abertura";
        technicalOutput.textContent = `Abertura ≈ ${state.slit.toFixed(2)}λ. Mientras más pequeña es la abertura respecto a λ, mayor es la expansión angular.`;
        visualOutput.textContent = "Los frentes planos se convierten en frentes curvos al pasar por la abertura. A la derecha se sugiere el patrón de intensidad.";
        cautionOutput.textContent = "El patrón usa una aproximación visual tipo rendija simple; no modela todas las condiciones de laboratorio.";
        setStatus("Difracción: la abertura transforma los frentes de onda y genera dispersión.", "ok");
    }

    function render() {
        const state = getState();
        angleOutput.textContent = `${Math.round(state.angleDeg)}°`;
        wavelengthOutput.textContent = `${Math.round(state.wavelength)} nm`;
        slitOutput.textContent = `${state.slit.toFixed(2)} λ`;

        const { width, height } = resizeCanvasToDisplaySize(canvas);
        clearCanvas(ctx, canvas);

        if (width < 100 || height < 100) {
            drawEmptyState(ctx, canvas, "El área de simulación es demasiado pequeña");
            return;
        }

        drawBackground(width, height);

        if (state.mode === "refraction") {
            drawRefraction(state, width, height);
        } else if (state.mode === "diffraction") {
            drawDiffraction(state, width, height);
        } else {
            drawReflection(state, width, height);
        }
    }

    function applyPreset(presetName) {
        const presets = {
            mirror: { mode: "reflection", angle: 35, n1: 1, n2: 1.5, wavelength: 520, slit: 1.2 },
            "air-glass": { mode: "refraction", angle: 42, n1: 1, n2: 1.5, wavelength: 500, slit: 1.2 },
            "glass-air": { mode: "refraction", angle: 48, n1: 1.5, n2: 1, wavelength: 610, slit: 1.2 },
            "narrow-slit": { mode: "diffraction", angle: 30, n1: 1, n2: 1.5, wavelength: 560, slit: 0.7 }
        };

        const preset = presets[presetName];
        if (!preset) return;

        modeSelect.value = preset.mode;
        angleInput.value = preset.angle;
        n1Input.value = preset.n1;
        n2Input.value = preset.n2;
        wavelengthInput.value = preset.wavelength;
        slitInput.value = preset.slit;
        render();
    }

    function initialize() {
        [modeSelect, angleInput, n1Input, n2Input, wavelengthInput, slitInput].forEach(element => {
            element.addEventListener("input", render);
            element.addEventListener("change", render);
        });

        document.querySelectorAll("[data-optics-preset]").forEach(button => {
            button.addEventListener("click", () => applyPreset(button.dataset.opticsPreset));
        });

        window.addEventListener("resize", render);
        render();
    }

    return { initialize };
}