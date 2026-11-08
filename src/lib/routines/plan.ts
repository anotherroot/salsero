/**
 * A routine as the player's plan: which figure starts on which 8-count.
 *
 * PURE. Called again and again as the run's horizon grows: a step already
 * decided must never change, so the plan itself is the cursor. Each step says
 * which slot it answers, so the next one follows the last step's slot, and a
 * jump (`from`) can restart the walk at any slot without any other state.
 */
import { figureById, fitsAfter, type Graph } from '$lib/graph/graph';
import { eightsSpan } from '$lib/graph/timing';
import { LEAD_IN_8S, type PlanStep } from '$lib/scheduler/scheduler';
import { flatten, type OptionsSlot, type RoutineShape } from './routines';

/** Where a jump restarts the walk: this slot, on this 8-count. */
export interface PlanFrom {
	eight: number;
	slot: number;
}

/**
 * Extend `plan` through `throughEight`, looping the routine when the song
 * outlasts it. Each figure takes its own length (`eightsSpan`, at least one
 * 8-count), so the next one starts where it ends.
 *
 * With `from`, every step from `from.eight` on is dropped and the walk starts
 * again there at `from.slot`: tapping a figure in the run. The steps before it
 * stay, so the hands carry over into the choice of the slot's option.
 *
 * `plan` must consist entirely of steps this same routine produced.
 */
export function routinePlan(
	plan: PlanStep[],
	shape: RoutineShape,
	g: Graph,
	throughEight: number,
	rand: () => number,
	from?: PlanFrom
): PlanStep[] {
	const flat = flatten(g, shape);
	if (flat.length === 0) return plan;
	const eightsOf = (id: number) => {
		const f = figureById(g, id);
		return f ? eightsSpan(f.length) : 1;
	};
	const out = from ? plan.filter((s) => s.eight < from.eight) : [...plan];
	const prev = out.length === 0 ? null : out[out.length - 1];
	let eight = from ? from.eight : prev ? prev.eight + eightsOf(prev.figureId) : LEAD_IN_8S;
	let slot = from
		? ((from.slot % flat.length) + flat.length) % flat.length
		: prev
			? (prev.slot + 1) % flat.length
			: 0;
	while (eight <= throughEight) {
		const last = out.length === 0 ? null : out[out.length - 1].figureId;
		const figureId = choose(g, flat[slot], last, rand());
		if (figureId === null) break;
		out.push({ eight, figureId, slot });
		eight += eightsOf(figureId);
		slot = (slot + 1) % flat.length;
	}
	return out;
}

/**
 * Which of a slot's options to dance, given the figure just called.
 *
 * An option that cannot be entered from where the hands are is skipped — the
 * slot is permissive by design. "Can be entered" is `fitsAfter`: its starts
 * meet the last figure's ends, so an option with no starts, or a last figure
 * with no ends, always fits. If NONE fit, the whole list is eligible again:
 * that is the break the routine page already warns about, and calling nothing
 * would stop the run dead over a tag somebody has not got round to.
 *
 * `r` is in `[0, 1)`, and the index is clamped the way `pickFigure` clamps it,
 * so an `r` that reaches 1 cannot run off the end.
 */
function choose(g: Graph, slot: OptionsSlot, last: number | null, r: number): number | null {
	if (slot.figureIds.length === 0) return null;
	const lastFigure = last === null ? null : figureById(g, last);
	const fits =
		lastFigure === null
			? slot.figureIds
			: slot.figureIds.filter((id) => {
					const f = figureById(g, id);
					return f !== null && fitsAfter(lastFigure, f);
				});
	const choices = fits.length > 0 ? fits : slot.figureIds;
	return choices[Math.min(choices.length - 1, Math.floor(r * choices.length))];
}
