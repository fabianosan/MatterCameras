import type { Camera, ReolinkProtocol, ReolinkStream } from '../types/index.js';
import { ReolinkClient } from '../motion/providers/reolink/reolinkClient.js';
import { injectRtspCredentials, redactRtspUrl } from '../utils/redactRtspUrl.js';
import type { CameraAddProvider, DiscoveredCameraDevice } from './types.js';

interface ReolinkRow {
    cmd?: string;
    code?: number;
    error?: { detail?: string; rspCode?: number };
    value?: Record<string, unknown>;
}

interface NormalizedReolinkHost {
    hostname: string;
    requestPort?: number;
    useHttps?: boolean;
}

interface ReolinkChannelInfo {
    channel: number;
    name?: string;
    model?: string;
    uid?: string;
    online?: boolean;
}

interface ReolinkHostProfile {
    host: NormalizedReolinkHost;
    name?: string;
    model?: string;
    serial?: string;
    isNvr: boolean;
    httpPort: number;
    httpEnabled: boolean;
    useHttps: boolean;
    rtmpPort: number;
    rtmpEnabled: boolean;
    rtspPort: number;
    rtspEnabled: boolean;
    onvifPort?: number;
    onvifEnabled: boolean;
    channels: ReolinkChannelInfo[];
}

interface ReolinkChannelProfile extends ReolinkChannelInfo {
    mainEncoding?: 'h264' | 'h265';
    subEncoding?: 'h264' | 'h265';
    rtspMain?: string;
    rtspSub?: string;
}

/** Default for newly added Reolink cameras — sub-stream is H.264 and live-view friendly. */
const DEFAULT_REOLINK_STREAM: ReolinkStream = 'sub';

const DEFAULT_HTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;
const DEFAULT_RTSP_PORT = 554;
const DEFAULT_ONVIF_PORT = 8000;
const API_TIMEOUT_MS = 8_000;

function reolinkRtspPath(channel: number, stream: ReolinkStream = 'main', encoding: 'h264' | 'h265' = 'h264'): string {
    const idx = String(channel + 1).padStart(2, '0');
    switch (stream) {
        case 'sub':
            return `${encoding}Preview_${idx}_sub`;
        case 'telephoto_main':
        case 'autotrack_main':
            return `Preview_${idx}_autotrack`;
        case 'telephoto_sub':
        case 'autotrack_sub':
            return `Preview_${idx}_sub`;
        case 'ext':
            return `${encoding}Preview_${idx}_sub`;
        default:
            return `${encoding}Preview_${idx}_main`;
    }
}

function isReolinkAlreadyAdded(cameras: Camera[], host: string, channel: number, uid?: string): boolean {
    const hostKey = host.toLowerCase();
    return cameras.some(cam => {
        if (uid && cam.reolinkDeviceUid && cam.reolinkDeviceUid === uid) return true;
        if ((cam.reolinkChannel ?? 0) !== channel) return false;
        if (cam.reolinkHost?.toLowerCase() === hostKey) return true;
        try {
            return new URL(cam.rtspUrl).hostname.toLowerCase() === hostKey;
        } catch {
            return false;
        }
    });
}

