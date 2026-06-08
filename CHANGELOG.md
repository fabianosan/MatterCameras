# Changelog

Todas as mudanças relevantes do **MatterCameras** são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

Repositório: [github.com/patricktd/MatterCameras](https://github.com/patricktd/MatterCameras)

---

## Visão geral do sistema

O **MatterCameras** é uma bridge que expõe câmeras RTSP/ONVIF como dispositivos **Matter 1.5 Camera** (tipo `0x0142`) em um hub Matter — em especial **SmartThings** (Aeotec Hub v2) e outros controladores compatíveis.

### Fluxo de dados

```
RTSP/ONVIF → go2rtc (WebRTC + snapshots) → Matter Bridge (matter.js 0.17) → Hub Matter
```

### Componentes

| Componente | Caminho / serviço | Responsabilidade |
|------------|-------------------|------------------|
| **App Node.js** | `src/main.ts` | Orquestra storage, bridge Matter, go2rtc e Web UI |
| **Matter Bridge** | `src/matter/Bridge.ts` | Aggregator Matter (`0x0e`); adiciona endpoints de câmera bridged |
| **Câmera bridged** | `src/matter/devices/BridgedCameraDevice.ts` | Device type Camera `0x0142` com clusters AV + WebRTC |
| **AV Stream Management** | `src/matter/behaviors/MatterCameraAvStreamManagementServer.ts` | Live view H.264, snapshots JPEG, áudio stub |
| **WebRTC Provider** | `src/matter/behaviors/MatterWebRtcTransportProviderServer.ts` | Sinalização Matter ↔ go2rtc (`ProvideOffer`, ICE trickle) |
| **go2rtc client** | `src/streaming/Go2RTCClient.ts` | Registro de streams, transcode ffmpeg, WebRTC e frames |
| **Storage** | `src/storage/db.ts` | Persistência de câmeras em `data/cameras.json` (lowdb) |
| **Web UI** | `src/web/server.ts` + `views/` | Dashboard Express/EJS para gestão e pairing |
| **go2rtc** | container `alexxit/go2rtc` | Ingestão RTSP, relay WebRTC, API HTTP/WS |
| **Deploy** | `docker-compose.yml`, `scripts/deploy.sh` | Produção em `network_mode: host` (mDNS/Matter) |

### Portas padrão (produção)

| Porta | Serviço |
|-------|---------|
| 3202 | Web UI |
| 3203 | go2rtc API |
| 5550 | Matter (TCP/UDP) |
| 8554 | go2rtc RTSP relay |
| 8555 | WebRTC (TCP/UDP) |
| 5353 | mDNS (UDP) |

### Configuração

- Arquivo: `data/config.json`
- Variáveis de ambiente: `MATTER_HOST`, `MATTER_PORT`, `WEB_PORT`, `GO2RTC_URL`, `MATTER_PASSCODE`, etc.
- Dados persistentes: `data/` (câmeras, fabric Matter, `go2rtc.yaml`)

### Limites operacionais

Consulte [docs/SCALING.md](docs/SCALING.md) para recomendações de hardware, número de câmeras e gargalos (ffmpeg, TURN do hub, ~50 dispositivos bridged no SmartThings).

---

## [Unreleased]

### Planejado

- Descoberta automática ONVIF
- Eventos de movimento via Matter
- Aviso na Web UI ao ultrapassar 4+ câmeras
- Testes automatizados

---

## [1.0.0] — 2026-06-08

Primeira release funcional sincronizada com GitHub, com streaming estável, gestão de câmeras na UI e documentação de escala.

### Adicionado

- **Edição de câmeras** na Web UI (nome, URL RTSP, codec) sem remover/recriar o endpoint
- **API REST** `POST /api/cameras/:id` para atualizar câmeras existentes
- **Painel de logs** em tempo real na dashboard (`GET /api/logs`, polling a cada 2 s)
- **Remoção dinâmica** de câmeras no bridge Matter (`endpoint.delete()`)
- **Atualização de metadados** no bridge ao editar nome (`BridgedDeviceBasicInformation`)
- **Pre-warm WebRTC** no boot — inicia transcode ffmpeg antes do hub abrir live view (evita cold start > 5 s)
- **Prune periódico** de streams órfãos no go2rtc (intervalo padrão: 5 min)
- **`syncAllStreams()`** — re-registra todas as câmeras e remove entradas stale no go2rtc
- **Locks por câmera** no `Go2RTCClient` para serializar operações ffmpeg pesadas
- **WebRTC via WebSocket** quando o hub envia ICE servers TURN/STUN (SmartThings)
- **ICE trickle** — candidatos Matter mapeados para SDP e vice-versa (`webrtcIce.ts`)
- **Snapshots JPEG** via cluster Camera AV Stream Management (limite 48 KB, resolução máx. 640×360)
- **Documentação de escala** em `docs/SCALING.md`

### Alterado

- `Go2RTCClient` reescrito: health check, retry em 404, normalização de ICE, exchange WS + HTTP
- Ordem de inicialização: câmeras registradas **antes** de `bridge.start()` (hub não vê `partsList` vazio)
- `docker-compose.yml`: healthcheck no go2rtc com `depends_on: service_healthy`
- Web UI: layout de cards, ações inline (editar/cancelar), estilos no header

### Corrigido

- Streams go2rtc remanescentes após exclusão de câmera
- Falha de live view quando ffmpeg ainda não tinha subido o stream `_webrtc`
- Hub SmartThings ignorando `ice_servers` em requisições HTTP JSON (uso de API WebSocket do go2rtc)

---

## [0.2.0] — 2026-06-08

Melhorias iniciais no cliente go2rtc e resiliência de conexão.

### Adicionado

- `waitUntilReady()` — aguarda API go2rtc após restart do container (até 60 tentativas)
- `ensureStream()` — re-registra stream RTSP + `_webrtc` se ausente
- `captureFrame()` — captura JPEG para snapshots Matter
- Retry automático em `exchangeWebRtcOffer` quando go2rtc retorna 404
- Dois streams por câmera: RTSP direto + `{id}_webrtc` com transcode H.264 via ffmpeg

### Alterado

- Logs mais detalhados no fluxo WebRTC (tamanho SDP, modo ws/http, contagem relay)

---

## [0.1.0] — 2026-06-08

MVP da bridge Matter Camera com deploy Docker e Web UI básica.

### Adicionado

- **Matter Bridge** com `matter.js` 0.17 / Matter 1.5
  - Aggregator device type `0x0e`
  - Endpoints bridged Camera `0x0142` por câmera RTSP
- **Clusters Matter implementados**
  - `BridgedDeviceBasicInformation`
  - `CameraAvStreamManagement` (vídeo H.264 LiveView, snapshot, áudio stub)
  - `WebRtcTransportProvider` (`ProvideOffer`, `ProvideAnswer`, `ProvideIceCandidates`)
- **Integração go2rtc** — registro PUT `/api/streams`, WebRTC POST `/api/webrtc`
- **Web UI** (Express + EJS)
  - Adicionar/remover câmeras
  - QR code e código manual de pairing Matter
  - Factory reset do fabric (`POST /api/reset`)
- **Storage** JSON com lowdb (`data/cameras.json`)
- **Configuração** via `data/config.json` + env vars (`src/config/app.ts`)
- **Docker**
  - `Dockerfile` multi-stage para app Node
  - `docker-compose.yml` com go2rtc + app em `network_mode: host`
- **Deploy remoto** — `npm run deploy` (`scripts/deploy.sh`)
- **Patches Matter** — `tlvPatch.ts`, desabilitação de validação WebRTC estrita (`webrtcCommandValidation.ts`)
- **README** com arquitetura, quick start e instruções SmartThings

### Dependências principais

- `@matter/main`, `@project-chip/matter.js` ^0.17.1
- `express` ^4.21, `ejs` ^3.1, `lowdb` ^7.0
- `alexxit/go2rtc` (container)

---

## [0.0.1] — 2026-06-05

### Adicionado

- Repositório GitHub inicial com README stub ("Export Cameras to Matter")
- Histórico fundido com o projeto local em 2026-06-08 (merge `origin/main`)

---

## Legenda de tipos de mudança

| Tipo | Significado |
|------|-------------|
| **Adicionado** | Funcionalidade nova |
| **Alterado** | Mudança em comportamento existente |
| **Depreciado** | Será removido em versão futura |
| **Removido** | Funcionalidade removida |
| **Corrigido** | Correção de bug |
| **Segurança** | Correção de vulnerabilidade |

---

## Como atualizar este changelog

1. Agrupe mudanças em **[Unreleased]** durante o desenvolvimento.
2. Ao publicar, mova o conteúdo para uma nova seção `[X.Y.Z] — AAAA-MM-DD`.
3. Atualize `version` em `package.json` para manter consistência.
4. Commits relevantes: use mensagens que facilitem a entrada no changelog (ex.: `feat:`, `fix:`, `docs:`).

[Unreleased]: https://github.com/patricktd/MatterCameras/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/patricktd/MatterCameras/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/patricktd/MatterCameras/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/patricktd/MatterCameras/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/patricktd/MatterCameras/releases/tag/v0.0.1
