import { Platform } from 'react-native';
import { getApiBaseUrl } from '../services/apiConfig';
import { getToken } from '../services/authStorage';

export type DownloadProgress = {
    phase: 'preparing' | 'downloading' | 'saving' | 'done';
    percent: number;
    loadedBytes: number;
    totalBytes?: number;
    label: string;
};

type ProgressCallback = (progress: DownloadProgress) => void;

const BLOB_TIMEOUT_MS = 10 * 60 * 1000;

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function parseBlobError(data: Blob): Promise<string | null> {
    try {
        const text = await data.text();
        const json = JSON.parse(text);
        if (typeof json?.message === 'string') return json.message;
        if (typeof json?.error === 'string') return json.error;
    } catch {
        // no es JSON
    }
    return null;
}

function isNetworkFailure(error: unknown): boolean {
    const err = error as { message?: string; code?: string; name?: string };
    const msg = (err?.message || '').toLowerCase();
    return (
        err?.message === 'Network Error' ||
        err?.code === 'ERR_NETWORK' ||
        err?.name === 'TypeError' ||
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('load failed')
    );
}

function mapFetchError(status?: number): string {
    if (status === 404) return 'No se encontraron datos en el rango seleccionado.';
    if (status === 401) return 'Sesión expirada. Cierre sesión e ingrese de nuevo.';
    if (status === 502 || status === 503) return 'El servidor no respondió. Espere unos segundos e intente de nuevo.';
    if (status === 500) return 'Error interno al generar el archivo.';
    return 'No se pudo completar la descarga.';
}

async function buildDownloadUrl(path: string, params: Record<string, string>): Promise<string> {
    const baseUrl = (await getApiBaseUrl()).replace(/\/$/, '');
    const token = await getToken();
    const qs = new URLSearchParams(params);
    if (token) qs.set('access_token', token);
    return `${baseUrl}/${path.replace(/^\//, '')}?${qs.toString()}`;
}

function triggerBrowserFileDownload(blob: Blob, filename: string) {
    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
}

async function downloadViaHiddenFrame(url: string, onProgress?: ProgressCallback): Promise<void> {
    onProgress?.({
        phase: 'downloading',
        percent: 90,
        loadedBytes: 0,
        label: 'Abriendo descarga directa en el navegador...',
    });

    await new Promise<void>((resolve, reject) => {
        const frame = document.createElement('iframe');
        frame.style.display = 'none';
        frame.src = url;
        const timeout = window.setTimeout(() => {
            cleanup();
            resolve();
        }, 8000);
        const cleanup = () => {
            window.clearTimeout(timeout);
            frame.remove();
        };
        frame.onerror = () => {
            cleanup();
            reject(new Error('No se pudo iniciar la descarga directa.'));
        };
        document.body.appendChild(frame);
    });

    onProgress?.({
        phase: 'done',
        percent: 100,
        loadedBytes: 0,
        label: 'Descarga iniciada. Revise la carpeta de descargas del navegador.',
    });
}

async function downloadWithFetch(
    url: string,
    filename: string,
    onProgress?: ProgressCallback
): Promise<void> {
    const token = await getToken();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), BLOB_TIMEOUT_MS);

    let tickInterval: ReturnType<typeof setInterval> | undefined;
    let tick = 8;

    try {
        tickInterval = window.setInterval(() => {
            tick = Math.min(tick + 2, 82);
            onProgress?.({
                phase: 'preparing',
                percent: tick,
                loadedBytes: 0,
                label: 'Generando archivo en el servidor...',
            });
        }, 1200);

        const response = await fetch(url, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
            cache: 'no-store',
        });

        if (tickInterval) window.clearInterval(tickInterval);

        if (!response.ok) {
            if (response.headers.get('content-type')?.includes('application/json')) {
                const json = await response.json().catch(() => null);
                throw new Error(json?.message || mapFetchError(response.status));
            }
            throw new Error(mapFetchError(response.status));
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const json = await response.json().catch(() => null);
            throw new Error(json?.message || 'El servidor rechazó la descarga.');
        }

        const total = Number(response.headers.get('content-length') || 0);
        const reader = response.body?.getReader();
        if (!reader) {
            const blob = await response.blob();
            if (!blob.size) throw new Error('El archivo recibido está vacío.');
            triggerBrowserFileDownload(blob, filename);
            return;
        }

        const chunks: Uint8Array[] = [];
        let loaded = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                chunks.push(value);
                loaded += value.length;
                const percent = total
                    ? Math.min(96, Math.round((loaded * 100) / total))
                    : Math.min(92, 20 + Math.round(loaded / 80000));
                onProgress?.({
                    phase: 'downloading',
                    percent,
                    loadedBytes: loaded,
                    totalBytes: total || undefined,
                    label: total
                        ? `Descargando... ${percent}% (${formatBytes(loaded)} / ${formatBytes(total)})`
                        : `Descargando... ${formatBytes(loaded)}`,
                });
            }
        }

        const merged = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }

        const blob = new Blob([merged], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        if (!blob.size) throw new Error('El archivo recibido está vacío.');

        // Validar firma ZIP de xlsx (PK)
        if (merged.length < 4 || merged[0] !== 0x50 || merged[1] !== 0x4b) {
            throw new Error('El archivo descargado no es un Excel válido. Intente de nuevo.');
        }

        onProgress?.({
            phase: 'saving',
            percent: 98,
            loadedBytes: blob.size,
            totalBytes: blob.size,
            label: 'Guardando archivo...',
        });

        triggerBrowserFileDownload(blob, filename);

        onProgress?.({
            phase: 'done',
            percent: 100,
            loadedBytes: blob.size,
            totalBytes: blob.size,
            label: 'Descarga completada',
        });
    } finally {
        window.clearTimeout(timeoutId);
        if (tickInterval) window.clearInterval(tickInterval);
    }
}

export async function downloadBlobFromApi(
    path: string,
    params: Record<string, string>,
    filename: string,
    onProgress?: ProgressCallback
): Promise<void> {
    if (Platform.OS !== 'web') {
        throw new Error('La descarga de archivos está disponible en la versión web.');
    }

    const downloadUrl = await buildDownloadUrl(path, params);

    onProgress?.({
        phase: 'preparing',
        percent: 5,
        loadedBytes: 0,
        label: 'Preparando descarga...',
    });

    try {
        await downloadWithFetch(downloadUrl, filename, onProgress);
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('La descarga tardó demasiado. Intente con un rango de fechas más corto.');
        }

        if (isNetworkFailure(error) || (error instanceof Error && error.message.includes('Failed to fetch'))) {
            try {
                await downloadViaHiddenFrame(downloadUrl, onProgress);
                return;
            } catch {
                throw new Error(
                    'Error de red (ERR_FAILED). Verifique que entra por https://perla.work, recargue con Ctrl+F5 e intente de nuevo.'
                );
            }
        }

        if (error instanceof Error && error.message) {
            throw error;
        }

        throw new Error('No se pudo completar la descarga.');
    }
}

/** Compatibilidad con llamadas que aún usan axios para blobs pequeños. */
export async function downloadBlobFromApiLegacy(
    path: string,
    params: Record<string, string>,
    filename: string,
    onProgress?: ProgressCallback
): Promise<void> {
    return downloadBlobFromApi(path, params, filename, onProgress);
}
