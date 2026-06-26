import assert from 'node:assert/strict';
import type { Camera } from '../../../types/index.js';
import { parseReolinkWhiteLedState, reolinkAiStateMatches, reolinkCommandSucceeded, reolinkWhiteLedHardwareVerified, resolveReolinkTarget } from './reolinkClient.js';

{
    const camera: Camera = {
        id: 'cam-reolink-meta',
        name: 'Reolink Meta',
        rtspUrl: 'ffmpeg:http://192.168.1.20/flv?port=1935&app=bcs&stream=channel0_main.bcs',
        reolinkHost: '192.168.1.20',
        reolinkHttpPort: 8443,
        reolinkUseHttps: true,
        username: 'admin',
        password: 'secret',
        reolinkChannel: 4,
    };

    assert.deepEqual(resolveReolinkTarget(camera), {
        host: '192.168.1.20',
        port: 8443,
        useHttps: true,
        username: 'admin',
        password: 'secret',
        channel: 4,
    });
}

{
    const camera: Camera = {
        id: 'cam-reolink-fallback',
        name: 'Reolink Fallback',
        rtspUrl: 'rtsp://stream-user:stream-pass@stream.local:554/h264Preview_01_main',
        reolinkHost: 'api.local',
    };

    assert.deepEqual(resolveReolinkTarget(camera), {
        host: 'api.local',
        username: 'stream-user',
        password: 'stream-pass',
        channel: 0,
        port: undefined,
        useHttps: undefined,
    });
}

{
    const camera: Camera = {
        id: 'cam-reolink-legacy',
        name: 'Reolink Legacy',
        rtspUrl: 'rtsp://user:pass@192.168.1.30:554/h264Preview_02_main',
        reolinkChannel: 1,
    };

    assert.deepEqual(resolveReolinkTarget(camera), {
        host: '192.168.1.30',
        username: 'user',
        password: 'pass',
        channel: 1,
        port: undefined,
        useHttps: undefined,
    });
}

{
    const aiState = {
        people: { alarm_state: 1 },
        vehicle: { alarm_state: 0 },
    };

    assert.equal(reolinkAiStateMatches(aiState, 'person'), true);
    assert.equal(reolinkAiStateMatches(aiState, 'any'), true);
    assert.equal(
        reolinkAiStateMatches({ people: { alarm_state: 0 }, vehicle: { alarm_state: 1 } }, 'person'),
        false,
    );
    assert.equal(reolinkAiStateMatches(undefined, 'person'), false);
}

{
    assert.deepEqual(parseReolinkWhiteLedState([{
        code: 0,
        value: {
            WhiteLed: {
                state: 1,
                bright: 72,
            },
        },
    }]), {
        enabled: true,
        brightness: 72,
    });

    assert.equal(parseReolinkWhiteLedState([{ code: 1 }]), null);
    assert.equal(parseReolinkWhiteLedState([{ code: 0, value: {} }]), null);
}

{
    assert.equal(reolinkCommandSucceeded([{ code: 0 }]), true);
    assert.equal(reolinkCommandSucceeded([{ code: 1 }]), false);
    assert.equal(reolinkCommandSucceeded([]), false);
}

{
    const initialOff = { enabled: false, brightness: 85 };

    assert.equal(reolinkWhiteLedHardwareVerified({
        initial: initialOff,
        setOnOk: true,
        afterSetOn: { enabled: true, brightness: 85 },
    }), true);

    assert.equal(reolinkWhiteLedHardwareVerified({
        initial: initialOff,
        setOnOk: true,
        afterSetOn: { enabled: false, brightness: 85 },
    }), false);

    assert.equal(reolinkWhiteLedHardwareVerified({
        initial: { enabled: true, brightness: 60 },
        setOnOk: false,
        afterSetOn: null,
        setOffOk: true,
        afterSetOff: { enabled: false, brightness: 60 },
        restoreOnOk: true,
        afterRestoreOn: { enabled: true, brightness: 60 },
    }), true);

    assert.equal(reolinkWhiteLedHardwareVerified({
        initial: null,
        setOnOk: true,
        afterSetOn: { enabled: true, brightness: 50 },
    }), false);
}

console.log('reolinkClient.test.ts: ok');