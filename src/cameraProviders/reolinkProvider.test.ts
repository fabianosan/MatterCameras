import assert from 'node:assert/strict';
import type { Camera } from '../types/index.js';
import { reolinkProvider } from './reolinkProvider.js';

type FetchHandler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

async function withMockedFetch(handler: FetchHandler, fn: () => Promise<void>): Promise<void> {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const url = input instanceof URL
            ? input
            : new URL(typeof input === 'string' ? input : input.url);
        return handler(url, init);
    };

    try {
        await fn();
    } finally {
        globalThis.fetch = originalFetch;
    }
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function parseCommands(init?: RequestInit): Array<{ cmd?: string; param?: Record<string, unknown> }> {
    if (!init?.body) return [];
    return JSON.parse(String(init.body)) as Array<{ cmd?: string; param?: Record<string, unknown> }>;
}

await withMockedFetch(async (url, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.hostname !== 'cam.local') {
        throw new Error(`unexpected host ${url.hostname}`);
    }

    if (method === 'GET' && url.searchParams.get('cmd') === 'GetDevInfo') {
        return jsonResponse([{ value: { DevInfo: { exactType: 'IPC', name: 'Front Door', model: 'Reolink Duo 3 PoE', serial: 'serial-direct', channelNum: 2 } } }]);
    }

    const commands = parseCommands(init);
    const commandNames = commands.map(command => command.cmd);

    if (commandNames.join(',') === 'GetDevInfo,GetNetPort,GetChannelstatus') {
        return jsonResponse([
            {
                cmd: 'GetDevInfo',
                code: 0,
                value: { DevInfo: { exactType: 'IPC', name: 'Front Door', model: 'Reolink Duo 3 PoE', serial: 'serial-direct', channelNum: 2 } },
            },
            {
                cmd: 'GetNetPort',
                code: 0,
                value: { NetPort: { httpPort: 80, httpsPort: 8443, rtspPort: 1554, rtmpPort: 1935, onvifPort: 8000, httpEnable: 1, httpsEnable: 1, rtspEnable: 1, rtmpEnable: 1, onvifEnable: 1 } },
            },
            {
                cmd: 'GetChannelstatus',
                code: 0,
                value: {
                    count: 2,
                    status: [
                        { channel: 0, online: 1, uid: 'uid-direct-main', name: 'Front Door', typeInfo: 'Reolink Duo 3 PoE' },
                        { channel: 1, online: 1, uid: 'uid-direct-lens2', name: 'Front Door Lens 2', typeInfo: 'Reolink Duo 3 PoE' },
                    ],
                },
            },
        ]);
    }

    if (commandNames.join(',') === 'GetChnTypeInfo,GetEnc,GetRtspUrl') {
        return jsonResponse([
            {
                cmd: 'GetChnTypeInfo',
                code: 0,
                value: { channel: 0, typeInfo: 'Reolink Duo 3 PoE', firmVer: 'v3.0.0', name: 'Front Door' },
            },
            {
                cmd: 'GetEnc',
                code: 0,
                value: { Enc: { channel: 0, mainStream: { vType: 'h265' }, subStream: { vType: 'h264' } } },
            },
            {
                cmd: 'GetRtspUrl',
                code: 0,
                value: { rtspUrl: { channel: 0, mainStream: 'rtsp://cam.local:1554/h265Preview_01_main', subStream: 'rtsp://cam.local:1554/h264Preview_01_sub' } },
            },
        ]);
    }

    throw new Error(`unexpected request ${method} ${url}`);
}, async () => {
    const devices = await reolinkProvider.discover({
        host: 'https://cam.local:8443',
        username: 'admin',
        password: 'secret',
    }, []);

    assert.equal(devices.length, 1);
    assert.equal(devices[0]?.id, '0');
    assert.equal(devices[0]?.label, 'Front Door');
    assert.deepEqual(devices[0]?.payload, {
        host: 'cam.local',
        channel: 0,
        uid: 'uid-direct-main',
        httpPort: 8443,
        useHttps: true,
        rtspPort: 1554,
        onvifPort: 8000,
        isNvr: false,
    });

    const draft = await reolinkProvider.resolve({
        deviceId: '0',
        payload: devices[0]?.payload,
        host: 'https://cam.local:8443',
        username: 'admin',
        password: 'secret',
    });

    assert.equal(draft.name, 'Front Door');
    assert.equal(draft.rtspUrl, 'rtsp://admin:secret@cam.local:1554/h264Preview_01_sub');
    assert.equal(draft.onvifUrl, 'http://cam.local:8000/onvif/device_service');
    assert.equal(draft.reolinkHost, 'cam.local');
    assert.equal(draft.reolinkHttpPort, 8443);
    assert.equal(draft.reolinkUseHttps, true);
    assert.equal(draft.reolinkRtspPort, 1554);
    assert.equal(draft.reolinkProtocol, 'rtsp');
    assert.equal(draft.reolinkStream, 'sub');
    assert.equal(draft.reolinkDeviceUid, 'uid-direct-main');
    assert.equal(draft.reolinkIsNvr, false);
    assert.equal(draft.reolinkChannel, 0);
});

