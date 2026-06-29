# Motion Providers — Phase 0 Research

Last updated: **2026-06-24**. Research spike before implementing a Scrypted-inspired,
brand-specific motion provider architecture.

## Scope

Production camera mix (operator):

| Brand | Role today | Motion path in Matter Cameras Bridge today |
|-------|------------|-------------------------------------|
| **UniFi Protect** | RTSP from Protect NVR/cameras | `frame-diff` or generic ONVIF (if exposed) |
| **Reolink** | Direct RTSP | `frame-diff` or generic ONVIF |
| **Tapo** | RTSP via Camera Account | `onvif` (PullPoint) when firmware allows |
| **Sonoff / generic ONVIF** | ONVIF discovery | `onvif` (PullPoint) |

Goal: make Matter Cameras Bridge **scalable** (more brands, more cameras, lower CPU) without
adopting Scrypted's full RPC/plugin runtime.

---

## Scrypted open-source reference

| Component | Status | Relevance |
|-----------|--------|-----------|
| [koush/scrypted](https://github.com/koush/scrypted) monorepo | Open (per-directory licenses) | Server + ~40 plugins in `plugins/` |
| Camera plugins (Hikvision, Reolink, UniFi, ONVIF, Tapo, …) | Mostly **Apache-2.0** | Reference implementations, not dependencies |
| `@scrypted/sdk` + RPC host | Open | **Do not port** — overkill for Matter bridge |
| Scrypted NVR | **Closed / paid** | Object detection ML stack — out of scope |

Scrypted pattern worth copying: **vendor-native events first**, ONVIF second, video
analysis last.

---

## Per-brand findings (from Scrypted source)

### UniFi Protect

**Scrypted plugin:** `plugins/unifi-protect` (Apache-2.0)

| Item | Detail |
|------|--------|
| Protocol | HTTP REST login + **WebSocket** push (`unifi-protect` npm) |
| Motion | WS `event` with `type: 'motion'`; also `camera.isMotionDetected` state updates |
| Hold time | **25 s** debounce (no reliable motion-end from Protect) |
| Smart detect | `smartDetectZone` / `smartDetectLine` → `smartDetectTypes[]` (person, vehicle, animal, licensePlate, …) |
| ONVIF | Not used |

**Key files to study:**

- `src/main.ts` — login, WS listener, event routing
- `src/camera.ts` — `MotionSensor`, `ObjectDetector`
- `src/camera-sensors.ts` — debounce timers

**Port to Matter Cameras Bridge:** thin `ProtectEventClient` (~200 lines): login, subscribe WS,
map `motion` → Matter `ZoneTriggered`. Optional: filter occupancy on `person` only via
smart detect types. Requires Protect controller IP + local user credentials (not cloud).

**Scalability note:** one WS connection per Protect **controller** (NVR/console), not per
camera — same pattern as our ONVIF hub per endpoint.

---

### Reolink

**Scrypted plugin:** `plugins/reolink` (Apache-2.0)

| Item | Detail |
|------|--------|
| Native protocol | HTTP `http://{host}/api.cgi` — token auth (`cmd=Login`) |
| Native motion | Poll **1 s**: `GetMdState` → `value.state` (0/1) |
| Native AI | `GetAiState` → `people`, `vehicle`, `dog_cat`, `face`, `package`, `other` with `alarm_state` |
| Hold time | **20 s** (configurable in Scrypted) |
| ONVIF fallback | Shared ONVIF plugin when `useOnvifDetections` enabled; Reolink-specific topic map |

**Native API commands:**

```
POST/GET  /api.cgi?cmd=Login
GET       /api.cgi?cmd=GetMdState&channel=N&token=...
GET       /api.cgi?cmd=GetAiState&channel=N&token=...
POST      [{ "cmd": "GetEvents", "param": { "channel": N } }]   # battery / PIR models
```

**ONVIF topic → class (Reolink firmware):**

| Topic fragment | Class |
|----------------|-------|
| `PeopleDetect` | person |
| `VehicleDetect` | vehicle |
| `DogCatDetect` | pet |
| `FaceDetect` | face |
| `Package` | package |

**Port to Matter Cameras Bridge:** `ReolinkMotionProvider` — prefer native polling when
manufacturer/model matches; ONVIF as fallback. Poll **both** `GetMdState` and `GetAiState`
(Reolink AI may suppress raw motion when objects are detected).

**Scalability note:** 1 s HTTP poll per camera is light; batching not needed until ~20+
Reolink cameras on one node.

---

### Tapo

**Scrypted plugin:** `plugins/tapo` — **audio only** (two-way talk mixin on ONVIF cameras)

| Item | Detail |
|------|--------|
| Motion | **None in Tapo plugin** — entirely via ONVIF plugin |
| ONVIF port | Often **2020** (not 80) |
| Credentials | Tapo app → Advanced → **Camera Account** (not cloud password) |
| Known issues | Some firmware broke PullPoint (C200 1.3.6); HA uses webhooks, Scrypted does not |

**Typical ONVIF topics:** `RuleEngine/CellMotionDetector/Motion`, `MotionAlarm`

**Port to Matter Cameras Bridge:** no Tapo-specific provider for motion. Improve generic ONVIF
provider with Tapo ops docs + CellMotion debounce (see below). Optional future: HTTP
webhook ingress if PullPoint fails on a model.

---

### Generic ONVIF (Sonoff, Imou, Hikvision-via-ONVIF, Tapo, …)

**Scrypted plugin:** `plugins/onvif` (Apache-2.0)

| Item | Detail |
|------|--------|
| Protocol | ONVIF SOAP + **WSPullPoint** (`onvif` npm) |
| Hold time | **30 s** debounce; `MotionStop` **re-extends** hold (does not clear immediately) |
| CellMotion quirk | `RuleEngine/CellMotionDetector/Motion` — timeout-only path (ignore false) |
| Smart detect | `GetEventProperties` → `ruleEngine.objectDetector` topic map |
| Doorbell | `Visitor`, `VideoSource/Alarm` + ring topics |

**Topic handling (Scrypted `onvif-api.ts`):**

| Topic | Behavior |
|-------|----------|
| `MotionAlarm` | Start/stop from `Value` true/false |
| `CellMotionDetector/Motion` | Pulse → hold 30 s (ignore false) |
| `RuleEngine/ObjectDetector` | Class name from firmware (`Human`, `Vehicle`, …) |
| `Visitor` | Binary doorbell event |

**Matter Cameras Bridge today (`src/onvif/`):**

| Feature | Status |
|---------|--------|
| Shared PullPoint per endpoint (NVR-safe) | ✅ `motionSubscriptionHub.ts` |
| Topic markers | ✅ `motionTopics.ts` (partial list) |
| Parse `SimpleItem` state | ✅ `parseOnvifMotionEvent.ts` |
| Namespace strip (`tns1:` → ``) | ❌ missing |
| CellMotion timeout-only | ❌ uses boolean edge only |
| MotionStop re-debounce | ❌ clears on false |
| ObjectDetector / smart classes | ❌ not implemented |
| Doorbell / Visitor topics | ❌ not in markers |

**Highest-value ONVIF improvements (from Scrypted):**

1. `stripNamespaces()` before topic match
2. 30 s hold timer per camera (configurable), extend on any motion pulse
3. CellMotion: treat as pulse-only (do not go inactive on `false`)
4. Expand markers: `Visitor`, `VideoSource/Alarm`, `ObjectDetector`, Reolink AI topics
5. Per-camera `binaryStateEvent` for doorbells (future)

---

## Brand → recommended provider matrix

| Brand | Primary provider | Fallback chain | Smart detect (future) |
|-------|------------------|----------------|----------------------|
| **UniFi Protect** | `unifi-protect` (WS) | ONVIF if cam exposes it → frame-diff | `smartDetectTypes` from WS |
| **Reolink** | `reolink-native` (api.cgi poll) | ONVIF enhanced → frame-diff | `GetAiState` classes |
| **Tapo** | `onvif` (port 2020, Camera Account) | frame-diff → webhook (future) | ONVIF ObjectDetector if exposed |
| **Sonoff / generic** | `onvif` | frame-diff | ONVIF ObjectDetector if exposed |

Auto-detect at `POST /api/onvif/resolve` (future):

```
manufacturer/model match → suggested motionProvider + confidence
```

Example rules:

- `manufacturer` contains `Reolink` → `reolink-native`
- RTSP host is Protect controller / known UniFi → `unifi-protect` (manual config first)
- `manufacturer` contains `Sonoff` → `onvif`
- Tapo models → `onvif` + hint `port=2020`

---

## Scalability architecture (target)

Matter Cameras Bridge must scale along **three axes**: more cameras per node, more brands, and
(optionally) multiple bridge nodes.

### Axis 1 — Motion provider registry (in-process)

Replace hard-coded `motionSource: 'frame-diff' | 'onvif'` with a registry:

```
MotionDetectionService
  └── MotionProviderRegistry
        ├── FrameDiffProvider      (builtin, always available)
        ├── OnvifMotionProvider    (builtin, shared hub)
        ├── ReolinkNativeProvider  (phase 3)
        ├── UniFiProtectProvider   (phase 3)
        └── WebhookProvider        (phase 4, optional)
```

Each provider implements:

```typescript
interface MotionProvider {
  id: string;
  label: string;
  priority: number;  // lower = tried first in auto mode
  canHandle(camera: Camera): Promise<ProviderMatch | null>;
  start(camera: Camera, ctx: MotionContext): Promise<void>;
  stop(cameraId: string): void;
}
```

`MotionContext` supplies shared services (go2rtc client, config, logger) — no RPC.

**Auto mode resolution:**

```
explicit motionProvider in cameras.json
  → try canHandle() match
  → ONVIF probe (if onvifUrl or discovery metadata)
  → brand heuristics (manufacturer/model)
  → frame-diff
```

On failure: log, try next in chain (same as today's ONVIF → frame-diff).

### Axis 2 — Shared connections (already started)

| Resource | Sharing unit | Matter Cameras Bridge |
|----------|--------------|---------------|
| ONVIF PullPoint | per `host:port:path` | ✅ `motionSubscriptionHub` |
| UniFi Protect WS | per controller IP | 🔲 one `ProtectHub` (phase 3) |
| Reolink HTTP | per camera (light poll) | 🔲 one timer per camera |

### Axis 3 — Multi-node / horizontal scale

Per `docs/SCALING.md`, single-node practical limit is **~5–8 cameras** with transcoding.
For growth beyond a single hub's ~50-device comfort zone (e.g. SmartThings):

```
                    ┌─────────────────────┐
                    │  Matter hub         │
                    └──────────┬──────────┘
                               │ Matter
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │ Bridge node A│    │ Bridge node B│    │ Bridge node C│
   │ 4–8 cameras  │    │ 4–8 cameras  │    │ 4–8 cameras  │
   │ UniFi + …    │    │ Reolink + …  │    │ Tapo + …     │
   └──────────────┘    └──────────────┘    └──────────────┘
```

Requirements for multi-node (not implemented today):

| Concern | Approach |
|---------|----------|
| Separate Matter fabrics | One `matter-storage/` per node; separate pairing QR per node |
| Camera roster | `data/cameras.json` per node; Web UI shows node id |
| Deploy | Per-host Docker install; never overwrite `data/` on production hosts |
| Discovery | ONVIF scan per subnet; document which node owns which VLAN |
| CPU | Prefer native motion events (ONVIF, Reolink, UniFi) over frame-diff |

### Axis 4 — Configuration model evolution

Current:

```json
{ "motionSource": "onvif", "onvifUrl": "http://…" }
```

Target:

```json
{
  "motionProvider": "auto",
  "motionProviderConfig": {
    "unifi": { "controllerHost": "192.168.x.x", "cameraId": "…" },
    "reolink": { "channel": 0, "preferNative": true },
    "onvif": { "url": "http://…:2020/onvif/device_service" },
    "holdSeconds": 25
  }
}
```

Backward compatible: `motionSource: onvif` maps to `motionProvider: onvif`.

---

## Gap summary vs Scrypted

| Capability | Scrypted | Matter Cameras Bridge now | Phase |
|------------|----------|-------------------|-------|
| UniFi WS motion | ✅ | ❌ | 3b |
| Reolink api.cgi | ✅ | ❌ | 3a |
| Tapo motion | via ONVIF | via ONVIF (partial) | 2 (ONVIF hardening) |
| ONVIF debounce / CellMotion | ✅ mature | basic edge detect | 2 |
| ONVIF smart classes | ✅ | ❌ | 5 |
| Provider auto-select | manual plugin install | manual dropdown | 2 |
| Webhook motion | ✅ | ❌ | 4 |
| Software CV (OpenCV) | ✅ | frame-diff only | optional 6 |

---

## Implementation roadmap (post–phase 0) — **phase 1 complete** (see `docs/MOTION-PROVIDERS.md`).

### Phase 1 — Provider interface (no behavior change) ✅

- `src/motion/types.ts`, `MotionProviderRegistry`
- Wrap existing `OnvifMotionDetector` + `RtspMotionDetector`
- Unit tests: `src/motion/resolveMotionProvider.test.ts`

### Phase 2 — ONVIF hardening ✅

- Namespace strip, hold timer, CellMotion pulse mode
- Expand `motionTopics.ts`
- `suggestedMotionProvider` in `/api/onvif/resolve`
- Web UI: Auto / vendor fields

### Phase 3a — Reolink native provider ✅

- `src/motion/providers/reolink/reolinkClient.ts`
- Auto-detect from `manufacturer` at resolve time

### Phase 3b — UniFi Protect provider ✅

- `src/motion/providers/unifi/protectHub.ts` + `unifi-protect` npm
- Manual `protectHost` + `protectCameraId` in Web UI

### Phase 4 — Webhook ingress

- `POST /api/motion/webhook/:cameraId` for Tapo/firmware that supports HTTP triggers
- Optional shared secret per camera

### Phase 5 — Smart detect → Matter

- Map `person` / `vehicle` to filtered occupancy (product decision)
- May require Matter zone types or hub re-profile

### Phase 6 — External plugins (only if needed)

- Dynamic `import()` from `data/motion-plugins/` for third-party providers
- Not needed until internal providers cover the production mix

---

## Operator checklist (per brand)

### UniFi

- [ ] Confirm cameras are on Protect (not standalone RTSP-only without WS)
- [ ] Create local Protect user for API/WS access
- [ ] Note controller IP and per-camera Protect id
- [ ] Until phase 3b: use ONVIF if enabled on camera, else frame-diff

### Reolink

- [ ] Enable ONVIF or note if native API only
- [ ] For battery/PIR models: expect `GetEvents` not `GetMdState`
- [ ] Until phase 3a: try ONVIF motion; fallback frame-diff

### Tapo

- [ ] Enable Third Party Compatibility in Tapo app
- [ ] Create Camera Account (not main account)
- [ ] ONVIF URL usually port **2020**
- [ ] If PullPoint fails after firmware update: frame-diff or webhook (future)

### Sonoff / generic ONVIF

- [ ] WS-Discovery in Web UI
- [ ] Set `motionSource: onvif` after resolve shows `supportsMotion: true`
- [ ] If events are flaky: check CellMotion — phase 2 debounce should help

---

## References

- Scrypted repo: https://github.com/koush/scrypted
- Scrypted plugin docs: https://developer.scrypted.app
- Scrypted ONVIF plugin: `plugins/onvif/src/onvif-api.ts`, `onvif-events.ts`
- Scrypted Reolink: `plugins/reolink/src/reolink-api.ts`
- Scrypted UniFi: `plugins/unifi-protect/src/main.ts`
- Matter Cameras Bridge scaling: `docs/SCALING.md`
- Matter Cameras Bridge ONVIF: `docs/MATTER-CAMERA.md` and `docs/INSTALL.md`
