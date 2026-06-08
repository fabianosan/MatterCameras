import { Logger } from '@matter/general';
import type { Go2RTCClient } from './Go2RTCClient.js';

const logger = Logger.get('MotionDetect');

export interface MotionDetectorOptions {
    /** How often to sample a low-res JPEG frame from go2rtc. */
    pollIntervalMs?: number;
    /** Downscaled width for motion samples (height follows aspect ratio). */
    sampleWidth?: number;
    /** Base motion score threshold (0–1). Lower = more sensitive. */
    baseThreshold?: number;
}

const DEFAULT_OPTS: Required<MotionDetectorOptions> = {
    pollIntervalMs: 2_000,
    sampleWidth: 160,
    baseThreshold: 0.06,
};

/**
 * Generic RTSP motion detection via consecutive JPEG frame comparison.
 * Uses go2rtc snapshots only — no vendor-specific APIs.
 */
export class RtspMotionDetector {
    readonly #cameraId: string;
    readonly #onActive: (active: boolean) => void;
    readonly #opts: Required<MotionDetectorOptions>;
    #timer?: ReturnType<typeof setInterval>;
    #previous?: Uint8Array;
    #polling = false;
    #sensitivity = 5;
    #sensitivityMax = 10;
    #lastReportedActive = false;

    constructor(cameraId: string, onActive: (active: boolean) => void, opts?: MotionDetectorOptions) {
        this.#cameraId = cameraId;
        this.#onActive = onActive;
        this.#opts = { ...DEFAULT_OPTS, ...opts };
    }

    setSensitivity(level: number, max = 10): void {
        this.#sensitivity = Math.max(1, Math.min(max, level));
        this.#sensitivityMax = max;
    }

    start(go2rtc: Go2RTCClient): void {
        if (this.#timer) return;

        logger.info(`Motion detector start camera=${this.#cameraId} poll=${this.#opts.pollIntervalMs}ms`);
        void this.#poll(go2rtc);
        this.#timer = setInterval(() => void this.#poll(go2rtc), this.#opts.pollIntervalMs);
    }

    stop(): void {
        if (this.#timer) {
            clearInterval(this.#timer);
            this.#timer = undefined;
        }
        this.#previous = undefined;
        if (this.#lastReportedActive) {
            this.#lastReportedActive = false;
            this.#onActive(false);
        }
        logger.info(`Motion detector stop camera=${this.#cameraId}`);
    }

    async #poll(go2rtc: Go2RTCClient): Promise<void> {
        if (this.#polling) return;
        this.#polling = true;
        try {
            const frame = await go2rtc.captureFrame(this.#cameraId, this.#opts.sampleWidth);
            const active = this.#detectMotion(frame);
            if (active !== this.#lastReportedActive) {
                this.#lastReportedActive = active;
                this.#onActive(active);
            } else if (active) {
                // Keep the zone trigger state machine aware of ongoing motion.
                this.#onActive(true);
            }
        } catch (error) {
            logger.warn(`Motion poll failed camera=${this.#cameraId}: ${error}`);
        } finally {
            this.#polling = false;
        }
    }

    #detectMotion(frame: Uint8Array): boolean {
        const previous = this.#previous;
        this.#previous = frame;
        if (!previous) return false;

        const score = motionScore(previous, frame);
        const threshold = this.#threshold();
        return score >= threshold;
    }

    #threshold(): number {
        // sensitivity 1 (low) → higher threshold; sensitivity max → baseThreshold
        const t = (this.#sensitivityMax - this.#sensitivity) / Math.max(1, this.#sensitivityMax - 1);
        return this.#opts.baseThreshold + t * 0.12;
    }
}

/** Subsampled mean absolute byte delta on JPEG payloads (skips headers). */
function motionScore(prev: Uint8Array, curr: Uint8Array): number {
    const headerSkip = 512;
    const len = Math.min(prev.length, curr.length);
    if (len <= headerSkip) return 0;

    let diff = 0;
    let samples = 0;
    const step = 48;
    for (let i = headerSkip; i < len; i += step) {
        diff += Math.abs(prev[i] - curr[i]);
        samples++;
    }
    return samples > 0 ? diff / samples / 255 : 0;
}
