const DB_NAME = "audiolab-audio-store";
const DB_VERSION = 2;
const STORE_NAME = "analysis_audio";
const LATEST_AUDIO_KEY = "latest-analysis-audio";

function isIndexedDBAvailable() {
    return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (!isIndexedDBAvailable()) {
            reject(new Error("IndexedDB no está disponible en este navegador."));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("No se pudo abrir IndexedDB."));
    });
}

function runTransaction(mode, operation) {
    return openDatabase().then(db => new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let request;

        try {
            request = operation(store);
        } catch (error) {
            db.close();
            reject(error);
            return;
        }

        transaction.oncomplete = () => {
            db.close();
            resolve(request?.result ?? null);
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error || new Error("Falló la transacción de almacenamiento."));
        };

        transaction.onabort = () => {
            db.close();
            reject(transaction.error || new Error("La transacción de almacenamiento fue cancelada."));
        };
    }));
}

function buildBaseRecord({ name, type, size, duration, sampleRate, channels, arrayBuffer, source }) {
    if (!arrayBuffer) {
        throw new Error("No hay audio válido para guardar.");
    }

    return {
        id: LATEST_AUDIO_KEY,
        name: name || "audio-compartido.wav",
        type: type || "audio/wav",
        size: Number.isFinite(size) ? size : arrayBuffer.byteLength,
        storedAt: new Date().toISOString(),
        duration: Number.isFinite(duration) ? duration : null,
        sampleRate: Number.isFinite(sampleRate) ? sampleRate : null,
        channels: Number.isFinite(channels) ? channels : 1,
        source: source || "analysis",
        arrayBuffer: arrayBuffer.slice(0)
    };
}

export async function saveAnalysisAudioFile(file, arrayBuffer, audioBuffer) {
    if (!file || !arrayBuffer || !audioBuffer) {
        throw new Error("No hay audio válido para guardar.");
    }

    const record = buildBaseRecord({
        name: file.name,
        type: file.type || "audio/desconocido",
        size: file.size,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        arrayBuffer,
        source: "analysis-upload"
    });

    await runTransaction("readwrite", store => store.put(record));
    return record;
}

export async function saveGeneratedAudioBuffer({ name, arrayBuffer, duration, sampleRate, channels = 1, source = "synthesis" }) {
    const record = buildBaseRecord({
        name: name || "sintesis-audiolab.wav",
        type: "audio/wav",
        duration,
        sampleRate,
        channels,
        arrayBuffer,
        source
    });

    await runTransaction("readwrite", store => store.put(record));
    return record;
}

export async function getStoredAnalysisAudioFile() {
    return runTransaction("readonly", store => store.get(LATEST_AUDIO_KEY));
}

export async function clearStoredAnalysisAudioFile() {
    await runTransaction("readwrite", store => store.delete(LATEST_AUDIO_KEY));
}

export function formatStoredAudioSummary(record) {
    if (!record) return "No hay audio compartido disponible.";

    const duration = Number.isFinite(record.duration)
        ? `${record.duration.toFixed(2)} s`
        : "duración no disponible";

    const sampleRate = Number.isFinite(record.sampleRate)
        ? `${record.sampleRate} Hz`
        : "muestreo no disponible";

    const channels = record.channels === 1 ? "mono" : `${record.channels || "?"} canales`;

    const sourceLabel = record.source === "synthesis"
        ? "generado en Síntesis"
        : record.source === "analysis-upload"
            ? "cargado en Análisis"
            : "compartido";

    return `${record.name} · ${duration} · ${sampleRate} · ${channels} · ${sourceLabel}`;
}