await withMockedFetch(async (url, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.hostname !== 'hub.local') {
        throw new Error(`unexpected host ${url.hostname}`);
    }

    if (method === 'GET' && url.searchParams.get('cmd') === 'GetDevInfo') {
        return jsonResponse([{ value: { DevInfo: { exactType: 'HOMEHUB', name: 'Home Hub', model: 'Reolink Home Hub', serial: 'hub-serial', channelNum: 3 } } }]);
    }

    const commands = parseCommands(init);
    const commandNames = commands.map(command => command.cmd);

    if (commandNames.join(',') === 'GetDevInfo,GetNetPort,GetChannelstatus') {
        return jsonResponse([
            {
                cmd: 'GetDevInfo',
                code: 0,
                value: { DevInfo: { exactType: 'HOMEHUB', name: 'Home Hub', model: 'Reolink Home Hub', serial: 'hub-serial', channelNum: 3 } },
            },
            {
                cmd: 'GetNetPort',
                code: 0,
                value: { NetPort: { httpPort: 80, httpsPort: 443, rtspPort: 7444, rtmpPort: 1935, onvifPort: 9000, httpEnable: 1, httpsEnable: 0, rtspEnable: 1, rtmpEnable: 1, onvifEnable: 1 } },
            },
            {
                cmd: 'GetChannelstatus',
                code: 0,
                value: {
                    count: 3,
                    status: [
                        { channel: 0, online: 1, uid: 'uid-front', name: 'Front Yard', typeInfo: 'RLC-810A' },
                        { channel: 1, online: 0, uid: 'uid-offline', name: 'Offline', typeInfo: 'RLC-810A' },
                        { channel: 2, online: 1, uid: 'uid-drive', name: 'Driveway', typeInfo: 'RLC-820A' },
                    ],
                },
            },
        ]);
    }

    if (commandNames.join(',') === 'GetChnTypeInfo,GetEnc,GetRtspUrl') {
        const channel = Number(commands[0]?.param?.channel);
        if (channel !== 2) {
            throw new Error(`unexpected channel ${channel}`);
        }
        return jsonResponse([
            {
                cmd: 'GetChnTypeInfo',
                code: 0,
                value: { channel: 2, typeInfo: 'RLC-820A', firmVer: 'v3.0.0', name: 'Driveway' },
            },
            {
                cmd: 'GetEnc',
                code: 0,
                value: { Enc: { channel: 2, mainStream: { vType: 'h264' }, subStream: { vType: 'h264' } } },
            },
            {
                cmd: 'GetRtspUrl',
                code: 0,
                value: { rtspUrl: { channel: 2, mainStream: '', subStream: '' } },
            },
        ]);
    }

    throw new Error(`unexpected request ${method} ${url}`);
}, async () => {
    const existing: Camera[] = [{
        id: 'cam-existing',
        name: 'Front Yard',
        rtspUrl: 'rtsp://admin:secret@hub.local:7444/h264Preview_01_main',
        reolinkChannel: 0,
        reolinkDeviceUid: 'uid-front',
    }];

    const devices = await reolinkProvider.discover({
        host: 'hub.local',
        username: 'admin',
        password: 'secret',
    }, existing);

    assert.equal(devices.length, 1);
    assert.equal(devices[0]?.id, '2');
    assert.equal(devices[0]?.label, 'Driveway');
    assert.equal(devices[0]?.detail, 'RLC-820A · channel 3 · uid-drive');

    const draft = await reolinkProvider.resolve({
        deviceId: '2',
        payload: devices[0]?.payload,
        host: 'hub.local',
        username: 'admin',
        password: 'secret',
    });

    assert.equal(draft.name, 'Driveway');
    assert.equal(draft.rtspUrl, 'rtsp://admin:secret@hub.local:7444/h264Preview_03_sub');
    assert.equal(draft.reolinkIsNvr, true);
    assert.equal(draft.reolinkDeviceUid, 'uid-drive');
    assert.equal(draft.reolinkRtspPort, 7444);
    assert.equal(draft.onvifUrl, 'http://hub.local:9000/onvif/device_service');
});

