/**
 * The Copy and link card's plan (`/api/clones/copy`, `copyHereView`) and the
 * person's twin answers. A load of the plan it already has is a no-op, so a
 * page refresh that hands the card its props again never flashes the
 * spinner or resets the answers the person picked. Client-only.
 */
import type { CopyHereView, ElsewhereKind } from '$lib/types';

export class CopyHereLoad {
	view = $state<CopyHereView | null>(null);
	failed = $state(false);
	/** Copy to…'s twin answers: the family's gene → the version that goes. */
	use = $state<Record<string, number>>({});

	#key: string | null = null;
	#ask: AbortController | null = null;

	async load(kind: ElsewhereKind, id: number, into: number): Promise<void> {
		const key = `${kind}:${id}:${into}`;
		if (key === this.#key) return;
		this.#key = key;
		this.#ask?.abort();
		const ask = new AbortController();
		this.#ask = ask;
		this.view = null;
		this.failed = false;
		this.use = {};
		try {
			const res = await fetch(`/api/clones/copy?kind=${kind}&id=${id}&into=${into}`, {
				signal: ask.signal
			});
			if (!res.ok) throw new Error(String(res.status));
			const v = (await res.json()) as CopyHereView;
			if (ask.signal.aborted) return;
			this.view = v;
			this.use = Object.fromEntries(v.twins.map((t) => [t.gene, t.from]));
		} catch {
			if (!ask.signal.aborted) this.failed = true;
		}
	}

	/** The card closed: an answer still on its way is dropped. */
	stop() {
		this.#ask?.abort();
	}
}
