import { serverNow } from '../server-clock';
import { parseClientDocument, type ClientDocument } from './client';
import { safeFetchJson, type SafeFetchResult } from './safe-fetch';

const TIMEOUT_MS = 3000;
const MAX_BYTES = 64 * 1024;
const CACHE_MS = 3_600_000;

export type Fetcher = (url: string) => Promise<SafeFetchResult>;

/**
 * Client documents are PUBLIC and the same for every user, so a module-level
 * cache is safe here: it holds nothing about anyone.
 */
const cache = new Map<string, { doc: ClientDocument; at: number }>();

/** Fetch (through the SSRF guard) and check a Client ID Metadata Document; cached an hour. */
export async function fetchClientDocument(
	clientId: string,
	allowLoopback: boolean,
	fetcher?: Fetcher
): Promise<{ ok: true; doc: ClientDocument } | { ok: false; reason: string }> {
	const now = serverNow();
	const hit = cache.get(clientId);
	if (!fetcher && hit && now - hit.at < CACHE_MS) return { ok: true, doc: hit.doc };
	const got = await (
		fetcher ??
		((url: string) =>
			safeFetchJson(url, { timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES, allowLoopback }))
	)(clientId);
	if (!got.ok) return { ok: false, reason: `client document: ${got.reason}` };
	const parsed = parseClientDocument(clientId, got.json);
	if (parsed.ok && !fetcher) cache.set(clientId, { doc: parsed.doc, at: now });
	return parsed;
}
