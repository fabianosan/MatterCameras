import assert from 'node:assert/strict';
import { redactRtspInText, redactRtspUrl } from './redactRtspUrl.js';

assert.equal(
    redactRtspUrl('rtsp://user:pass@192.168.1.10:554/stream1'),
    'rtsp://***@192.168.1.10:554/stream1',
);
assert.equal(
    redactRtspUrl('rtsp://192.168.1.10:554/stream1'),
    'rtsp://192.168.1.10:554/stream1',
);
assert.equal(
    redactRtspUrl('rtsps://admin:secret@cam.local/live'),
    'rtsps://***@cam.local/live',
);
assert.equal(redactRtspUrl(''), '<empty-url>');

assert.equal(
    redactRtspInText('failed src=rtsp://admin:secret@10.0.0.1/h264'),
    'failed src=rtsp://admin:***@10.0.0.1/h264',
);

assert.equal(
    redactRtspUrl('http://cam.local/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=secret'),
    'http://cam.local/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=***',
);
assert.equal(
    redactRtspUrl('ffmpeg:http://cam.local/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=secret#video=copy#audio=opus'),
    'ffmpeg:http://cam.local/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=***#video=copy#audio=opus',
);
assert.equal(
    redactRtspInText('failed src=rtmp://cam.local/bcs/channel0_main.bcs?channel=0&stream=0&user=admin&password=secret'),
    'failed src=rtmp://cam.local/bcs/channel0_main.bcs?channel=0&stream=0&user=admin&password=***',
);

console.log('redactRtspUrl.test.ts: ok');
