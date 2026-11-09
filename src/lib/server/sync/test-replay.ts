/*
 * Specs only: runs a route's form action or endpoint the way SvelteKit would
 * answer it, without SvelteKit, so replay specs exercise the real action code.
 * The hook does not run here (its gate and slot have their own specs).
 */
import { isActionFailure, isHttpError, isRedirect } from '@sveltejs/kit';
import * as devalue from 'devalue';
import { matchRoute } from '$lib/offline/routes';
import type { Runner } from './replay';

type RouteModule = {
	actions?: Record<string, (event: unknown) => unknown>;
} & Record<string, unknown>;

/** The route id's params, read from a path it matches. */
function paramsOf(id: string, path: string): Record<string, string> {
	const names: string[] = [];
	const pattern = id
		.split('/')
		.filter((s) => s && !/^\(.*\)$/.test(s))
		.map((s) => {
			const m = /^\[(\.\.\.)?(\w+)\]$/.exec(s);
			if (!m) return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			names.push(m[2]);
			return m[1] ? '(.*)' : '([^/]+)';
		})
		.join('/');
	const found = new RegExp(`^/${pattern}/?$`).exec(path);
	if (!found) return {};
	return Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(found[i + 1])]));
}

function cookiesOf(header: string | null) {
	const jar = new Map<string, string>();
	for (const part of (header ?? '').split(';')) {
		const i = part.indexOf('=');
		if (i > 0) jar.set(part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim()));
	}
	return {
		get: (name: string) => jar.get(name),
		getAll: () => [...jar].map(([name, value]) => ({ name, value })),
		set: (name: string, value: string) => void jar.set(name, value),
		delete: (name: string) => void jar.delete(name),
		serialize: () => ''
	};
}

const json = (body: unknown, status: number) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function actionRunner(
	user: App.Locals['user'],
	routes: { id: string; module: unknown }[]
): Runner {
	const ids = routes.map((r) => r.id);
	return async (request) => {
		const url = new URL(request.url);
		const id = matchRoute(url.pathname, ids);
		if (id === null) return new Response('Not found', { status: 404 });
		const mod = routes.find((r) => r.id === id)!.module as RouteModule;
		const event = {
			request,
			url,
			params: paramsOf(id, url.pathname),
			route: { id },
			locals: { user, locale: 'en' },
			cookies: cookiesOf(request.headers.get('cookie')),
			fetch: globalThis.fetch,
			getClientAddress: () => '127.0.0.1',
			setHeaders: () => {},
			isDataRequest: false,
			platform: undefined
		};
		const name = [...url.searchParams.keys()].find((k) => k.startsWith('/'))?.slice(1);
		if (mod.actions) {
			const action = mod.actions[name ?? 'default'];
			if (!action) return json({ type: 'error', error: { message: 'No action' } }, 404);
			try {
				const out = await action(event);
				if (isActionFailure(out)) {
					return json(
						{ type: 'failure', status: out.status, data: devalue.stringify(out.data) },
						out.status
					);
				}
				return json({ type: 'success', status: 200, data: devalue.stringify(out ?? null) }, 200);
			} catch (e) {
				if (isRedirect(e))
					return json({ type: 'redirect', status: e.status, location: e.location }, 200);
				if (isHttpError(e)) return json({ type: 'error', error: e.body }, e.status);
				return json({ type: 'error', error: { message: String(e) } }, 500);
			}
		}
		const handler = mod[request.method] as ((event: unknown) => Promise<Response>) | undefined;
		if (!handler) return new Response('Method not allowed', { status: 405 });
		try {
			return await handler(event);
		} catch (e) {
			if (isRedirect(e))
				return new Response(null, { status: e.status, headers: { location: e.location } });
			if (isHttpError(e)) return json(e.body, e.status);
			throw e;
		}
	};
}
