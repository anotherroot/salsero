import { lookup as dnsLookup } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';

/**
 * Fetch a small JSON document from a URL anyone may name (a client id), without
 * letting this server be pointed at its own network: every address a name
 * resolves to must be public, checked inside the connection's own lookup so
 * the address checked is the address connected to (no DNS rebinding window).
 * No redirects, a timeout, a size cap. Loopback only in dev.
 */

export type Resolved = { address: string; family: number };
export type SafeFetchResult = { ok: true; json: unknown } | { ok: false; reason: string };

const V4_BLOCKED: [string, number][] = [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4]
];

function v4ToInt(ip: string): number | null {
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let n = 0;
	for (const p of parts) {
		if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
		n = n * 256 + Number(p);
	}
	return n;
}

function v4Public(ip: string): boolean {
	const n = v4ToInt(ip);
	if (n === null) return false;
	return !V4_BLOCKED.some(([base, bits]) => {
		const b = v4ToInt(base)!;
		const size = 2 ** (32 - bits);
		return n >= b && n < b + size;
	});
}

/** Eight 16-bit groups, or null. Accepts a dotted IPv4 tail. */
function v6Groups(ip: string): number[] | null {
	let s = ip.toLowerCase();
	const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
	if (dotted) {
		const n = v4ToInt(dotted[2]);
		if (n === null) return null;
		s = `${dotted[1]}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
	}
	const halves = s.split('::');
	if (halves.length > 2) return null;
	const part = (h: string) => (h === '' ? [] : h.split(':'));
	const head = part(halves[0]);
	const tail = halves.length === 2 ? part(halves[1]) : [];
	const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
	if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
	const all = [...head, ...Array(fill).fill('0'), ...tail];
	if (all.length !== 8 || !all.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
	return all.map((g) => parseInt(g, 16));
}

function v6Public(ip: string): boolean {
	const g = v6Groups(ip);
	if (!g) return false;
	const v4of = () => `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
	if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return v4Public(v4of());
	if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0))
		return v4Public(v4of());
	if (g.slice(0, 6).every((x) => x === 0)) return false; // ::, ::1, IPv4-compatible
	if ((g[0] & 0xfe00) === 0xfc00) return false; // fc00::/7
	if ((g[0] & 0xffc0) === 0xfe80) return false; // fe80::/10
	if ((g[0] & 0xff00) === 0xff00) return false; // ff00::/8
	if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
	if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return false; // discard
	return true;
}

/** Whether this server may connect to `ip`: a public unicast address. */
export function isPublicAddress(ip: string): boolean {
	const kind = isIP(ip);
	if (kind === 4) return v4Public(ip);
	if (kind === 6) return v6Public(ip);
	return false;
}

function isLoopbackAddress(ip: string): boolean {
	if (isIP(ip) === 4) return ip.startsWith('127.');
	const g = v6Groups(ip);
	return !!g && g.slice(0, 7).every((x) => x === 0) && g[7] === 1;
}

const allowed = (ip: string, allowLoopback: boolean) =>
	isPublicAddress(ip) || (allowLoopback && isLoopbackAddress(ip));

function defaultLookup(host: string): Promise<Resolved[]> {
	return new Promise((ok, no) =>
		dnsLookup(host, { all: true }, (err, addrs) => (err ? no(err) : ok(addrs)))
	);
}

export async function safeFetchJson(
	url: string,
	opts: {
		timeoutMs: number;
		maxBytes: number;
		allowLoopback: boolean;
		lookup?: (host: string) => Promise<Resolved[]>;
	}
): Promise<SafeFetchResult> {
	let u: URL;
	try {
		u = new URL(url);
	} catch {
		return { ok: false, reason: 'not a URL' };
	}
	if (u.protocol !== 'https:' && !(opts.allowLoopback && u.protocol === 'http:'))
		return { ok: false, reason: 'not https' };
	const host = u.hostname.replace(/^\[|\]$/g, '');
	if (isIP(host) && !allowed(host, opts.allowLoopback))
		return { ok: false, reason: 'address not allowed' };
	const resolve = opts.lookup ?? defaultLookup;

	// Node calls this for a name (never for an IP literal, checked above).
	const lookup: LookupFunction = (hostname, options, callback) => {
		resolve(hostname).then(
			(addrs) => {
				if (!addrs.length || !addrs.every((a) => allowed(a.address, opts.allowLoopback))) {
					callback(new Error('address not allowed'), '', 4);
				} else if ((options as { all?: boolean }).all) {
					(callback as unknown as (e: null, a: Resolved[]) => void)(null, addrs);
				} else {
					callback(null, addrs[0].address, addrs[0].family);
				}
			},
			(err: NodeJS.ErrnoException) => callback(err, '', 4)
		);
	};

	return new Promise<SafeFetchResult>((done) => {
		let settled = false;
		const finish = (r: SafeFetchResult) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			req.destroy();
			done(r);
		};
		const send = u.protocol === 'https:' ? httpsRequest : httpRequest;
		const req = send(
			u,
			{ method: 'GET', headers: { accept: 'application/json' }, lookup },
			(res: IncomingMessage) => {
				const status = res.statusCode ?? 0;
				if (status >= 300 && status < 400) return finish({ ok: false, reason: 'redirected' });
				if (status < 200 || status >= 300)
					return finish({ ok: false, reason: `answered ${status}` });
				if (Number(res.headers['content-length'] ?? 0) > opts.maxBytes)
					return finish({ ok: false, reason: 'too large' });
				const chunks: Buffer[] = [];
				let size = 0;
				res.on('data', (c: Buffer) => {
					size += c.length;
					if (size > opts.maxBytes) return finish({ ok: false, reason: 'too large' });
					chunks.push(c);
				});
				res.on('end', () => {
					try {
						finish({ ok: true, json: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
					} catch {
						finish({ ok: false, reason: 'not JSON' });
					}
				});
				res.on('error', () => finish({ ok: false, reason: 'unreachable' }));
			}
		);
		const timer = setTimeout(() => finish({ ok: false, reason: 'timed out' }), opts.timeoutMs);
		req.on('error', (e) =>
			finish({
				ok: false,
				reason: e.message === 'address not allowed' ? 'address not allowed' : 'unreachable'
			})
		);
		req.end();
	});
}
