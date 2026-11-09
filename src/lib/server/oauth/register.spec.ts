import { describe, expect, it } from 'vitest';
import { openDb } from '../db';
import { registerClient, resolveClient } from './register';

const NOW = 1_800_000_000_000;
const good = {
	client_name: 'ChatGPT',
	redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
	token_endpoint_auth_method: 'none',
	grant_types: ['authorization_code', 'refresh_token']
};

describe('registerClient', () => {
	it('stores a valid client and answers as RFC 7591 says', () => {
		const db = openDb(':memory:');
		const r = registerClient(db, good, NOW);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.response).toMatchObject({
			client_name: 'ChatGPT',
			redirect_uris: good.redirect_uris,
			token_endpoint_auth_method: 'none',
			response_types: ['code'],
			client_id_issued_at: NOW / 1000
		});
		expect(String(r.response.client_id)).toMatch(/^sa_client_[0-9a-f]{32}$/);
	});
	it('refuses bad redirect URIs by name', () => {
		const db = openDb(':memory:');
		const uris = (n: number) => Array.from({ length: n }, (_, i) => `https://a.example/cb${i}`);
		for (const redirect_uris of [
			[],
			uris(11),
			['http://example.com/cb'],
			['https://example.com/cb#x'],
			['https://example.com/' + 'x'.repeat(2001)],
			[7]
		]) {
			const r = registerClient(db, { ...good, redirect_uris }, NOW);
			expect(r.ok ? 'ok' : r.error, JSON.stringify(redirect_uris).slice(0, 60)).toBe(
				'invalid_redirect_uri'
			);
		}
	});
	it('refuses a confidential client and an unknown grant type', () => {
		const db = openDb(':memory:');
		for (const body of [
			{ ...good, token_endpoint_auth_method: 'client_secret_basic' },
			{ ...good, grant_types: ['client_credentials'] },
			'nope',
			null
		]) {
			const r = registerClient(db, body, NOW);
			expect(r.ok ? 'ok' : r.error).toBe('invalid_client_metadata');
		}
	});
	it('accepts loopback http redirect URIs (local apps)', () => {
		const db = openDb(':memory:');
		expect(
			registerClient(db, { ...good, redirect_uris: ['http://127.0.0.1/callback'] }, NOW).ok
		).toBe(true);
	});
	it('treats a long name as none', () => {
		const db = openDb(':memory:');
		const r = registerClient(db, { ...good, client_name: 'x'.repeat(101) }, NOW);
		expect(r.ok && r.response.client_name).toBe(null);
	});
});

describe('resolveClient', () => {
	it('finds a registered client, with the host of its first redirect URI', async () => {
		const db = openDb(':memory:');
		const r = registerClient(db, good, NOW);
		if (!r.ok) throw new Error('registration refused');
		const c = await resolveClient(db, String(r.response.client_id), false);
		expect(c).toEqual({
			ok: true,
			host: 'chatgpt.com',
			doc: {
				clientId: r.response.client_id,
				clientName: 'ChatGPT',
				redirectUris: good.redirect_uris
			}
		});
	});
	it('refuses an unknown registered id and a client id that is no URL', async () => {
		const db = openDb(':memory:');
		expect((await resolveClient(db, 'sa_client_' + '0'.repeat(32), false)).ok).toBe(false);
		expect((await resolveClient(db, 'whatever', false)).ok).toBe(false);
	});
	it('fetches a document client id and names its host', async () => {
		const db = openDb(':memory:');
		const id = 'https://claude.ai/oauth/meta';
		const c = await resolveClient(db, id, false, () =>
			Promise.resolve({
				ok: true,
				json: { client_id: id, client_name: 'Claude', redirect_uris: ['https://claude.ai/cb'] }
			})
		);
		expect(c.ok && c.host).toBe('claude.ai');
	});
});
