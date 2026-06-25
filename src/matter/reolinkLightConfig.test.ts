import assert from 'node:assert/strict';
import type { Camera } from '../types/index.js';
import {
    baseCameraIdFromReolinkLightId,
    canCameraExposeReolinkLight,
    reolinkLightEndpointId,
    reolinkLightLabel,
    shouldExposeReolinkLight,
} from './reolinkLightConfig.js';

const reolinkCamera: Camera = {
    id: 'cam-1',
    name: 'Driveway',
    rtspUrl: 'rtsp://user:pass@192.168.1.10:554/h264Preview_01_main',
    manufacturer: 'Reolink',
    reolinkLightEnabled: true,
};

assert.equal(reolinkLightEndpointId('cam-1'), 'light-cam-1');
assert.equal(baseCameraIdFromReolinkLightId('light-cam-1'), 'cam-1');
assert.equal(reolinkLightLabel(reolinkCamera), 'Driveway Light');
assert.equal(canCameraExposeReolinkLight(reolinkCamera), true);
assert.equal(shouldExposeReolinkLight(reolinkCamera), true);

assert.equal(shouldExposeReolinkLight({
    ...reolinkCamera,
    reolinkLightEnabled: false,
}), false);

assert.equal(canCameraExposeReolinkLight({
    ...reolinkCamera,
    manufacturer: 'Tapo',
}), false);

console.log('reolinkLightConfig.test.ts: ok');
