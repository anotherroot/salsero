// PURE: WCAG contrast and opaque colour mixing on #hex strings. Client-safe.

function rgb(c: string): [number, number, number] {
	let h = c.trim().replace(/^#/, '');
	if (h.length === 3) h = [...h].map((ch) => ch + ch).join('');
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function hex(v: number[]): string {
	return (
		'#' +
		v
			.map((x) =>
				Math.max(0, Math.min(255, Math.round(x)))
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
}

/** Opaque blend: `amount` parts of `a` over `1 - amount` parts of `b` (hex, #rrggbb). */
export function mix(a: string, b: string, amount: number): string {
	const ra = rgb(a);
	const rb = rgb(b);
	return hex(ra.map((v, i) => v * amount + rb[i] * (1 - amount)));
}

/** #rrggbb, or #rrggbbaa composited over `over`. */
function parse(c: string, over: string): [number, number, number] {
	const h = c.trim();
	if (h.length === 9) {
		const a = parseInt(h.slice(7, 9), 16) / 255;
		const o = rgb(over);
		const f = rgb(h.slice(0, 7));
		return f.map((v, i) => v * a + o[i] * (1 - a)) as [number, number, number];
	}
	return rgb(h);
}

function luminance([r, g, b]: [number, number, number]): number {
	const ch = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio of `fg` on `bg`; an `#rrggbbaa` fg is composited over `bg`. */
export function contrast(fg: string, bg: string): number {
	const b = parse(bg, '#ffffff');
	const f = parse(fg, hex(b));
	const [l1, l2] = [luminance(f), luminance(b)].sort((x, y) => y - x);
	return (l1 + 0.05) / (l2 + 0.05);
}
