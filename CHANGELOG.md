# Changelog

All notable changes to **MatterCameras** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

Repository: [github.com/patricktd/MatterCameras](https://github.com/patricktd/MatterCameras)

> **Project status:** pre-1.0 **beta**. Versions stay below `1.0.0` until the bridge is considered production-stable. `1.0.0` will mark the first stable release.

---

## System overview

**MatterCameras** is a bridge that exposes RTSP/ONVIF cameras as **Matter 1.5 Camera** devices (type `0x0142`) on a Matter hub — primarily **SmartThings** (Aeotec Hub v2) and other compatible controllers.

### Data flow

```
RTSP/ONVIF → go2rtc (WebRTC + snapshots) → Matter Bridge (matter.js 0.17) → Matter Hub
```

### Components

| Component | Path / service | Responsibility |
|-----------|----------------|----------------|
| **Node.js app** | `src/main.ts` | Orchestrates storage, Matter bridge, go2rtc, and Web UI |
| **Matter Bridge** | `src/matter/Bridge.ts` | Matter Aggregator (`0x0e`); adds bridged camera endpoints |
| **Bridged camera** | `src/matter/devices/BridgedCameraDevice.ts` | Camera device type `0x0142` with AV + WebRTC clusters |
| **AV Stream Management** | `src/matter/behaviors/MatterCameraAvStreamManagementServer.ts` | H.264 live view, JPEG snapshots, audio stub |
| **WebRTC Provider** | `src/matter/behaviors/MatterWebRtcTransportProviderServer.ts` | Matter ↔ go2rtc signaling (`ProvideOffer`, ICE trickle) |
| **go2rtc client** | `src/streaming/Go2RTCClient.ts` | Stream registration, ffmpeg transcode, WebRTC, frames |
| **Storage** | `src/storage/db.ts` | Camera persistence in `data/cameras.json` (lowdb) |
| **Web UI** | `src/web/server.ts` + `views/` | Express/EJS dashboard for management and pairing |
| **go2rtc** | `alexxit/go2rtc` container | RTSP ingest, WebRTC relay, HTTP/WS API |
| **Deploy** | `docker-compose.yml`, `scripts/deploy.sh` | Production with `network_mode: host` (mDNS/Matter) |

### Default ports (production)

| Port | Service |
|------|---------|
| 3202 | Web UI |
| 3203 | go2rtc API |
| 5550 | Matter (TCP/UDP) |
| 8554 | go2rtc RTSP relay |
| 8555 | WebRTC (TCP/UDP) |
| 5353 | mDNS (UDP) |

### Configuration

- File: `data/config.json`
- Environment variables: `MATTER_HOST`, `MATTER_PORT`, `WEB_PORT`, `GO2RTC_URL`, `MATTER_PASSCODE`, etc.
- Persistent data: `data/` (cameras, Matter fabric, `go2rtc.yaml`)

### Operational limits

See [docs/SCALING.md](docs/SCALING.md) for hardware recommendations, camera counts, and bottlenecks (ffmpeg, hub TURN, ~50 bridged devices on SmartThings).

---

## [Unreleased]

### Planned

- ONVIF auto-discovery
- Motion events via Matter
- Web UI warning when adding more than 4 cameras
- Automated tests
- First stable release (`1.0.0`)

---

## [0.3.0-beta] — 2026-06-08

Current beta milestone: streaming, camera management, documentation, and Web UI polish. Synced to GitHub.

### Added

- Cursor agent rule (`.cursor/rules/documentation.mdc`) requiring changelog updates for major changes and English-only documentation
- **Camera editing** in the Web UI (name, RTSP URL, codec) without removing/recreating the endpoint
- **REST API** `POST /api/cameras/:id` to update existing cameras
- **Live log panel** on the dashboard (`GET /api/logs`, 2 s polling)
- **Dynamic removal** of cameras on the Matter bridge (`endpoint.delete()`)
- **Metadata updates** on the bridge when editing the camera name (`BridgedDeviceBasicInformation`)
- **WebRTC pre-warm** on boot — starts ffmpeg transcode before the hub opens live view (avoids cold start > 5 s)
- **Periodic prune** of orphan go2rtc streams (default interval: 5 min)
- **`syncAllStreams()`** — re-registers all cameras and removes stale go2rtc entries
- **Per-camera locks** in `Go2RTCClient` to serialize heavy ffmpeg operations
- **WebRTC over WebSocket** when the hub sends TURN/STUN ICE servers (SmartThings)
- **ICE trickle** — Matter candidates mapped to SDP and back (`webrtcIce.ts`)
- **JPEG snapshots** via Camera AV Stream Management cluster (48 KB limit, max resolution 640×360)
- **Scaling documentation** in `docs/SCALING.md`
- Web UI quick-start wizard, external CSS/JS assets, info bar with version badge
- `src/config/version.ts` — version read from `package.json` (UI + Matter device metadata)

### Changed

- Project version set to **0.3.0-beta** (pre-1.0; not a stable release)
- All project documentation translated to English (`CHANGELOG.md`, `docs/SCALING.md`, `README.md`, deploy comments)
- `Go2RTCClient` rewritten: health check, 404 retry, ICE normalization, WS + HTTP exchange
- Startup order: cameras registered **before** `bridge.start()` (hub does not see an empty `partsList`)
- `docker-compose.yml`: go2rtc healthcheck with `depends_on: service_healthy`
- Web UI: card layout, inline actions (edit/cancel), troubleshooting log panel

### Fixed

- Orphan go2rtc streams after camera deletion
- Live view failure when ffmpeg had not yet brought up the `_webrtc` stream
- SmartThings hub ignoring `ice_servers` on HTTP JSON requests (go2rtc WebSocket API used instead)

---

## [0.2.0] — 2026-06-08

Initial go2rtc client improvements and connection resilience.

### Added

- `waitUntilReady()` — waits for go2rtc API after container restart (up to 60 attempts)
- `ensureStream()` — re-registers RTSP + `_webrtc` stream if missing
- `captureFrame()` — JPEG capture for Matter snapshots
- Automatic retry in `exchangeWebRtcOffer` when go2rtc returns 404
- Two streams per camera: direct RTSP + `{id}_webrtc` with H.264 transcode via ffmpeg

### Changed

- More detailed WebRTC flow logs (SDP size, ws/http mode, relay count)

---

## [0.1.0] — 2026-06-08

Matter Camera bridge MVP with Docker deployment and basic Web UI.

### Added

- **Matter Bridge** with `matter.js` 0.17 / Matter 1.5
  - Aggregator device type `0x0e`
  - Bridged Camera `0x0142` endpoints per RTSP camera
- **Matter clusters implemented**
  - `BridgedDeviceBasicInformation`
  - `CameraAvStreamManagement` (H.264 LiveView video, snapshot, audio stub)
  - `WebRtcTransportProvider` (`ProvideOffer`, `ProvideAnswer`, `ProvideIceCandidates`)
- **go2rtc integration** — PUT `/api/streams` registration, WebRTC POST `/api/webrtc`
- **Web UI** (Express + EJS)
  - Add/remove cameras
  - Matter pairing QR code and manual code
  - Fabric factory reset (`POST /api/reset`)
- **JSON storage** with lowdb (`data/cameras.json`)
- **Configuration** via `data/config.json` + env vars (`src/config/app.ts`)
- **Docker**
  - Multi-stage `Dockerfile` for Node app
  - `docker-compose.yml` with go2rtc + app on `network_mode: host`
- **Remote deploy** — `npm run deploy` (`scripts/deploy.sh`)
- **Matter patches** — `tlvPatch.ts`, relaxed WebRTC command validation (`webrtcCommandValidation.ts`)
- **README** with architecture, quick start, and SmartThings instructions

### Dependencies

- `@matter/main`, `@project-chip/matter.js` ^0.17.1
- `express` ^4.21, `ejs` ^3.1, `lowdb` ^7.0
- `alexxit/go2rtc` (container)

---

## [0.0.1] — 2026-06-05

### Added

- Initial GitHub repository with README stub ("Export Cameras to Matter")
- History merged with local project on 2026-06-08 (merge `origin/main`)

---

## Change types

| Type | Meaning |
|------|---------|
| **Added** | New feature |
| **Changed** | Change in existing behavior |
| **Deprecated** | Will be removed in a future version |
| **Removed** | Removed feature |
| **Fixed** | Bug fix |
| **Security** | Vulnerability fix |

---

## How to update this changelog

1. Group changes under **[Unreleased]** during development.
2. On release, move content to a new `[X.Y.Z] — YYYY-MM-DD` section.
3. Update `version` in `package.json` to stay in sync.
4. Use commit messages that map cleanly to changelog entries (e.g. `feat:`, `fix:`, `docs:`).

[Unreleased]: https://github.com/patricktd/MatterCameras/compare/v0.3.0-beta...HEAD
[0.3.0-beta]: https://github.com/patricktd/MatterCameras/compare/v0.2.0...v0.3.0-beta
[0.2.0]: https://github.com/patricktd/MatterCameras/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/patricktd/MatterCameras/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/patricktd/MatterCameras/releases/tag/v0.0.1