async function loadReolinkHostProfile(rawHost: string, username: string, password: string): Promise<ReolinkHostProfile> {
    const host = normalizeReolinkHost(rawHost);
    const client = new ReolinkClient(host.hostname, username, password, {
        port: host.requestPort,
        useHttps: host.useHttps,
    });
    const auth = await client.ensureAuth();

    const rows = await postReolinkCommands(host, auth, [
        { cmd: 'GetDevInfo', action: 0, param: {} },
        { cmd: 'GetNetPort', action: 1, param: {} },
        { cmd: 'GetChannelstatus' },
    ]);

    const devInfo = unwrapDevInfo(findCommandValue(rows, 'GetDevInfo'));
    const netPort = unwrapNetPort(findCommandValue(rows, 'GetNetPort'));
    const statuses = parseChannelStatuses(findCommandValue(rows, 'GetChannelstatus'));

    const isNvr = looksLikeNvr(devInfo);
    const httpEnabled = !('httpEnable' in netPort) || toFlag(netPort.httpEnable);
    const useHttps = host.useHttps ?? (toFlag(netPort.httpsEnable) && !httpEnabled);
    const httpPort = host.requestPort
        ?? pickPort(useHttps, netPort.httpPort, netPort.httpsPort)
        ?? (useHttps ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT);
    const rtmpPort = toNumber(netPort.rtmpPort) ?? 1935;
    const rtmpEnabled = !('rtmpEnable' in netPort) || toFlag(netPort.rtmpEnable);
    const rtspPort = toNumber(netPort.rtspPort) ?? DEFAULT_RTSP_PORT;
    const rtspEnabled = !('rtspEnable' in netPort) || toFlag(netPort.rtspEnable);
    const onvifPort = toNumber(netPort.onvifPort) ?? DEFAULT_ONVIF_PORT;
    const onvifEnabled = toFlag(netPort.onvifEnable) || !('onvifEnable' in netPort);
    const channelCount = Math.max(
        1,
        toNumber(devInfo.channelNum)
            ?? toNumber(devInfo.channelCount)
            ?? toNumber(asRecord(findCommandValue(rows, 'GetChannelstatus')).count)
            ?? 1,
    );

    return {
        host,
        name: pickDeviceName(devInfo),
        model: toStringValue(devInfo.model) ?? toStringValue(devInfo.type),
        serial: toStringValue(devInfo.serial),
        isNvr,
        httpPort,
        httpEnabled,
        useHttps,
        rtmpPort,
        rtmpEnabled,
        rtspPort,
        rtspEnabled,
        onvifPort,
        onvifEnabled,
        channels: pickPhysicalChannels({
            isNvr,
            channelCount,
            hostName: pickDeviceName(devInfo),
            hostModel: toStringValue(devInfo.model) ?? toStringValue(devInfo.type),
            serial: toStringValue(devInfo.serial),
            statuses,
        }),
    };
}

async function loadReolinkChannelProfile(
    profile: ReolinkHostProfile,
    username: string,
    password: string,
    channel: number,
): Promise<ReolinkChannelProfile> {
    const client = new ReolinkClient(profile.host.hostname, username, password, {
        port: profile.httpPort,
        useHttps: profile.useHttps,
    });
    const auth = await client.ensureAuth();
    const rows = await postReolinkCommands(profile.host, auth, [
        { cmd: 'GetChnTypeInfo', action: 0, param: { channel } },
        { cmd: 'GetEnc', action: 0, param: { channel } },
        { cmd: 'GetRtspUrl', action: 0, param: { channel } },
    ]);

    const chnInfo = asRecord(findCommandValue(rows, 'GetChnTypeInfo'));
    const enc = unwrapEnc(findCommandValue(rows, 'GetEnc'));
    const rtsp = unwrapRtspUrls(findCommandValue(rows, 'GetRtspUrl'));
    const status = profile.channels.find(item => item.channel === channel);

    return {
        channel,
        uid: status?.uid ?? profile.serial,
        online: status?.online,
        name: status?.name ?? toStringValue(chnInfo.name),
        model: status?.model ?? toStringValue(chnInfo.typeInfo),
        mainEncoding: normalizeEncoding(asRecord(enc.mainStream).vType),
        subEncoding: normalizeEncoding(asRecord(enc.subStream).vType),
        rtspMain: toStringValue(rtsp.mainStream),
        rtspSub: toStringValue(rtsp.subStream),
    };
}

