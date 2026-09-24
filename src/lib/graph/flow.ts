/**
 * The drill's walk over the figure graph.
 *
 * Before this, the player picked uniformly from the pool and the only rule was
 * "not the same as last" — so it would call a figure that starts in hammerlock
 * while the hands were in open position. Nonsense, mid-song. Here the next
 * figure is one that starts where the last one ended, which turns the random
 * drill into guided improvisation.
 *
 * The walk holds NO state. The current position is derivable from the last
 * plan step — the last figure's end IS where the hands are — which is why
 * `extendPlan` stays pure and re-entrant, and it must, because it is called
 * again on every tick to grow a plan whose already-announced calls may never
 * change.
 */
import type { Flow } from '$lib/scheduler/scheduler';
import { endOf, figureById, figuresFrom, type Graph } from './graph';

export function graphFlow(g: Graph): Flow {
	return {
		pick(pool, last, r) {
			const previous = last === null ? null : figureById(g, last);
			// Start of a run, or an unknown last figure: the hands are neutral.
			const at = previous ? endOf(g, previous) : g.neutral;

			// The POOL is filtered by the graph, not the other way round, so the
			// order of the choices is the pool's. That is what makes an untagged
			// repertoire byte-identical to `pickFigure`: one neutral hub allows
			// everything, so `here` comes back as the pool itself, unreordered.
			const startable = (position: number) => {
				const allowed = new Set(figuresFrom(g, position));
				return pool.filter((id) => allowed.has(id));
			};

			const here = startable(at);
			// A dead end resets to neutral rather than falling silent, which is what
			// a dancer does anyway — resolve back to open. It covers the case where
			// the graph has no exit AND the case where the chosen pool has none;
			// both would otherwise end the calls mid-song. `positionCounts` is what
			// keeps the first from being invisible.
			const choices = here.length > 0 ? here : startable(g.neutral);
			if (choices.length === 0) return null;

			// Hearing the same name twice running reads as a bug, so it is avoided —
			// unless it is the only way out, where repeating beats silence.
			const usable =
				last === null || choices.length === 1 ? choices : choices.filter((id) => id !== last);
			// Not dead: `choices.length === 1` only short-circuits a POOL with one
			// candidate. A pool with a duplicate — [4, 4] with `last === 4` — has
			// `choices.length === 2`, so the filter runs anyway and empties the
			// array; without this fallback `from` would be `[]` and the index below
			// would return `undefined` as a figure id instead of repeating.
			const from = usable.length > 0 ? usable : choices;
			return from[Math.min(from.length - 1, Math.floor(r * from.length))];
		},
		eights(figureId) {
			return figureById(g, figureId)?.eights ?? 1;
		}
	};
}