await withMockedFetch(async (url, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.hostname !== 'fallback.local') {
        throw new Error(`unexpected host ${url.hostname}`);
    }

    if (method === 'GET' && url.searchParams.get('cmd') === 'GetDevInfo') {
        return jsonResponse([{ value: { DevInfo: { exactType: 'IPC', name: 'Back Yard', model: 'RLC-510A', serial: 'fallback-serial', channelNum: 1 } } }]);
    }

    const commands = parseCommands(init);
    const commandNames = commands.map(command => command.cmd);

    if (commandNames.join(',') === 'GetDevInfo,GetNetPort,GetChannelstatus') {
        return jsonResponse([
            {
                cmd: 'GetDevInfo',
                code: 0,
                value: { DevInfo: { exactType: 'IPC', name: 'Back Yard', model: 'RLC-510A', serial: 'fallback-serial', channelNum: 1 } },
            },
            {
                cmd: 'GetNetPort',
                code: 0,
                value: { NetPort: { httpPort: 80, httpsPort: 443, rtspPort: 554, rtmpPort: 1935, onvifPort: 8000, httpEnable: 1, httpsEnable: 0, rtspEnable: 0, rtmpEnable: 1, onvifEnable: 1 } },
            },
            {
                cmd: 'GetChannelstatus',
                code: 0,
                value: {
                    count: 1,
                    status: [
                        { channel: 0, online: 1, uid: 'uid-fallback', name: 'Back Yard', typeInfo: 'RLC-510A' },
                    ],
                },
            },
        ]);
    }

    if (commandNames.join(',') === 'GetChnTypeInfo,GetEnc,GetRtspUrl') {
        return jsonResponse([
            {
                cmd: 'GetChnTypeInfo',
                code: 0,
                value: { channel: 0, typeInfo: 'RLC-510A', firmVer: 'v3.0.0', name: 'Back Yard' },
            },
            {
                cmd: 'GetEnc',
                code: 0,
                value: { Enc: { channel: 0, mainStream: { vType: 'h264' }, subStream: { vType: 'h264' } } },
            },
            {
                cmd: 'GetRtspUrl',
                code: 0,
                value: { rtspUrl: { channel: 0, mainStream: '', subStream: '' } },
            },
        ]);
    }

    throw new Error(`unexpected request ${method} ${url}`);
}, async () => {
    const draft = await reolinkProvider.resolve({
        deviceId: '0',
        payload: {
            host: 'fallback.local',
            channel: 0,
            httpPort: 80,
            useHttps: false,
            rtspPort: 554,
            onvifPort: 8000,
            isNvr: false,
        },
        host: 'fallback.local',
        username: 'admin',
        password: 'secret',
    });

    assert.equal(draft.reolinkProtocol, 'flv');
    assert.equal(draft.rtspUrl, 'http://fallback.local:80/flv?port=1935&app=bcs&stream=channel0_sub.bcs&user=admin&password=secret');
    assert.equal(draft.rtspUrlRedacted, 'http://fallback.local/flv?port=1935&app=bcs&stream=channel0_sub.bcs&user=admin&password=***');
});

console.log('reolinkProvider.test.ts: ok');