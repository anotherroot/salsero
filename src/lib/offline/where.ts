/*
 * Where a person's own video is (offline phase 4c): only on this phone, on its
 * way up, on this phone and the server, on another device, or gone from this
 * phone. PURE: the page passes what it knows (the originals held, its slot,
 * the uploads in flight, the person's devices).
 */
import type { DeviceLabel } from '$lib/devices/label';

export type Place =
	/** On the server and no original here: 4b's kept copy rules (KeepButton). */
	| { state: 'server' }
	| { state: 'only'; iphone: boolean }
	| { state: 'uploading'; pct: number }
	| { state: 'both'; copyBytes: number }
	| { state: 'elsewhere'; label: DeviceLabel | null }
	/** This device was the holder, but the original is gone (the gallery on Android). */
	| { state: 'missing'; gallery: boolean };

export type PlaceCtx = {
	/** This phone holds the file's original. */
	held: (file: string) => boolean;
	/** This device's id slot; null until it has one. */
	slot: number | null;
	/** How far the file's upload is, or null when none runs. */
	uploading: (file: string) => number | null;
	devices: Record<string, DeviceLabel>;
	iphone: boolean;
	android: boolean;
};

export type PlaceRow = {
	file: string;
	serverCopy: boolean;
	originSlot: number | null;
	sizeBytes: number;
	originBytes: number | null;
};

export function placeOf(row: PlaceRow, ctx: PlaceCtx): Place {
	if (ctx.held(row.file)) {
		const pct = ctx.uploading(row.file);
		if (pct !== null) return { state: 'uploading', pct };
		if (row.serverCopy) return { state: 'both', copyBytes: row.sizeBytes };
		return { state: 'only', iphone: ctx.iphone };
	}
	if (!row.serverCopy) {
		if (row.originSlot !== null && row.originSlot === ctx.slot)
			return { state: 'missing', gallery: ctx.android };
		return {
			state: 'elsewhere',
			label: row.originSlot === null ? null : (ctx.devices[String(row.originSlot)] ?? null)
		};
	}
	return { state: 'server' };
}
