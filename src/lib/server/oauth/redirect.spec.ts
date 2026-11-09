import { describe, expect, it } from 'vitest';
import { redirectMatches } from './redirect';

const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
const CODE = ['http://localhost/callback', 'http://127.0.0.1/callback'];

describe('redirectMatches', () => {
	it('matches the hosted callback exactly', () =>
		expect(redirectMatches(CLAUDE, [CLAUDE])).toBe(true));
	it('ignores the port for loopback, per RFC 8252 §7.3', () => {
		expect(redirectMatches('http://localhost:3118/callback', CODE)).toBe(true);
		expect(redirectMatches('http://127.0.0.1:51234/callback', CODE)).toBe(true);
		expect(redirectMatches('http://[::1]:4000/callback', ['http://[::1]/callback'])).toBe(true);
	});
	it('does not ignore the PATH for loopback', () => {
		expect(redirectMatches('http://localhost:3118/other', CODE)).toBe(false);
	});
	it('refuses look-alikes', () => {
		for (const bad of [
			'https://claude.ai.evil.com/api/mcp/auth_callback',
			'https://claude.ai@evil.com/api/mcp/auth_callback',
			'https://evil.com/?https://claude.ai/api/mcp/auth_callback',
			'https://claude.ai/api/mcp/auth_callback/../../evil',
			'http://claude.ai/api/mcp/auth_callback',
			'https://claude.ai/api/mcp/auth_callback#x',
			'https://claude.ai:444/api/mcp/auth_callback'
		])
			expect(redirectMatches(bad, [CLAUDE]), bad).toBe(false);
	});
	it('refuses a loopback that is not registered', () => {
		expect(redirectMatches('http://localhost:3118/callback', [CLAUDE])).toBe(false);
	});
	it('refuses garbage', () => expect(redirectMatches('not a url', [CLAUDE])).toBe(false));
});
