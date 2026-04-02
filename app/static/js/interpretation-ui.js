import { frequencyToNote, formatMagnitude, formatPercentage } from "./audio-utils.js";

export function classifyFrequencyBands(peaks) {
    const bands = {
        low: { count: 0, energy: 0 },
        mid: { count: 0, energy: 0 },
        high: { count: 0, energy: 0 }
    };

    if (!peaks || peaks.length === 0) return bands;

    peaks.forEach((peak) => {
        const f = peak.freq;
        const mag = peak.mag;

        if (f < 250) {
            bands.low.count += 1;
            bands.low.energy += mag;
        } else if (f < 2000) {
            bands.mid.count += 1;
            bands.mid.energy += mag;
        } else {
            bands.high.count += 1;
            bands.high.energy += mag;
        }
    });

    return bands;
}

export function normalizeBands(bands) {
    const totalEnergy = bands.low.energy + bands.mid.energy + bands.high.energy;

    if (totalEnergy <= 0) {
        return { low: 0, mid: 0, high: 0 };
    }

    return {
        low: bands.low.energy / totalEnergy,
        mid: bands.mid.energy / totalEnergy,
        high: bands.high.energy / totalEnergy
    };
}

export function getDominantBandKey(normalized) {
    let dominantBand = "mid";

    if (normalized.low > normalized.mid && normalized.low > normalized.high) {
        dominantBand = "low";
    } else if (normalized.high > normalized.mid && normalized.high > normalized.low) {
        dominantBand = "high";
    }

    return dominantBand;
}

export function renderDominantPeaks(container, peaks) {
    if (!container) return;

    if (!peaks || peaks.length === 0) {
        container.textContent = "No se detectaron picos dominantes en el rango seleccionado.";
        return;
    }

    const mainPeak = [...peaks].sort((a, b) => b.mag - a.mag)[0];

    container.innerHTML = peaks.map(peak => {
        const isMainPeak = peak === mainPeak;
        const mainBadge = isMainPeak ? `<span class="peak-badge">Pico principal</span>` : "";

        return `
            <div class="peak-item ${isMainPeak ? "is-main-peak" : ""}">
                <div class="peak-freq">
                    ${Math.round(peak.freq)} Hz
                    ${mainBadge}
                </div>
                <div class="peak-note">${frequencyToNote(peak.freq)}</div>
                <div class="peak-mag">Magnitud relativa: ${formatMagnitude(peak.mag)}</div>
            </div>
        `;
    }).join("");
}

export function highlightDominantBandCard(cards, dominantBand) {
    const cardList = [
        { key: "low", element: cards.bandCardLow },
        { key: "mid", element: cards.bandCardMid },
        { key: "high", element: cards.bandCardHigh }
    ];

    cardList.forEach(({ key, element }) => {
        if (!element) return;

        element.classList.remove("is-dominant", "low", "mid", "high");

        if (dominantBand && key === dominantBand) {
            element.classList.add("is-dominant", dominantBand);
        }
    });
}

