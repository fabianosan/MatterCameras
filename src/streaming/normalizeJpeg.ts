/** Standard JFIF APP0 marker (baseline JPEG) after SOI. */
const JFIF_APP0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
]);

/**
 * Some clients (e.g. SmartThings) reject ffmpeg snapshots that start with COM (FF FE Lavc…).
 * Strip leading comment segments and ensure a JFIF APP0 header is present.
 */
export function normalizeJpeg(jpeg: Uint8Array): Uint8Array {
    if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
        return jpeg;
    }

    let offset = 2;
    let hasJfif = false;

    while (offset + 4 <= jpeg.length) {
        if (jpeg[offset] !== 0xff) break;

        const marker = jpeg[offset + 1];
        if (marker === 0xfe) {
            const segmentLen = (jpeg[offset + 2] << 8) | jpeg[offset + 3];
            offset += 2 + segmentLen;
            continue;
        }
        if (marker === 0xe0) {
            hasJfif = true;
        }
        break;
    }

    if (hasJfif && offset === 2) {
        return jpeg;
    }

    const body = jpeg.slice(offset);
    const out = new Uint8Array(2 + JFIF_APP0.length + body.length);
    out[0] = 0xff;
    out[1] = 0xd8;
    out.set(JFIF_APP0, 2);
    out.set(body, 2 + JFIF_APP0.length);
    return out;
}
