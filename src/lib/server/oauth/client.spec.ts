import { describe, expect, it } from 'vitest';
import { clientIdIsUrl, parseClientDocument } from './client';

describe('clientIdIsUrl', () => {
	it('accepts an https document URL from any origin', () => {
		expect(clientIdIsUrl('https://claude.ai/oauth/claude-code-client-metadata', false)).toBe(true);
		expect(clientIdIsUrl('https://chatgpt.com/client.json', false)).toBe(true);
	});
	it('refuses plain http, userinfo, a fragment, no path, and garbage', () => {
		for (const bad of [
			'http://example.com/x',
			'https://u:p@example.com/x',
			'https://example.com/x#a',
			'https://example.com',
			'https://example.com/',
			'example.com/x',
			''
		])
			expect(clientIdIsUrl(bad, false), bad).toBe(false);
	});
	it('accepts loopback http only in dev', () => {
		expect(clientIdIsUrl('http://127.0.0.1:5173/c', true)).toBe(true);
		expect(clientIdIsUrl('http://127.0.0.1:5173/c', false)).toBe(false);
		expect(clientIdIsUrl('http://example.com/c', true)).toBe(false);
	});
});

describe('parseClientDocument', () => {
	const id = 'https://claude.ai/meta';
	const good = {
		client_id: id,
		client_name: 'Claude',
		redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
		token_endpoint_auth_method: 'none'
	};
	it('reads a well-formed document', () => {
		expect(parseClientDocument(id, good)).toEqual({
			ok: true,
			doc: { clientId: id, clientName: 'Claude', redirectUris: good.redirect_uris }
		});
	});
	it('requires the document to name ITSELF', () => {
		expect(parseClientDocument(id, { ...good, client_id: 'https://claude.ai/other' }).ok).toBe(
			false
		);
	});
	it('requires at least one redirect URI, all strings', () => {
		expect(parseClientDocument(id, { ...good, redirect_uris: [] }).ok).toBe(false);
		expect(parseClientDocument(id, { ...good, redirect_uris: [1] }).ok).toBe(false);
	});
	it('refuses a confidential client: this server has no secrets to check', () => {
		expect(
			parseClientDocument(id, { ...good, token_endpoint_auth_method: 'client_secret_basic' }).ok
		).toBe(false);
	});
	it('treats a missing or silly name as no name', () => {
		const r = parseClientDocument(id, { ...good, client_name: 'x'.repeat(500) });
		expect(r.ok && r.doc.clientName).toBe(null);
	});
	it('refuses non-objects', () => expect(parseClientDocument(id, 'nope').ok).toBe(false));
});
