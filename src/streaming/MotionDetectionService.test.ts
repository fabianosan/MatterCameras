import assert from 'node:assert/strict';
import { MotionDetectionService } from './MotionDetectionService.js';
import { streamContext } from '../matter/behaviors/streamContext.js';

const service = new MotionDetectionService();
const cameraId = 'cam-motion-test';
const onActive = () => undefined;
const onPulse = () => undefined;

streamContext.reportMotionActivity.set(cameraId, onActive);
streamContext.reportMotionPulse.set(cameraId, onPulse);
streamContext.motionSensitivity.set(cameraId, { level: 4, max: 10 });

service.stopCamera(cameraId);

assert.equal(streamContext.reportMotionActivity.get(cameraId), onActive);
assert.equal(streamContext.reportMotionPulse.get(cameraId), onPulse);
assert.deepEqual(streamContext.motionSensitivity.get(cameraId), { level: 4, max: 10 });

streamContext.reportMotionActivity.delete(cameraId);
streamContext.reportMotionPulse.delete(cameraId);
streamContext.motionSensitivity.delete(cameraId);

console.log('MotionDetectionService.test.ts: ok');