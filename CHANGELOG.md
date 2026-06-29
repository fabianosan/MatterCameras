# Changelog

All notable changes to **Matter Cameras Bridge** are documented here ([Keep a Changelog](https://keepachangelog.com/), [SemVer](https://semver.org/)).

**Agent note:** This file is **date-stamped release notes only** — no architecture overview. System context: `README.md`, `docs/INSTALL.md`, `docs/MATTER-CAMERA.md`, `docs/AGENT-CONTEXT.md` (local). Public install scripts: `scripts/setup.sh`, `scripts/self-update.sh`. On release: move `[Unreleased]` → `[X.Y.Z] — YYYY-MM-DD`, run `npm run release`, tag `vX.Y.Z`, publish a [GitHub Release](https://github.com/patricktd/MatterCameras/releases).

Repository: [github.com/patricktd/MatterCameras](https://github.com/patricktd/MatterCameras) — pre-1.0 **beta**.

---

## [Unreleased]

---

## [0.4.0-beta] — 2026-06-29

First public beta under the **Matter Cameras Bridge** name.

### Added

- **Software update notifications** — Web UI checks [GitHub Releases](https://github.com/patricktd/MatterCameras/releases) and shows a banner when a newer version is available.
- **One-click self-update (optional)** — `docker-compose.update.yml` + `scripts/self-update.sh` (git checkout tag, `npm ci`, rebuild containers); `data/` preserved.
- **Mechanical PTZ (beta)** — Matter `CameraAvSettingsUserLevelManagement`; Reolink `PtzCtrl` or ONVIF moves; `POST /api/cameras/:id/ptz/*`, `GET …/ptz/probe`.
- **Person presence hold time** — configurable 30s–5min (default 60s) for Reolink / UniFi person sensors.
- **Reset ST binding** — recreates bridged endpoints with new `uniqueId` for stale SmartThings mappings.
- **Separate bridged Reolink light** — optional Matter Dimmable Light via WhiteLed API.
- **Separate bridged person sensor** — person-only events on a dedicated endpoint (Reolink / UniFi).
- **Permanent hub-adoption logs** — `Hub adopted bridged camera=…` on first hub use per endpoint.
- **Camera add providers** — UniFi Protect, Reolink, ONVIF, Tapo/Sonoff, Manual RTSP (`docs/CAMERA-PROVIDERS.md`).
- **UniFi Protect** — saved controller login, bulk import, link existing cameras.
- **Motion providers** — registry + Reolink native, UniFi Protect WebSocket, ONVIF PullPoint, frame-diff (`docs/MOTION-PROVIDERS.md`).
- **Duplicate camera**, **dashboard JPEG preview**, ONVIF WS-Discovery, RTSP redaction, SmartThings 4-camera warning.
- **Zone Management** + **OccupancySensing** for hub motion routines.
- **ImageControl** (flip / rotation) via go2rtc ffmpeg.

### Changed

- **Display name** — **Matter Cameras Bridge**; CSA trademark disclaimer in Web UI; hub `productName` updated.
- **Install docs** — Linux/macOS host, SmartThings reference platform, Web UI security, camera provider matrix.
- **Release versioning** — version bumped only via `npm run release` (not on every code sync).
- **Mechanical PTZ exposure** — cluster only after successful probe; UniFi excluded.
- **Per-camera PTZ pan invert** — `ptzInvertPan` for SmartThings Android.
- **Reolink spotlight probe** — active WhiteLed check; no phantom light endpoints.
- **Person vs camera motion** — person detection on optional presence sensor only.
- **Reolink add flow** — sub-stream default, richer discovery API, persisted connection metadata.
- **Web UI restart** — **Restart Required** after roster changes; waiting page with poll.
- **Privacy** — runtime `data/config.json`, `go2rtc.yaml` gitignored; templates in `data/*.example`.
- Matter hubs described generically in docs; SmartThings where behavior is hub-specific.

### Fixed

- Android / iOS PTZ (`mptzSetPosition`, pan invert, preset jumps, hold-to-move).
- NVR PTZ on Reolink Home Hub; UniFi edit form field bleed; PTZ on non-PTZ cameras.
- Reolink WhiteLed probe regression (no spotlight toggle on passive checks).
- Live view first-attempt / slow opens (pre-warm strategy).
- Dashboard hang on parallel Reolink probes; person/light checkbox save parsing.
- UniFi bulk import (single Protect login per batch); roster persistence (`lowdb` stale writes).
- ONVIF motion PullPoint (shared subscription per NVR, topic parsing).
- Motion boot race, factory reset storage cleanup, pairing code rotation.
- Startup crash after stale Matter fabric; ICE / WebRTC signaling order for SmartThings.

### Removed

- Maintainer-only deploy/sync/commit tooling from the public repository (private copies on operator NAS).

---

## [0.3.0-beta] — 2026-06-08

### Added

- Camera editing in Web UI; `POST /api/cameras/:id`; live log panel.
- Dynamic camera removal; metadata updates on rename.
- WebRTC pre-warm, periodic go2rtc prune, per-camera locks, ICE trickle.
- JPEG snapshots; `docs/SCALING.md`, `docs/INSTALL.md`; Web UI wizard and version badge.
- SmartThings live view WebRTC (iOS + Android); Zone Management + OccupancySensing.
- ONVIF motion (optional); RTSP frame-diff motion; `docs/MATTER-CAMERA.md`.

### Changed

- Documentation in English; `Go2RTCClient` rewrite; startup registers cameras before `bridge.start()`.
- Docker go2rtc healthcheck; Matter ICE / go2rtc ffmpeg tuning for SmartThings.

### Fixed

- Orphan go2rtc streams; live view cold start; hub `ice_servers` over WebSocket.
- Motion routines via OccupancySensing; deferred WebRTC answer (Matter 1.5 §11.5.7.4).
- Version display after container restart; ONVIF dependency in Docker image.

---

## [0.2.0] — 2026-06-08

### Added

- go2rtc `waitUntilReady`, `ensureStream`, `captureFrame`; WebRTC retry on 404.
- Dual streams per camera (RTSP + H.264 `_webrtc` transcode).

### Changed

- Expanded WebRTC diagnostic logging.

---

## [0.1.0] — 2026-06-08

### Added

- Matter 1.5 bridge (`matter.js` 0.17): Aggregator + bridged Camera `0x0142`.
- go2rtc integration; Web UI (pairing QR, add/remove cameras, factory reset).
- `data/cameras.json` storage; Docker Compose host networking.
- `scripts/setup.sh` for first-time install.

---

## [0.0.1] — 2026-06-05

### Added

- Initial repository and README stub.

---

[Unreleased]: https://github.com/patricktd/MatterCameras/compare/v0.4.0-beta...HEAD
[0.4.0-beta]: https://github.com/patricktd/MatterCameras/releases/tag/v0.4.0-beta
[0.3.0-beta]: https://github.com/patricktd/MatterCameras/compare/v0.2.0...v0.3.0-beta
[0.2.0]: https://github.com/patricktd/MatterCameras/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/patricktd/MatterCameras/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/patricktd/MatterCameras/releases/tag/v0.0.1
