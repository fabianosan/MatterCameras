import assert from 'node:assert/strict';
import { parseCameraMotionFields, parseMotionObjectType, parseOptionalBoolean } from './parseMotionForm.js';

assert.equal(parseOptionalBoolean(true), true);
assert.equal(parseOptionalBoolean('true'), true);
assert.equal(parseOptionalBoolean('1'), true);
assert.equal(parseOptionalBoolean(false), false);
assert.equal(parseOptionalBoolean('false'), false);
assert.equal(parseOptionalBoolean('0'), false);
assert.equal(parseOptionalBoolean(''), undefined);
assert.equal(parseMotionObjectType('person'), 'person');
assert.equal(parseMotionObjectType('unknown'), 'any');

{
    const parsed = parseCameraMotionFields({
        motionSource: 'reolink-native',
        motionObjectType: 'person',
        presenceSensorEnabled: 'true',
        reolinkLightEnabled: 'true',
        username: 'admin',
        password: 'secret',
        reolinkChannel: '3',
        reolinkHost: '192.168.1.20',
        reolinkHttpPort: '8443',
        reolinkUseHttps: 'true',
        reolinkRtspPort: '1554',
        reolinkProtocol: 'rtsp',
        reolinkStream: 'main',
        reolinkDeviceUid: 'uid-123',
        reolinkIsNvr: 'false',
        manufacturer: 'Reolink',
        model: 'RLN8',
        addSource: 'reolink',
    });

    assert.deepEqual(parsed, {
        motionSource: 'reolink-native',
        motionObjectType: 'person',
        personSensorEnabled: true,
        reolinkLightEnabled: true,
        onvifUrl: undefined,
        username: 'admin',
        password: 'secret',
        manufacturer: 'Reolink',
        model: 'RLN8',
        reolinkChannel: 3,
        reolinkHost: '192.168.1.20',
        reolinkHttpPort: 8443,
        reolinkUseHttps: true,
        reolinkRtspPort: 1554,
        reolinkProtocol: 'rtsp',
        reolinkStream: 'main',
        reolinkDeviceUid: 'uid-123',
        reolinkIsNvr: false,
        protectHost: undefined,
        protectCameraId: undefined,
        addSource: 'reolink',
    });
}

console.log('parseMotionForm.test.ts: ok');