/**
 * PURE, client-safe: the screenshot sent with feedback. The Android app hands
 * the page a JPEG as a data URL (`SalsaShot`, after a screenshot); a picture
 * picked in the sheet is redrawn as one (`shrink.ts`). Either goes to the
 * server as a JPEG file at most `SHOT_LONG_SIDE` px on its long side.
 */

/** The long side a screenshot is shrunk to: sharp enough to read, about 200 KB. */
export const SHOT_LONG_SIDE = 1280;

const JPEG_URL = 'data:image/jpeg;base64,';

/** Whether a message from the app is a screenshot (a JPEG data URL), not anything else. */
export function isShot(data: unknown): data is string {
	return typeof data === 'string' && data.startsWith(JPEG_URL) && data.length > JPEG_URL.length;
}

/** The size that fits inside `max` on the long side, keeping the shape; never larger than it was. */
export function fitWithin(
	width: number,
	height: number,
	max = SHOT_LONG_SIDE
): { width: number; height: number } {
	const long = Math.max(width, height);
	if (long <= max) return { width, height };
	const k = max / long;
	return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** A JPEG data URL as the file the form sends. */
export function shotFile(dataUrl: string): File {
	const bin = atob(dataUrl.slice(JPEG_URL.length));
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new File([bytes], 'screenshot.jpg', { type: 'image/jpeg' });
}
