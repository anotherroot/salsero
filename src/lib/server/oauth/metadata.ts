/** The one scope. Separate read and write grants would protect one person from themselves. */
export const SCOPE = 'salsa';

export const mcpResource = (origin: string) => `${origin}/mcp`;

/** RFC 9728. Served at both well-known paths; Claude tries the path-suffixed one first. */
export function protectedResourceMetadata(origin: string) {
	return {
		resource: mcpResource(origin),
		authorization_servers: [origin],
		scopes_supported: [SCOPE],
		bearer_methods_supported: ['header']
	};
}

/**
 * RFC 8414. Clients identify by a Client ID Metadata Document (Claude picks
 * CIMD only when BOTH `client_id_metadata_document_supported` and `none` in
 * `token_endpoint_auth_methods_supported` are present), or register themselves
 * (RFC 7591) at `registration_endpoint`, as other AI apps do.
 */
export function authorizationServerMetadata(origin: string) {
	return {
		issuer: origin,
		authorization_endpoint: `${origin}/oauth/authorize`,
		token_endpoint: `${origin}/oauth/token`,
		registration_endpoint: `${origin}/oauth/register`,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		code_challenge_methods_supported: ['S256'],
		token_endpoint_auth_methods_supported: ['none'],
		client_id_metadata_document_supported: true,
		scopes_supported: [SCOPE, 'offline_access'],
		authorization_response_iss_parameter_supported: true
	};
}

export function wwwAuthenticate(origin: string): string {
	return `Bearer error="invalid_token", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="${SCOPE}"`;
}
