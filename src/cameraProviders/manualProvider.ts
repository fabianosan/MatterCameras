import type { Camera } from '../types/index.js';
import { streamSourceHostname } from '../utils/streamSourceUrl.js';
import type { CameraAddProvider, DiscoveredCameraDevice, ResolvedCameraDraft } from './types.js';

export const manualProvider: CameraAddProvider = {
    meta: {
        id: 'manual',
        label: 'Manual RTSP',
        description: 'Paste your own RTSP or RTSPS stream URL.',
        discoverable: false,
    },

    async discover(): Promise<DiscoveredCameraDevice[]> {
        return [];
    },

    async resolve(): Promise<ResolvedCameraDraft> {
        throw new Error('Manual provider does not support resolve — enter the stream URL directly.');
    },
};

export function isManualRtspAlreadyAdded(rtspUrl: string, cameras: Camera[]): boolean {
    const host = streamSourceHostname(rtspUrl);
    if (!host) return false;
    return cameras.some(cam => {
        return streamSourceHostname(cam.rtspUrl) === host;
    });
}