function resolveReolinkStream(
    profile: ReolinkHostProfile,
    channel: ReolinkChannelProfile,
    username: string,
    password: string,
): { protocol: ReolinkProtocol; stream: ReolinkStream; url: string } {
    const stream = DEFAULT_REOLINK_STREAM;

    const direct = normalizeRtspUrl(channel.rtspSub, username, password);
    if (profile.rtspEnabled && direct) {
        return {
            protocol: 'rtsp',
            stream,
            url: direct,
        };
    }

    const encoding = channel.subEncoding ?? channel.mainEncoding ?? 'h264';
    const idx = String(channel.channel + 1).padStart(2, '0');
    const candidates = [
        injectRtspCredentials(
            `rtsp://${profile.host.hostname}:${profile.rtspPort}/${reolinkRtspPath(channel.channel, stream, encoding)}`,
            username,
            password,
        ),
        injectRtspCredentials(
            `rtsp://${profile.host.hostname}:${profile.rtspPort}/${reolinkRtspPath(channel.channel, stream, encoding === 'h265' ? 'h264' : 'h265')}`,
            username,
            password,
        ),
        injectRtspCredentials(
            `rtsp://${profile.host.hostname}:${profile.rtspPort}/Preview_${idx}_sub`,
            username,
            password,
        ),
    ];

    const fallbackRtsp = dedupeStrings(candidates)[0];
    if (profile.rtspEnabled && fallbackRtsp) {
        return {
            protocol: 'rtsp',
            stream,
            url: fallbackRtsp,
        };
    }

    const flv = buildReolinkFlvUrl(profile, channel.channel, stream, username, password);
    if (flv) {
        return {
            protocol: 'flv',
            stream,
            url: flv,
        };
    }

    const rtmp = buildReolinkRtmpUrl(profile, channel.channel, stream, username, password);
    if (rtmp) {
        return {
            protocol: 'rtmp',
            stream,
            url: rtmp,
        };
    }

    return {
        protocol: 'rtsp',
        stream,
        url: fallbackRtsp,
    };
}

function buildReolinkOnvifUrl(profile: ReolinkHostProfile): string | undefined {
    if (!profile.onvifEnabled) return undefined;
    return `http://${profile.host.hostname}:${profile.onvifPort ?? DEFAULT_ONVIF_PORT}/onvif/device_service`;
}

function normalizeReolinkHost(rawHost: string): NormalizedReolinkHost {
    const value = String(rawHost).trim();
    const hasScheme = /^[a-z]+:\/\//i.test(value);
    const parsed = new URL(hasScheme ? value : `http://${value}`);
    return {
        hostname: parsed.hostname,
        requestPort: parsed.port ? Number(parsed.port) : undefined,
        useHttps: hasScheme ? parsed.protocol === 'https:' : undefined,
    };
}

async function postReolinkCommands(
    host: NormalizedReolinkHost,
    auth: Record<string, string>,
    body: Array<Record<string, unknown>>,
): Promise<ReolinkRow[]> {
    const url = buildReolinkApiUrl(host.hostname, host.requestPort, host.useHttps);
    for (const [key, value] of Object.entries(auth)) {
        url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`Reolink HTTP ${response.status}`);
    }

    const rows = await response.json() as ReolinkRow | ReolinkRow[];
    return Array.isArray(rows) ? rows : [rows];
}

function buildReolinkApiUrl(hostname: string, port?: number, useHttps?: boolean): URL {
    const url = new URL(`${useHttps ? 'https' : 'http'}://${hostname}`);
    if (port !== undefined) url.port = String(port);
    url.pathname = '/api.cgi';
    return url;
}

function findCommandValue(rows: ReolinkRow[], cmd: string): Record<string, unknown> | undefined {
    const row = rows.find(item => item.cmd === cmd && item.code !== 1 && !item.error);
    return row?.value;
}

function unwrapDevInfo(value: Record<string, unknown> | undefined): Record<string, unknown> {
    const record = asRecord(value);
    return asRecord(record.DevInfo ?? record);
}

function unwrapNetPort(value: Record<string, unknown> | undefined): Record<string, unknown> {
    const record = asRecord(value);
    return asRecord(record.NetPort ?? record);
}

function unwrapEnc(value: Record<string, unknown> | undefined): Record<string, unknown> {
    const record = asRecord(value);
    return asRecord(record.Enc ?? record);
}

function unwrapRtspUrls(value: Record<string, unknown> | undefined): Record<string, unknown> {
    const record = asRecord(value);
    return asRecord(record.rtspUrl ?? record.RtspUrl ?? record);
}

function parseChannelStatuses(value: Record<string, unknown> | undefined): ReolinkChannelInfo[] {
    const record = asRecord(value);
    const rows = Array.isArray(record.status) ? record.status : [];
    const parsed: ReolinkChannelInfo[] = [];
    for (const item of rows) {
        const status = asRecord(item);
        const channel = toNumber(status.channel);
        if (channel === undefined) continue;
        parsed.push({
            channel,
            online: toFlag(status.online),
            uid: toStringValue(status.uid),
            name: normalizeChannelName(toStringValue(status.name)),
            model: toStringValue(status.typeInfo),
        });
    }
    return parsed;
}

