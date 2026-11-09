import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isPublicAddress, safeFetchJson } from './safe-fetch';

describe('isPublicAddress', () => {
	it('refuses every private, local and reserved IPv4 range, at both edges', () => {
		const table: [string, boolean][] = [
			['0.0.0.0', false],
			['1.1.1.1', true],
			['9.255.255.255', true],
			['10.0.0.1', false],
			['11.0.0.0', true],
			['100.63.255.255', true],
			['100.64.0.1', false],
			['100.127.255.255', false],
			['100.128.0.0', true],
			['127.0.0.1', false],
			['169.254.169.254', false],
			['172.15.255.255', true],
			['172.16.0.1', false],
			['172.31.255.255', false],
			['172.32.0.0', true],
			['192.0.0.8', false],
			['192.0.2.1', false],
			['192.168.1.1', false],
			['198.18.0.1', false],
			['198.19.255.255', false],
			['198.20.0.0', true],
			['198.51.100.7', false],
			['203.0.113.9', false],
			['224.0.0.1', false],
			['255.255.255.255', false],
			['8.8.8.8', true]
		];
		for (const [ip, pub] of table) expect(isPublicAddress(ip), ip).toBe(pub);
	});
	it('refuses private and local IPv6, and private IPv4 wrapped in IPv6', () => {
		const table: [string, boolean][] = [
			['::', false],
			['::1', false],
			['fc00::1', false],
			['fd12:3456::1', false],
			['fe80::1', false],
			['ff02::1', false],
			['2001:db8::1', false],
			['::ffff:10.0.0.1', false],
			['::ffff:a00:1', false],
			['::ffff:8.8.8.8', true],
			['64:ff9b::a00:1', false],
			['64:ff9b::808:808', true],
			['2606:4700::1', true],
			['2a00:1450:4001::200e', true]
		];
		for (const [ip, pub] of table) expect(isPublicAddress(ip), ip).toBe(pub);
	});
	it('is not fooled by garbage', () => {
		expect(isPublicAddress('not an ip')).toBe(false);
		expect(isPublicAddress('')).toBe(false);
	});
});

describe('safeFetchJson', () => {
	const opts = { timeoutMs: 3000, maxBytes: 65536 };

	it('refuses a name that resolves to a private address, before connecting', async () => {
		const asked: string[] = [];
		const r = await safeFetchJson('https://inside.example/doc.json', {
			...opts,
			allowLoopback: false,
			lookup: (host) => {
				asked.push(host);
				return Promise.resolve([{ address: '10.1.2.3', family: 4 }]);
			}
		});
		expect(asked).toEqual(['inside.example']);
		expect(r.ok).toBe(false);
	});
	it('refuses when any one of the addresses is private', async () => {
		const r = await safeFetchJson('https://mixed.example/doc.json', {
			...opts,
			allowLoopback: false,
			lookup: () =>
				Promise.resolve([
					{ address: '8.8.8.8', family: 4 },
					{ address: '127.0.0.1', family: 4 }
				])
		});
		expect(r.ok).toBe(false);
	});
	it('refuses an IP literal that is private, with no lookup at all', async () => {
		for (const url of [
			'https://127.0.0.1/x',
			'https://[::1]/x',
			'https://169.254.169.254/latest',
			'https://10.0.0.5/x'
		]) {
			const r = await safeFetchJson(url, {
				...opts,
				allowLoopback: false,
				lookup: () => Promise.reject(new Error('no lookup expected'))
			});
			expect(r.ok, url).toBe(false);
		}
	});

	describe('against a local server (loopback allowed, as in dev)', () => {
		let server: Server;
		let base = '';
		beforeAll(async () => {
			server = createServer((req, res) => {
				if (req.url === '/doc') {
					res.setHeader('content-type', 'application/json');
					res.end(JSON.stringify({ hello: 'world' }));
				} else if (req.url === '/moved') {
					res.writeHead(302, { location: '/doc' });
					res.end();
				} else if (req.url === '/big') {
					res.end('"' + 'x'.repeat(70_000) + '"');
				} else {
					res.writeHead(404);
					res.end();
				}
			});
			await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
			base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		});
		afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

		it('reads JSON', async () => {
			expect(await safeFetchJson(`${base}/doc`, { ...opts, allowLoopback: true })).toEqual({
				ok: true,
				json: { hello: 'world' }
			});
		});
		it('never follows a redirect', async () => {
			expect((await safeFetchJson(`${base}/moved`, { ...opts, allowLoopback: true })).ok).toBe(
				false
			);
		});
		it('stops at the size cap', async () => {
			expect((await safeFetchJson(`${base}/big`, { ...opts, allowLoopback: true })).ok).toBe(false);
		});
		it('refuses loopback when loopback is not allowed', async () => {
			expect((await safeFetchJson(`${base}/doc`, { ...opts, allowLoopback: false })).ok).toBe(
				false
			);
		});
	});
});