export function buildInterpretationText(normalized, peaks) {
    if (!peaks || peaks.length === 0) {
        return "No hay suficientes picos detectados para generar una interpretación.";
    }

    if (peaks.length <= 2) {
        const mainPeak = peaks[0];
        const freq = Math.round(mainPeak.freq);
        const note = frequencyToNote(mainPeak.freq);

        return `Se detectan muy pocos componentes dominantes en esta ventana, lo que sugiere una señal simple o poco compleja. El componente principal se encuentra alrededor de ${freq} Hz (${note}).`;
    }

    const orderedBands = [
        { key: "low", label: "graves", value: normalized.low },
        { key: "mid", label: "medios", value: normalized.mid },
        { key: "high", label: "agudos", value: normalized.high }
    ].sort((a, b) => b.value - a.value);

    const strongest = orderedBands[0];
    const second = orderedBands[1];
    const weakest = orderedBands[2];

    const spread = strongest.value - weakest.value;

    const mainPeak = [...peaks].sort((a, b) => b.mag - a.mag)[0];
    const mainPeakFreq = Math.round(mainPeak.freq);
    const mainPeakNote = frequencyToNote(mainPeak.freq);

    let mainPeakBand = "mid";
    let mainPeakBandLabel = "medios";

    if (mainPeak.freq < 250) {
        mainPeakBand = "low";
        mainPeakBandLabel = "graves";
    } else if (mainPeak.freq < 2000) {
        mainPeakBand = "mid";
        mainPeakBandLabel = "medios";
    } else {
        mainPeakBand = "high";
        mainPeakBandLabel = "agudos";
    }

    let text = "";

    if (spread < 0.12) {
        text += "El contenido del espectro está muy distribuido entre las diferentes bandas, sin una predominancia clara. ";
        text += "Esto puede corresponder a una señal con características más homogéneas o sin componentes fuertemente dominantes. ";
    } else {
        if (strongest.value >= 0.60) {
            text += `Se observa un predominio claro de las frecuencias ${strongest.label}. `;
        } else if (strongest.value >= 0.45) {
            text += `Predominan las frecuencias ${strongest.label}, con cierta presencia de ${second.label}. `;
        } else {
            text += "El contenido del sonido se encuentra relativamente distribuido entre varias bandas de frecuencia. ";
        }

        if (spread >= 0.45) {
            text += "Gran parte de la energía está concentrada en una zona específica del espectro. ";
        } else if (spread >= 0.20) {
            text += "Aunque hay una zona predominante, también se observa participación de otras bandas. ";
        } else {
            text += "Las frecuencias están repartidas de manera relativamente uniforme. ";
        }

        if (strongest.key === "low") {
            text += "Esto suele asociarse con una sensación de profundidad o base rítmica en el sonido. ";
        } else if (strongest.key === "mid") {
            text += "Esto indica una fuerte presencia en la zona donde suelen encontrarse muchos elementos melódicos. ";
        } else {
            text += "Esto sugiere una presencia notable de brillo y detalle en el sonido. ";
        }
    }

    if (mainPeakBand !== strongest.key) {
        text += `Aunque el pico más intenso aparece en la zona de ${mainPeakBandLabel}, no coincide con la banda predominante, lo que indica que una frecuencia puntual puede destacar sin representar toda la distribución del sonido. `;
    } else {
        text += `El pico principal también se encuentra en la zona de ${mainPeakBandLabel}, en coherencia con la distribución general. `;
    }

    text += `El componente más destacado se encuentra alrededor de ${mainPeakFreq} Hz (${mainPeakNote}).`;

    return text;
}

export function renderInterpretation(peaks, ui) {
    const {
        bandLow,
        bandMid,
        bandHigh,
        interpretationOutput,
        bandCardLow,
        bandCardMid,
        bandCardHigh
    } = ui;

    if (!interpretationOutput && !bandLow && !bandMid && !bandHigh) return;

    if (!peaks || peaks.length === 0) {
        if (bandLow) bandLow.textContent = "—";
        if (bandMid) bandMid.textContent = "—";
        if (bandHigh) bandHigh.textContent = "—";

        highlightDominantBandCard({ bandCardLow, bandCardMid, bandCardHigh }, null);

        if (interpretationOutput) {
            interpretationOutput.textContent = "No hay interpretación disponible para esta selección.";
        }
        return;
    }

    const bands = classifyFrequencyBands(peaks);
    const normalized = normalizeBands(bands);
    const dominantBand = getDominantBandKey(normalized);

    if (bandLow) bandLow.textContent = formatPercentage(normalized.low);
    if (bandMid) bandMid.textContent = formatPercentage(normalized.mid);
    if (bandHigh) bandHigh.textContent = formatPercentage(normalized.high);

    highlightDominantBandCard({ bandCardLow, bandCardMid, bandCardHigh }, dominantBand);

    if (interpretationOutput) {
        const text = buildInterpretationText(normalized, peaks);
        interpretationOutput.innerHTML = `
            <div class="interp-text">
                ${text}
            </div>
        `;
    }
}