import { WebRtcTransportDefinitions } from '@matter/types/clusters/web-rtc-transport-definitions';
import type { Go2RtcIceServer } from '../streaming/Go2RTCClient.js';

export function mapMatterIceServers(
    iceServers?: WebRtcTransportDefinitions.IceServer[],
): Go2RtcIceServer[] | undefined {
    if (!iceServers?.length) return undefined;

    const mapped = iceServers
        .map(s => ({
            urls: s.urLs ?? [],
            username: s.username,
            credential: s.credential,
        }))
        .filter(s => s.urls.length > 0);

    return mapped.length ? mapped : undefined;
}

/** Parse a=candidate lines from SDP into Matter IceCandidate objects. */
export function parseSdpIceCandidates(sdp: string): WebRtcTransportDefinitions.IceCandidate[] {
    const results: WebRtcTransportDefinitions.IceCandidate[] = [];
    let currentMid: string | null = null;
    let mLineIndex = -1;

    for (const line of sdp.split(/\r?\n/)) {
        if (line.startsWith('m=')) {
            mLineIndex++;
            currentMid = null;
        }
        if (line.startsWith('a=mid:')) {
            currentMid = line.slice(6);
        }
        if (line.startsWith('a=candidate:')) {
            results.push(new WebRtcTransportDefinitions.IceCandidate({
                candidate: line.slice(2),
                sdpMid: currentMid,
                sdpmLineIndex: mLineIndex >= 0 ? mLineIndex : null,
            }));
        }
    }

    return results;
}

/**
 * Keep only the bridge LAN host UDP candidate before sending to the Matter hub.
 * go2rtc also filters at source; this guards against trickle lines still in SDP.
 */
export function filterLocalBridgeCandidates(
    candidates: WebRtcTransportDefinitions.IceCandidate[],
    opts?: { host?: string; port?: string },
): WebRtcTransportDefinitions.IceCandidate[] {
    const host = opts?.host;
    const port = opts?.port ?? '8555';

    return candidates.filter(c => {
        const line = c.candidate;
        if (!/\btyp host\b/i.test(line)) return false;
        if (!/\bUDP\b/i.test(line)) return false;
        if (host && !line.includes(host)) return false;
        return line.includes(` ${port} `) || line.endsWith(` ${port}`);
    });
}

/** Append trickle candidates from go2rtc WebSocket into an SDP answer. */
export function appendTrickleCandidatesToSdp(sdp: string, trickleCandidates: string[]): string {
    if (!trickleCandidates.length) return sdp;

    const existing = new Set<string>();
    for (const line of sdp.split(/\r?\n/)) {
        if (line.startsWith('a=candidate:')) {
            existing.add(line);
        }
    }

    const additions: string[] = [];
    for (const raw of trickleCandidates) {
        const trimmed = raw.trim();
        if (!trimmed) continue;

        const line = trimmed.startsWith('a=candidate:')
            ? trimmed
            : trimmed.startsWith('candidate:')
                ? `a=${trimmed}`
                : `a=candidate:${trimmed}`;

        if (!existing.has(line)) {
            existing.add(line);
            additions.push(line);
        }
    }

    if (!additions.length) return sdp;

    const suffix = `${additions.join('\r\n')}\r\n`;
    return sdp.endsWith('\r\n') ? `${sdp}${suffix}` : `${sdp}\r\n${suffix}`;
}

/** Build WHEP trickle-ice-sdpfrag body from Matter ICE candidates. */
export function matterIceToSdpFrag(candidates: WebRtcTransportDefinitions.IceCandidate[]): string {
    const lines: string[] = [];

    for (const c of candidates) {
        const raw = c.candidate?.trim() ?? '';
        if (!raw || raw === 'end-of-candidates') {
            lines.push('a=end-of-candidates');
            continue;
        }
        const cand = raw.startsWith('candidate:') ? raw : `candidate:${raw}`;
        if (c.sdpMid != null) {
            lines.push(`a=mid:${c.sdpMid}`);
        } else if (c.sdpmLineIndex != null) {
            lines.push(`a=mid:${c.sdpmLineIndex}`);
        }
        lines.push(`a=${cand}`);
    }

    return `${lines.join('\r\n')}\r\n`;
}
