import assert from 'node:assert/strict';
import type { Camera } from '../types/index.js';
import {
    baseCameraIdFromPersonSensorId,
    buildPersonSensorMotionCamera,
    canCameraExposePersonSensor,
    countBridgedEndpoints,
    expectedBridgedEndpointIds,
    isPersonSensorEndpointId,
    personSensorEndpointId,
    personSensorLabel,
    shouldExposePersonSensor,
} from './personSensorConfig.js';

const reolinkCamera: Camera = {
    id: 'cam-1',
    name: 'Hallway',
    rtspUrl: 'rtsp://user:pass@192.168.1.30:554/h264Preview_01_main',
    manufacturer: 'Reolink',
    motionSource: 'auto',
    personSensorEnabled: true,
};

assert.equal(personSensorEndpointId('cam-1'), 'person-cam-1');
assert.equal(isPersonSensorEndpointId('person-cam-1'), true);
assert.equal(baseCameraIdFromPersonSensorId('person-cam-1'), 'cam-1');
assert.equal(baseCameraIdFromPersonSensorId('cam-1'), null);
assert.equal(personSensorLabel(reolinkCamera), 'Hallway Person Presence');
assert.equal(canCameraExposePersonSensor(reolinkCamera), true);
assert.equal(shouldExposePersonSensor(reolinkCamera), true);

assert.deepEqual(buildPersonSensorMotionCamera(reolinkCamera), {
    ...reolinkCamera,
    id: 'person-cam-1',
    name: 'Hallway Person Presence',
    motionSource: 'auto',
    motionObjectType: 'person',
    personSensorEnabled: false,
});

{
    const plainCamera: Camera = {
        id: 'cam-2',
        name: 'Generic',
        rtspUrl: 'rtsp://user:pass@192.168.1.40:554/stream',
        motionSource: 'frame-diff',
        personSensorEnabled: true,
    };
    assert.equal(canCameraExposePersonSensor(plainCamera), false);
    assert.equal(shouldExposePersonSensor(plainCamera), false);
}

assert.deepEqual(
    [...expectedBridgedEndpointIds([reolinkCamera])].sort(),
    ['cam-1', 'person-cam-1'],
);
assert.equal(countBridgedEndpoints([reolinkCamera]), 2);

console.log('personSensorConfig.test.ts: ok');