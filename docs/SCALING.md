# Limites e recomendações de escala

Documento de referência para quem for publicar ou operar a MatterCameras bridge em produção.

## Limites do ecossistema

| Camada | Limite prático | Notas |
|--------|----------------|-------|
| **Matter (protocolo)** | Até **255** endpoints dinâmicos por bridge | Limite teórico do spec; câmeras são endpoints pesados |
| **SmartThings + Matter bridge** | **~50** dispositivos bridged com boa estabilidade | Acima disso há relatos de instabilidade em instalações grandes ([1Home](https://tr.docs.netlify.1home.io/docs/en/server/matter-bridge/apps/samsung-smartthings)) |
| **SmartThings câmeras legado (SmartCam LAN)** | **4** câmeras | **Não se aplica** a câmeras Matter 1.5 |
| **Matter Camera (spec)** | `maxConcurrentEncoders` por endpoint | Esta bridge anuncia **1** encoder por câmera (RTSP → ffmpeg H.264) |

## Recomendações por tamanho de instalação

Estimativas para um servidor dedicado (ex.: NUC / mini PC na mesma LAN das câmeras), com câmeras UniFi/RTSP H.265 transcodificadas via ffmpeg:

| Câmeras | Snapshots (preview) | Live view (WebRTC) | Hardware |
|---------|---------------------|--------------------|----------|
| **1–2** | Confiável | 1 stream por vez; estável após TURN/ICE correto | 2+ cores, 4 GB RAM |
| **3–4** | Confiável | **1 live view de cada vez** recomendado | 4+ cores, 8 GB RAM |
| **5–8** | Geralmente OK | Contenção de CPU/ffmpeg; evitar live view simultâneo | 6+ cores, 16 GB RAM |
| **9+** | Degradável | Não recomendado num único nó | Vários nós ou H.264 nativo na câmera |

## Gargalos desta bridge

1. **ffmpeg por câmera** — stream `_webrtc` transcodifica H.265→H.264 (~5 s cold start, CPU contínua).
2. **WebRTC / TURN** — live view depende de ICE + TURN do hub SmartThings; snapshots não usam WebRTC.
3. **Hub** — re-tenta `ProvideOffer` se a mídia não conectar em ~30 s.
4. **go2rtc** — 2 streams registrados por câmera (RTSP direto + ffmpeg WebRTC).

## Boas práticas para release público

- Documentar **requisitos mínimos de hardware** na README.
- Recomendar **H.264 nativo** no RTSP quando possível (elimina ffmpeg).
- Limitar ou avisar ao adicionar mais de **4 câmeras** na Web UI.
- Usar hub **Aeotec / SmartThings standalone** com firmware Matter 1.5 camera (não hub embutido em TV).
- Manter bridge e câmeras na **mesma sub-rede**; WebRTC usa UDP **8555** no host.

## Referências

- [SmartThings Matter cameras (Samsung)](https://news.samsung.com/global/samsung-smartthings-becomes-the-industrys-first-to-support-matter-cameras)
- [Matter 1.5.1 camera multi-stream (CSA)](https://csa-iot.org/newsroom/matter-1-5-1-enhancing-camera-performance-and-expanding-device-flexibility/)
- [1Home — SmartThings Matter bridge scale](https://tr.docs.netlify.1home.io/docs/en/server/matter-bridge/apps/samsung-smartthings)
