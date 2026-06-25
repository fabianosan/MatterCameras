import assert from 'node:assert/strict';
import {
    parseStreamSourceUrl,
    streamSourceHasSensitiveCredentials,
    streamSourceHostname,
    unwrapStreamSourceUrl,
} from './streamSourceUrl.js';

assert.equal(
    unwrapStreamSourceUrl('ffmpeg:http://cam.local/flv?user=admin&password=secret#video=copy#audio=opus'),
    'http://cam.local/flv?user=admin&password=secret',
);
assert.equal(
    streamSourceHostname('ffmpeg:http://cam.local/flv?user=admin&password=secret#video=copy'),
    'cam.local',
);
assert.equal(
    streamSourceHostname('rtmp://reolink.local/bcs/channel0_main.bcs?channel=0&stream=0&user=admin&password=secret'),
    'reolink.local',
);
assert.equal(streamSourceHasSensitiveCredentials('rtsp://user:pass@cam.local/live'), true);
assert.equal(streamSourceHasSensitiveCredentials('ffmpeg:http://cam.local/flv?user=admin&password=secret#video=copy'), true);
assert.equal(streamSourceHasSensitiveCredentials('https://cam.local/flv?user=admin'), false);
assert.equal(parseStreamSourceUrl('not-a-url'), null);

console.log('streamSourceUrl.test.ts: ok');