function pickPhysicalChannels(opts: {
    isNvr: boolean;
    channelCount: number;
    hostName?: string;
    hostModel?: string;
    serial?: string;
    statuses: ReolinkChannelInfo[];
}): ReolinkChannelInfo[] {
    if (!opts.isNvr) {
        const first = opts.statuses.find(item => item.channel === 0) ?? opts.statuses[0];
        return [{
            channel: 0,
            online: true,
            uid: first?.uid ?? opts.serial,
            name: first?.name ?? opts.hostName,
            model: first?.model ?? opts.hostModel,
        }];
    }

    const online = opts.statuses.filter(item => item.online !== false && item.uid);
    if (online.length > 0) return online;

    if (opts.statuses.length > 0) {
        return opts.statuses.filter(item => item.online !== false);
    }

    return Array.from({ length: opts.channelCount }, (_, channel) => ({ channel }));
}

function pickDeviceName(devInfo: Record<string, unknown>): string | undefined {
    return toStringValue(devInfo.name)
        ?? toStringValue(devInfo.deviceName)
        ?? toStringValue(devInfo.DevName);
}

function looksLikeNvr(devInfo: Record<string, unknown>): boolean {
    const type = `${toStringValue(devInfo.exactType) ?? toStringValue(devInfo.type) ?? ''}`.toUpperCase();
    return type.includes('NVR') || type === 'HOMEHUB';
}

function normalizeChannelName(value?: string): string | undefined {
    if (!value || value === '0' || value === '1') return undefined;
    return value;
}

function normalizeEncoding(value: unknown): 'h264' | 'h265' | undefined {
    const text = String(value ?? '').trim().toLowerCase();
    if (text === 'h264') return 'h264';
    if (text === 'h265' || text === 'hevc') return 'h265';
    return undefined;
}

