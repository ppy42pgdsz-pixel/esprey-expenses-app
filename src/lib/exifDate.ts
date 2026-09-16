// Minimal EXIF DateTimeOriginal reader (Carl, 2026-09-16).
//
// WHY WE PARSE IT OURSELVES: `normalizeForUpload()` in Capture.tsx re-encodes
// images through a <canvas>, which throws EXIF away. So the shutter time has
// to be read on the client, from the ORIGINAL File, before that step — the
// server never sees it. A dependency would be overkill for one tag, and this
// runs on the first 256 KB of the file, so it costs nothing on a phone.
//
// Scope: JPEG only. HEIC, PNG and PDF return null and the caller falls back to
// file.lastModified, which on an iPhone camera roll is the capture time anyway.

const HEAD_BYTES = 256 * 1024;

const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_DATE_TIME_DIGITIZED = 0x9004;
const TAG_DATE_TIME = 0x0132; // IFD0 fallback — file modification, less exact

/** Parse an EXIF "YYYY:MM:DD HH:MM:SS" string as LOCAL time.
 *  EXIF carries no timezone: the numbers are the camera's wall clock, which is
 *  what "the day I took the photo" means to the person holding it. */
function parseExifDateTime(s: string): number | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const ms = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  return isFinite(ms) ? ms : null;
}

/** Read DateTimeOriginal out of a JPEG's APP1 segment. Returns ms epoch, or
 *  null if the file isn't a JPEG, has no EXIF, or is malformed. Never throws. */
export async function readExifCaptureMs(file: File): Promise<number | null> {
  try {
    if (!file.type.startsWith("image/jpeg") && !/\.jpe?g$/i.test(file.name || "")) return null;
    const buf = await file.slice(0, HEAD_BYTES).arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not SOI

    // Walk JPEG markers looking for APP1 (0xFFE1) with an "Exif\0\0" header.
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break; // desynced — give up quietly
      const marker = view.getUint8(offset + 1);
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (marker === 0xda) break; // start of scan — no EXIF before the image data
      const size = view.getUint16(offset + 2);
      if (size < 2) break;
      if (marker === 0xe1 && offset + 4 + 6 <= view.byteLength) {
        let isExif = true;
        const sig = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
        for (let i = 0; i < sig.length; i++) {
          if (view.getUint8(offset + 4 + i) !== sig[i]) { isExif = false; break; }
        }
        if (isExif) return readTiff(view, offset + 10);
      }
      offset += 2 + size;
    }
    return null;
  } catch {
    return null; // a date we can't read is never worth failing an upload over
  }
}

/** Read the TIFF block that starts at `tiffStart` and pull the best date tag. */
function readTiff(view: DataView, tiffStart: number): number | null {
  if (tiffStart + 8 > view.byteLength) return null;
  const byteOrder = view.getUint16(tiffStart);
  const little = byteOrder === 0x4949; // 'II'
  if (!little && byteOrder !== 0x4d4d) return null; // not 'MM' either
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return null;

  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
  const ifd0Tags = readIfd(view, tiffStart, ifd0, little);
  if (!ifd0Tags) return null;

  // Preferred: DateTimeOriginal, which lives in the Exif sub-IFD.
  const exifPtr = ifd0Tags.get(TAG_EXIF_IFD_POINTER);
  if (typeof exifPtr === "number") {
    const exifTags = readIfd(view, tiffStart, tiffStart + exifPtr, little);
    if (exifTags) {
      for (const tag of [TAG_DATE_TIME_ORIGINAL, TAG_DATE_TIME_DIGITIZED]) {
        const v = exifTags.get(tag);
        if (typeof v === "string") {
          const ms = parseExifDateTime(v);
          if (ms !== null) return ms;
        }
      }
    }
  }
  // Fallback: IFD0 DateTime (last modified by the camera/software).
  const dt = ifd0Tags.get(TAG_DATE_TIME);
  if (typeof dt === "string") return parseExifDateTime(dt);
  return null;
}

/** Read one IFD into a tag → value map. Only the two types we care about are
 *  decoded: ASCII (2) for the date strings and LONG (4) for the sub-IFD
 *  pointer. Everything else is skipped. */
function readIfd(
  view: DataView,
  tiffStart: number,
  ifdStart: number,
  little: boolean,
): Map<number, string | number> | null {
  if (ifdStart + 2 > view.byteLength) return null;
  const count = view.getUint16(ifdStart, little);
  if (count > 512) return null; // implausible — treat as corrupt rather than loop
  const out = new Map<number, string | number>();
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const num = view.getUint32(entry + 4, little);

    if (type === 4 && num === 1) {
      out.set(tag, view.getUint32(entry + 8, little));
    } else if (type === 2) {
      // ASCII. Values longer than 4 bytes live at an offset; shorter ones are
      // stored inline in the value field.
      const start = num > 4 ? tiffStart + view.getUint32(entry + 8, little) : entry + 8;
      if (start < 0 || start + num > view.byteLength) continue;
      let s = "";
      for (let j = 0; j < num; j++) {
        const c = view.getUint8(start + j);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      out.set(tag, s);
    }
  }
  return out;
}

/**
 * Best available capture time for a picked file, with the source recorded so
 * the UI can say how much to trust it.
 *  - 'exif' : the camera's own shutter timestamp. Authoritative.
 *  - 'file' : lastModified. On an iPhone camera roll this IS the capture time;
 *             on a re-saved or downloaded file it can be anything.
 * Returns null when the file carries no usable timestamp at all.
 */
export async function captureTimeForFile(
  file: File,
): Promise<{ ms: number; source: "exif" | "file" } | null> {
  const exif = await readExifCaptureMs(file);
  if (exif !== null && isPlausible(exif)) return { ms: exif, source: "exif" };
  const lm = file.lastModified;
  if (typeof lm === "number" && isPlausible(lm)) return { ms: lm, source: "file" };
  return null;
}

/** Guard against epoch-0 timestamps and clocks set to the future. One day of
 *  slack covers a phone whose timezone is ahead of the server's. */
function isPlausible(ms: number): boolean {
  if (!isFinite(ms)) return false;
  const min = Date.UTC(2000, 0, 1);
  const max = Date.now() + 24 * 60 * 60 * 1000;
  return ms > min && ms < max;
}
