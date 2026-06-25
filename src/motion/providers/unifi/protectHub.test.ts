import assert from 'node:assert/strict';
import {
    protectCameraSupportsPersonDetection,
    protectCameraUpdateMatchesPersonDetection,
    protectPacketMatchesPersonDetection,
} from './protectHub.js';

{
    assert.equal(
        protectPacketMatchesPersonDetection(
            {
                header: { modelKey: 'event', action: 'add' },
                payload: {
                    camera: 'protect-cam-1',
                    type: 'smartDetectZone',
                    smartDetectTypes: ['person'],
                },
            },
            'protect-cam-1',
        ),
        true,
    );

    assert.equal(
        protectPacketMatchesPersonDetection(
            {
                header: { modelKey: 'event', action: 'add' },
                payload: {
                    camera: 'protect-cam-1',
                    type: 'smartDetectZone',
                    smartDetectTypes: ['vehicle'],
                },
            },
            'protect-cam-1',
        ),
        false,
    );
}

{
    assert.equal(
        protectCameraUpdateMatchesPersonDetection({
            isSmartDetected: true,
            smartDetectTypes: ['person'],
        }),
        true,
    );

    assert.equal(
        protectCameraUpdateMatchesPersonDetection({
            isSmartDetected: true,
            smartDetectTypes: ['vehicle'],
        }),
        false,
    );
}

{
    assert.equal(
        protectCameraSupportsPersonDetection({
            featureFlags: {
                hasSmartDetect: true,
                smartDetectTypes: ['person', 'vehicle'],
            },
        }),
        true,
    );

    assert.equal(
        protectCameraSupportsPersonDetection({
            featureFlags: {
                hasSmartDetect: true,
                smartDetectTypes: ['vehicle'],
            },
        }),
        false,
    );
}

console.log('protectHub.test.ts: ok');