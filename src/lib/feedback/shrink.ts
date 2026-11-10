/**
 * A picture picked in the Send feedback sheet, redrawn as a JPEG data URL at
 * most `SHOT_LONG_SIDE` px on its long side: a phone's own screenshot is often
 * 2–3 MB as a PNG. Browser only (a canvas); null when it cannot be read.
 */
import { fitWithin } from './shot';

export async function shrinkPicture(file: Blob): Promise<string | null> {
	try {
		const image = await createImageBitmap(file);
		const { width, height } = fitWithin(image.width, image.height);
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.drawImage(image, 0, 0, width, height);
		image.close();
		return canvas.toDataURL('image/jpeg', 0.8);
	} catch {
		return null;
	}
}
