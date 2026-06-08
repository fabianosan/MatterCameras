# WebRTC live view debugging (SmartThings / Matter)

This document tracks ICE/WebRTC issues when bridging RTSP cameras to SmartThings via Matter 1.5, and how the patched go2rtc image is built and deployed.

## Symptom checklist

| Stage | OK signal | Failure signal |
|-------|-----------|----------------|
| Snapshot | JPEG ~20–40 KB in app logs | HTTP 404 / empty body |
| Signaling | `ProvideOffer` → go2rtc answer in ~6 s | `WebSocket ICE exchange timeout` |
| ICE pairs | `state: succeeded` on LAN host pair | All pairs `failed` / `InProgress` forever |
| Nomination | `nominated: true` on one pair | `nominated: false` after ~10 s → `ICE connection state: failed` |
| Media | DTLS / SRTP logs in go2rtc | DTLS never starts |

## Root causes found (2025-06)

### 1. pion `MaxBindingRequests` too low (fixed)

On LAN, STUN binding responses take ~25 ms. pion defaults to `MaxBindingRequests=7` and bursts pings across all pairs in ~11 ms, marking pairs failed before responses arrive.

**Patch:** `docker/go2rtc/patch-ice.diff` → `s.SetICEMaxBindingRequests(100)` in `pkg/webrtc/api.go`.

### 2. Hub never nominates a pair (in progress)

After patch 1, pairs reach `state: succeeded` (e.g. `192.168.1.50:8555 ↔ 192.168.40.120:xxxxx`) but iOS controlling side keeps `nominated: false`. Logs showed **14 local candidates** (TCP ephemeral, srflx, relay) plus TURN `403 Forbidden IP`. DTLS never started.

**Hypothesis:** SmartThings ICE scorer is confused by noisy non-host candidates; controlling agent does not nominate even when a host pair works.

**Patch 2 (current test):**

| Layer | Change |
|-------|--------|
| go2rtc `api.go` | `s.SetLite(true)` — bridge is passive; hub is controlling |
| go2rtc `candidates.go` | `FilterCandidate`: only **host + UDP** on `filters.ips` |
| `data/go2rtc.yaml` | `networks: [udp4]` only; drop STUN/TURN on bridge |
| Matter app | Do not pass hub `ice_servers` into go2rtc WS; filter candidates to host UDP `:8555` before `ProvideIceCandidates` |

## Patched go2rtc build

```bash
# Local (verify patches apply)
cd docker/go2rtc
docker build -t matter-go2rtc:patched .

# Server (from deploy dir)
docker compose build --no-cache go2rtc
docker compose up -d go2rtc
```

Patches applied in order:

1. `patch-ice.diff` — `MaxBindingRequests` + `ice-lite`
2. `patch-candidates.diff` — host UDP only

## go2rtc.yaml (production template)

```yaml
webrtc:
  listen: ":8555"
  candidates:
    - <MATTER_HOST>:8555
  filters:
    networks: [udp4]
    ips: [<MATTER_HOST>]
```

Do **not** set `ice_servers` on the bridge; hub TURN/STUN is for the controller only.

## Deploy procedure

**Never overwrite** `data/cameras.json` or `data/matter-storage/` (see `.cursor/rules/deployment-safety.mdc`).

### go2rtc + yaml + app code changed

```bash
./scripts/deploy.sh
```

Or targeted rebuild on server:

```bash
docker compose build --no-cache go2rtc app
docker compose up -d go2rtc app
```

`scripts/quick-deploy.sh` only syncs `dist/` and restarts the app container; it does **not** update the Docker image. Rebuild `app` after TypeScript changes.

### Enable verbose ICE logs (already in docker-compose.yml)

```yaml
environment:
  - PION_LOG_DEBUG=all
  - PION_LOG_TRACE=ice,dtls
```

Watch during an iOS live-view attempt:

```bash
docker logs -f matter_go2rtc 2>&1 | grep -E 'nominated|ICE connection|DTLS'
docker logs -f matter_cameras 2>&1 | grep -E 'ProvideOffer|ICE candidates|Filtered'
```

## What to look for in the next test

1. App log: `Filtered bridge ICE candidates … 14→1` (or similar small count).
2. App log: `ICE candidates delivered … count=1` (+ end-of-candidates).
3. go2rtc: answer SDP contains `a=ice-lite`.
4. go2rtc: only one `typ host` UDP candidate on `:8555`.
5. go2rtc: `nominated: true` then DTLS handshake.

## If live view still fails

- Capture full go2rtc ICE trace for one session.
- Check whether hub sends only host candidates or many srflx/relay (Matter `ProvideOffer` SDP).
- Try disabling Tailscale on iPhone during LAN test (hub had `100.x` candidates in prior logs).
- Consider WHIP path vs WebSocket path (Matter uses WS via `Go2RTCClient.#exchangeWebRtcViaWebSocket`).

## Related files

| File | Role |
|------|------|
| `docker/go2rtc/patch-ice.diff` | pion SettingEngine: binding limit + ice-lite |
| `docker/go2rtc/patch-candidates.diff` | Trickle filter: host UDP only |
| `src/matter/behaviors/MatterWebRtcTransportProviderServer.ts` | Matter signaling, candidate filter |
| `src/matter/webrtcIce.ts` | SDP parse + `filterLocalBridgeCandidates` |
| `src/streaming/Go2RTCClient.ts` | WebSocket offer/answer + trickle gather |
