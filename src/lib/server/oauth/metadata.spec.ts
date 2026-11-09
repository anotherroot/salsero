import { describe, expect, it } from 'vitest';
import {
	authorizationServerMetadata,
	mcpResource,
	protectedResourceMetadata,
	wwwAuthenticate
} from './metadata';

const O = 'https://salsa.anotherroot.eu';

describe('discovery documents', () => {
	it('names /mcp as the resource, exactly', () => {
		expect(mcpResource(O)).toBe('https://salsa.anotherroot.eu/mcp');
		expect(protectedResourceMetadata(O)).toMatchObject({
			resource: `${O}/mcp`,
			authorization_servers: [O]
		});
	});
	it('advertises the two values Claude needs before it uses CIMD', () => {
		const m = authorizationServerMetadata(O);
		expect(m.client_id_metadata_document_supported).toBe(true);
		expect(m.token_endpoint_auth_methods_supported).toEqual(['none']);
		expect(m.code_challenge_methods_supported).toEqual(['S256']);
		expect(m.scopes_supported).toEqual(['salsa', 'offline_access']);
	});
	it('also offers registration, for AI apps that do not use CIMD', () => {
		expect(authorizationServerMetadata(O).registration_endpoint).toBe(
			'https://salsa.anotherroot.eu/oauth/register'
		);
	});
	it('points the 401 at the metadata', () => {
		expect(wwwAuthenticate(O)).toBe(
			`Bearer error="invalid_token", resource_metadata="${O}/.well-known/oauth-protected-resource/mcp", scope="salsa"`
		);
	});
});
