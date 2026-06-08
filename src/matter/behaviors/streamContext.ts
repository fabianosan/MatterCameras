import type { Go2RTCClient } from '../../streaming/Go2RTCClient.js';

export type MotionActivityReporter = (active: boolean) => void;

/** Shared streaming dependencies for Matter camera behaviors */
export const streamContext = {
    go2rtc: null as Go2RTCClient | null,
    /** Zone Management servers register here; motion polling forwards activity by camera id. */
    reportMotionActivity: new Map<string, MotionActivityReporter>(),
};