function normalizeRtspUrl(url: string | undefined, username: string, password: string): string | undefined {
    if (!url) return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    if (!/^rtsps?:\/\//i.test(trimmed)) return undefined;
    return injectRtspCredentials(trimmed, username, password);
}

function dedupeStrings(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function buildReolinkFlvUrl(
    profile: ReolinkHostProfile,
    channel: number,
    stream: ReolinkStream,
    username: string,
    password: string,
): string | undefined {
    if (!profile.httpEnabled || !profile.rtmpEnabled) return undefined;
    const suffix = toReolinkStreamSuffix(channel, stream);
    const scheme = profile.useHttps ? 'https' : 'http';
    return `${scheme}://${profile.host.hostname}:${profile.httpPort}/flv?port=${profile.rtmpPort}&app=bcs&stream=${suffix}&user=${username}&password=${password}`;
}

function buildReolinkRtmpUrl(
    profile: ReolinkHostProfile,
    channel: number,
    stream: ReolinkStream,
    username: string,
    password: string,
): string | undefined {
    if (!profile.rtmpEnabled) return undefined;
    const suffix = toReolinkStreamSuffix(channel, stream);
    const streamType = stream === 'sub' || stream === 'autotrack_sub' || stream === 'telephoto_sub' ? 1 : 0;
    return `rtmp://${profile.host.hostname}:${profile.rtmpPort}/bcs/${suffix}?channel=${channel}&stream=${streamType}&user=${username}&password=${password}`;
}

function toReolinkStreamSuffix(channel: number, stream: ReolinkStream): string {
    switch (stream) {
        case 'sub':
            return `channel${channel}_sub.bcs`;
        case 'ext':
            return `channel${channel}_ext.bcs`;
        case 'autotrack_main':
        case 'telephoto_main':
            return `channel${channel}_autotrack.bcs`;
        case 'autotrack_sub':
        case 'telephoto_sub':
            return `channel${channel}_sub.bcs`;
        default:
            return `channel${channel}_main.bcs`;
    }
}

function composeReolinkHostInput(host: string, port?: number, useHttps?: boolean): string {
    if (/^[a-z]+:\/\//i.test(host)) return host;
    if (port === undefined && useHttps === undefined) return host;
    const scheme = useHttps ? 'https' : 'http';
    return `${scheme}://${host}${port !== undefined ? `:${port}` : ''}`;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function toNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined);
}

function toStringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toFlag(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

function parseBoolean(value: unknown): boolean | undefined {
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false') return false;
    return undefined;
}

function pickPort(useHttps: boolean, httpPort: unknown, httpsPort: unknown): number | undefined {
    return useHttps ? toNumber(httpsPort) : toNumber(httpPort);
}

export const reolinkProvider: CameraAddProvider = {
    meta: {
        id: 'reolink',
        label: 'Reolink',
        description: 'Sign in to a Reolink camera or NVR and fill the stream automatically.',
        discoverable: true,
    },

    async discover(ctx, cameras): Promise<DiscoveredCameraDevice[]> {
        const host = String(ctx.host ?? '').trim();
        const username = String(ctx.username ?? '').trim();
        const password = String(ctx.password ?? '');

        if (!host || !username) {
            throw new Error('host and username are required');
        }

        const profile = await loadReolinkHostProfile(host, username, password);
        const out: DiscoveredCameraDevice[] = [];

        for (const channel of profile.channels) {
            if (isReolinkAlreadyAdded(cameras as Camera[], profile.host.hostname, channel.channel, channel.uid)) continue;
            const label = channel.name
                || (profile.isNvr ? `${profile.name || profile.host.hostname} — channel ${channel.channel + 1}` : (profile.name || profile.host.hostname));
            out.push({
                id: String(channel.channel),
                label,
                detail: [channel.model || profile.model, `channel ${channel.channel + 1}`, channel.uid].filter(Boolean).join(' · '),
                payload: {
                    host: profile.host.hostname,
                    channel: channel.channel,
                    uid: channel.uid,
                    httpPort: profile.httpPort,
                    useHttps: profile.useHttps,
                    rtspPort: profile.rtspPort,
                    onvifPort: profile.onvifPort,
                    isNvr: profile.isNvr,
                },
            });
        }

        return out;
    },

    async resolve(ctx) {
        const host = String(ctx.payload?.host ?? ctx.host ?? '').trim();
        const channel = Number(ctx.payload?.channel ?? ctx.channel ?? ctx.deviceId) || 0;
        const username = String(ctx.username ?? '').trim();
        const password = String(ctx.password ?? '');
        const requestPort = toNumber(ctx.payload?.httpPort ?? ctx.port);
        const requestUseHttps = parseBoolean(ctx.payload?.useHttps);

        if (!host || !username) {
            throw new Error('host and username are required');
        }

        const profile = await loadReolinkHostProfile(
            composeReolinkHostInput(host, requestPort, requestUseHttps),
            username,
            password,
        );
        const channelProfile = await loadReolinkChannelProfile(profile, username, password, channel);
        const selected = resolveReolinkStream(profile, channelProfile, username, password);
        const name = channelProfile.name
            || (profile.isNvr ? `${profile.name || profile.host.hostname} Ch${channel + 1}` : (profile.name || profile.host.hostname));
        const onvifUrl = buildReolinkOnvifUrl(profile);

        return {
            name,
            rtspUrl: selected.url,
            rtspUrlRedacted: redactRtspUrl(selected.url),
            addSource: 'reolink',
            manufacturer: 'Reolink',
            model: channelProfile.model || profile.model,
            username,
            password: password || undefined,
            reolinkChannel: channel,
            reolinkHost: profile.host.hostname,
            reolinkHttpPort: profile.httpPort,
            reolinkUseHttps: profile.useHttps,
            reolinkRtspPort: profile.rtspPort,
            reolinkProtocol: selected.protocol,
            reolinkStream: selected.stream,
            reolinkDeviceUid: channelProfile.uid,
            reolinkIsNvr: profile.isNvr,
            onvifUrl,
            suggestedMotionSource: 'auto',
            suggestedMotionReason: `reolink-native — native api.cgi preferred over ONVIF (${selected.protocol.toUpperCase()} ${selected.stream})`,
        };
    },
};
