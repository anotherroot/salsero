/*
 * A file on the phone answered as the server's media routes answer it
 * (offline phase 4a): whole, or one byte range for `<audio>`'s seeks. PURE,
 * no Node: the service worker runs it. A header it cannot read gets the
 * whole file, as servers do.
 */

const RANGE = /^bytes=(\d*)-(\d*)$/;

/** The file, or the part a `Range: bytes=…` header asks for. */
export function rangeResponse(body: Blob, range: string | null, mime: string): Response {
	const size = body.size;
	const base = { 'Content-Type': mime, 'Accept-Ranges': 'bytes' };
	const whole = () =>
		new Response(body, { status: 200, headers: { ...base, 'Content-Length': String(size) } });

	const m = range ? RANGE.exec(range.trim()) : null;
	if (!m || (m[1] === '' && m[2] === '')) return whole();

	let start: number;
	let end: number;
	if (m[1] === '') {
		// A suffix: the last N bytes.
		const n = Number(m[2]);
		if (n === 0) return whole();
		start = Math.max(0, size - n);
		end = size - 1;
	} else {
		start = Number(m[1]);
		end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
		if (m[2] !== '' && Number(m[2]) < start) return whole();
	}
	if (start >= size) {
		return new Response(null, {
			status: 416,
			headers: { ...base, 'Content-Range': `bytes */${size}` }
		});
	}
	return new Response(body.slice(start, end + 1), {
		status: 206,
		headers: {
			...base,
			'Content-Length': String(end - start + 1),
			'Content-Range': `bytes ${start}-${end}/${size}`
		}
	});
}
