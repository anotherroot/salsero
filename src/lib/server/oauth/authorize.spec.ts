import { describe, expect, it } from 'vitest';
import { backToClient, parseAuthorizeParams } from './authorize';

const RES = 'https://salsa.anotherroot.eu/mcp';
const CH = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const base = {
	response_type: 'code',
	client_id: 'https://claude.ai/meta',
	redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
	code_challenge: CH,
	code_challenge_method: 'S256',
	state: 's1'
};
const p = (o: Record<string, string>) => new URLSearchParams(o);
const without = (k: string) => Object.fromEntries(Object.entries(base).filter(([x]) => x !== k));

describe('parseAuthorizeParams', () => {
	it('accepts a well-formed request', () => {
		expect(parseAuthorizeParams(p(base), RES)).toEqual({
			kind: 'ok',
			req: {
				clientId: base.client_id,
				redirectUri: base.redirect_uri,
				state: 's1',
				codeChallenge: CH
			}
		});
	});
	it('never redirects without a client or a redirect URI to send it to', () => {
		expect(parseAuthorizeParams(p(without('client_id')), RES).kind).toBe('fatal');
		expect(parseAuthorizeParams(p(without('redirect_uri')), RES).kind).toBe('fatal');
	});
	it('redirects the protocol errors back to the client', () => {
		expect(parseAuthorizeParams(p({ ...base, response_type: 'token' }), RES)).toMatchObject({
			kind: 'redirect',
			error: 'unsupported_response_type'
		});
		expect(parseAuthorizeParams(p({ ...base, code_challenge_method: 'plain' }), RES)).toMatchObject(
			{ kind: 'redirect', error: 'invalid_request' }
		);
		expect(parseAuthorizeParams(p(without('code_challenge')), RES)).toMatchObject({
			kind: 'redirect',
			error: 'invalid_request'
		});
	});
	it('refuses a resource that is not this MCP endpoint', () => {
		expect(
			parseAuthorizeParams(p({ ...base, resource: 'https://other.example/mcp' }), RES)
		).toMatchObject({ kind: 'redirect', error: 'invalid_target' });
		expect(parseAuthorizeParams(p({ ...base, resource: RES }), RES).kind).toBe('ok');
	});
});

describe('backToClient', () => {
	it('keeps the client URI and adds the parameters and the issuer', () => {
		const u = new URL(
			backToClient(
				'https://claude.ai/cb?x=1',
				{ code: 'c', state: 's' },
				'https://salsa.anotherroot.eu'
			)
		);
		expect(u.origin + u.pathname).toBe('https://claude.ai/cb');
		expect(Object.fromEntries(u.searchParams)).toEqual({
			x: '1',
			code: 'c',
			state: 's',
			iss: 'https://salsa.anotherroot.eu'
		});
	});
	it('leaves out a missing state', () => {
		expect(
			new URL(
				backToClient('https://a.eu/cb', { error: 'access_denied', state: null }, 'https://i')
			).searchParams.has('state')
		).toBe(false);
	});
});
