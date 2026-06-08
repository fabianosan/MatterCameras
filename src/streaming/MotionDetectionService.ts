import { Logger } from '@matter/general';
import type { Go2RTCClient } from './Go2RTCClient.js';
import { RtspMotionDetector } from './rtspMotionDetector.js';
import { streamContext } from '../matter/behaviors/streamContext.js';

const logger = Logger.get('MotionService');

/** Starts/stops per-camera RTSP motion polling and forwards activity to Zone Management. */
export class MotionDetectionService {
    readonly #detectors = new Map<string, RtspMotionDetector>();

    startCamera(cameraId: string, go2rtc: Go2RTCClient): void {
        if (this.#detectors.has(cameraId)) return;

        const detector = new RtspMotionDetector(cameraId, active => {
            const report = streamContext.reportMotionActivity.get(cameraId);
            if (report) {
                report(active);
            }
        });

        this.#detectors.set(cameraId, detector);
        detector.start(go2rtc);
        const msg = `Motion service watching camera=${cameraId}`;
        logger.info(msg);
        console.log(msg);
    }

    stopCamera(cameraId: string): void {
        const detector = this.#detectors.get(cameraId);
        if (!detector) return;
        detector.stop();
        this.#detectors.delete(cameraId);
        streamContext.reportMotionActivity.delete(cameraId);
    }

    stopAll(): void {
        for (const id of [...this.#detectors.keys()]) {
            this.stopCamera(id);
        }
    }
}
