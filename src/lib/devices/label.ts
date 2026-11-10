/**
 * What a device is, read from its user agent (offline phase 4c): another device
 * says a phone-only video is "On Pixel 8", "On an iPhone" or "On a computer".
 * Stored with the device's id slot (`device_slots.label`) and sent to the
 * person's other devices with the pull (`ServerExtras.devices`).
 */
export type DeviceKind = 'android' | 'iphone' | 'ipad' | 'computer';
export type DeviceLabel = { kind: DeviceKind; model: string | null };

const KINDS: readonly DeviceKind[] = ['android', 'iphone', 'ipad', 'computer'];

export function deviceLabelOf(ua: string): DeviceLabel {
	if (/iPhone/.test(ua)) return { kind: 'iphone', model: null };
	if (/iPad/.test(ua)) return { kind: 'ipad', model: null };
	const android = /Android [\d.]+; ([^;)]+?)(?: Build\/[^;)]*)?[;)]/.exec(ua);
	if (android || /Android/.test(ua)) {
		const model = android?.[1].trim() ?? '';
		// Chrome's reduced agent says "K" for every model.
		return { kind: 'android', model: model && model !== 'K' ? model : null };
	}
	return { kind: 'computer', model: null };
}

/** A stored label read back; null for none or anything not a label. */
export function parseDeviceLabel(text: string | null | undefined): DeviceLabel | null {
	if (!text) return null;
	try {
		const v: unknown = JSON.parse(text);
		if (!v || typeof v !== 'object') return null;
		const { kind, model } = v as Record<string, unknown>;
		if (!KINDS.includes(kind as DeviceKind)) return null;
		return { kind: kind as DeviceKind, model: typeof model === 'string' ? model : null };
	} catch {
		return null;
	}
}
