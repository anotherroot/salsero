/**
 * A routine as the player's plan: which figure is called on which 8-count.
 *
 * PURE. It produces the same `PlanStep[]` `extendPlan` produces, so
 * nothing downstream — `cuesIn`, `attach.ts`, the count, the clave — has any
 * idea a routine exists.
 *
 * Called again and again as the run's horizon grows, exactly the way
 * `extendPlan` is, and for the same reason: a call already announced must never
 * change. The plan itself is the cursor. One step is pushed per resolved slot,
 * so `plan.length` says which slot comes next and where the hands are, and no
 * state has to survive between ticks.
 */
import { endOf, figureById, startsOf, type Graph } from '$lib/graph/graph';
import { eightsSpan } from '$lib/graph/timing';
import type { CallEvery } from '$lib/labels';
import { LEAD_IN_8S, type PlanStep } from '$lib/scheduler/scheduler';
import { flatten, type OptionsSlot, type RoutineShape } from './routines';

/**
 * Extend `plan` through `throughEight`, looping the routine when the song
 * outlasts it.
 *
 * Spacing is `max(every, eights)`, the same expression `extendPlan` uses.
 * `figures.eights` defaults to 1, so spacing by the figure alone would call a
 * new one every 8-count — under three seconds at 180 BPM, which is not
 * danceable. The user's call rate is the better guess where the data is silent,
 * and a figure that carries a real `eights` still gets its own length whenever
 * that is the longer of the two.
 *
 * `plan` must consist entirely of steps this same routine produced. Mixing in
 * an `extendPlan`-built prefix, or another routine's walk, desyncs the cursor
 * silently — there is no provenance on a `PlanStep` to catch it.
 */
export function routinePlan(
	plan: PlanStep[],
	shape: RoutineShape,
	g: Graph,
	every: CallEvery,
	throughEight: number,
	rand: () => number
): PlanStep[] {
	const flat = flatten(g, shape);
	if (flat.length === 0) return plan;
	const eightsOf = (id: number) => {
		const f = figureById(g, id);
		return f ? eightsSpan(f.length) : 1;
	};
	const out = [...plan];
	let eight =
		out.length === 0
			? LEAD_IN_8S
			: out[out.length - 1].eight + Math.max(every, eightsOf(out[out.length - 1].figureId));
	while (eight <= throughEight) {
		const last = out.length === 0 ? null : out[out.length - 1].figureId;
		const figureId = choose(g, flat[out.length % flat.length], last, rand());
		if (figureId === null) break;
		out.push({ eight, figureId });
		eight += Math.max(every, eightsOf(figureId));
	}
	return out;
}

/**
 * Which of a slot's options to dance, given the figure just called.
 *
 * An option that cannot be entered from where the hands are is skipped — the
 * slot is permissive by design. If NONE fit, the whole list is eligible again:
 * that is the break the routine page already warns about, and calling nothing
 * would stop the run dead over a tag somebody has not got round to.
 *
 * `r` is in `[0, 1)`, and the index is clamped the way `pickFigure` clamps it,
 * so an `r` that reaches 1 cannot run off the end.
 */
function choose(g: Graph, slot: OptionsSlot, last: number | null, r: number): number | null {
	if (slot.figureIds.length === 0) return null;
	const lastFigure = last === null ? null : figureById(g, last);
	const here = lastFigure === null ? null : endOf(g, lastFigure);
	const fits =
		here === null
			? slot.figureIds
			: slot.figureIds.filter((id) => {
					const f = figureById(g, id);
					return f !== null && startsOf(g, f).includes(here);
				});
	const choices = fits.length > 0 ? fits : slot.figureIds;
	return choices[Math.min(choices.length - 1, Math.floor(r * choices.length))];
}
