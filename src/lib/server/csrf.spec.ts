import { describe, expect, it } from 'vitest';
import { SELF_AUTHED_PATHS, isCrossSiteForm, isSelfAuthed, routedPath } from './csrf';

const APP = 'https://salsa.anotherroot.eu';
const req = (method: string, contentType: string | null, origin: string | null) => ({
	method,
	contentType,
	origin
});

describe('isCrossSiteForm: what SvelteKit refused before its own check was turned off', () => {
	it('refuses a form POST from another origin', () => {
		expect(
			isCrossSiteForm(
				req('POST', 'application/x-www-form-urlencoded', 'https://evil.com'),
				APP,
				'/'
			)
		).toBe(true);
	});

	it('refuses a form POST with NO origin', () => {
		expect(isCrossSiteForm(req('POST', 'multipart/form-data; boundary=x', null), APP, '/')).toBe(
			true
		);
	});

	it('refuses every form content type kit protects, and every mutating method', () => {
		for (const ct of [
			'application/x-www-form-urlencoded',
			'multipart/form-data',
			'text/plain',
			'application/x-sveltekit-formdata'
		])
			for (const m of ['POST', 'PUT', 'PATCH', 'DELETE'])
				expect(isCrossSiteForm(req(m, ct, 'https://evil.com'), APP, '/x'), `${m} ${ct}`).toBe(true);
	});

	it('allows the same origin', () => {
		expect(isCrossSiteForm(req('POST', 'application/x-www-form-urlencoded', APP), APP, '/')).toBe(
			false
		);
	});

	it('allows JSON and GET: they were never form submissions', () => {
		expect(isCrossSiteForm(req('POST', 'application/json', null), APP, '/mcp')).toBe(false);
		expect(isCrossSiteForm(req('GET', 'application/x-www-form-urlencoded', null), APP, '/')).toBe(
			false
		);
	});

	it('exempts ONLY the token endpoint, where Claude posts server-to-server with no Origin', () => {
		const form = 'application/x-www-form-urlencoded';
		expect(isCrossSiteForm(req('POST', form, null), APP, '/oauth/token')).toBe(false);
		expect(isCrossSiteForm(req('POST', form, null), APP, '/oauth/token/')).toBe(true);
		expect(isCrossSiteForm(req('POST', form, null), APP, '/oauth/authorize')).toBe(true);
	});

	it('is case-insensitive about the content type', () => {
		expect(isCrossSiteForm(req('POST', 'Application/X-WWW-Form-Urlencoded', null), APP, '/')).toBe(
			true
		);
	});
});

describe('routedPath: mirrors kit`s own decode_pathname', () => {
	it('decodes a percent-escaped letter, so an encoded path cannot dodge a check', () => {
		expect(routedPath('/m%63p')).toBe('/mcp');
	});

	it('keeps a literal %25, same as kit', () => {
		expect(routedPath('/a%2525b')).toBe('/a%2525b');
	});

	it('returns the raw input when decodeURI throws on malformed escapes', () => {
		expect(routedPath('/%E0%A4%A')).toBe('/%E0%A4%A');
	});

	it('is what isCrossSiteForm is called with, so an encoded /oauth/token is exempt only because it decodes to exactly that', () => {
		expect(
			isCrossSiteForm(
				req('POST', 'application/x-www-form-urlencoded', null),
				APP,
				routedPath('/oauth/%74oken')
			)
		).toBe(false);
	});
});

describe('SELF_AUTHED_PATHS', () => {
	it('names the endpoints that answer for themselves, and not the consent page', () => {
		expect([...SELF_AUTHED_PATHS].sort()).toEqual(
			[
				'/.well-known/oauth-authorization-server',
				'/.well-known/oauth-protected-resource',
				'/.well-known/oauth-protected-resource/mcp',
				'/mcp',
				'/oauth/register',
				'/oauth/token'
			].sort()
		);
	});
	it('is judged on the routed path, so an encoded /mcp is still /mcp', () => {
		expect(isSelfAuthed(routedPath('/m%63p'))).toBe(true);
		expect(isSelfAuthed('/oauth/authorize')).toBe(false);
		expect(isSelfAuthed('/mcp/')).toBe(false);
	});
});
