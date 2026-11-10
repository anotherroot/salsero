import { untrack } from 'svelte';
import { flipPlan, type Box } from './flip';
import { ghost } from './ghost';
import { LEAVE, MS, SETTLE, play, reducedMotion } from './motion';

/**
 * A keyed list that folds and opens (spec 2026-11-10-motion-round-1, "Lists
 * fold and open"). Call it in a component's script; the list's rows are the
 * container's children with `data-flip="<key>"`.
 *
 * Before the DOM changes (`$effect.pre`) it measures the rows where they are
 * drawn now, and copies each row that is leaving into a ghost. After it
 * (`$effect`) every row that moved starts from where it was and slides into
 * place, new rows fade in, ghosts slide off, and the list's height follows.
 * Nothing waits for it: the list has already changed.
 *
 * A list that changed while hidden (the phone's Today under an open exercise)
 * keeps the boxes it last showed; when it shows again it plays the change
 * from those only if `replayOnShow` says so (the Done landing), slower, with
 * the `lift` row lifted.
 */
export function flipList(o: {
	container: () => HTMLElement | undefined;
	/** The rows' keys in order: what the effect follows. */
	keys: () => readonly (string | number)[];
	/** False while the list is hidden. */
	shown?: () => boolean;
	/** Shown again: play what changed while hidden. */
	replayOnShow?: () => boolean;
	/** The row lifted on a replay (the one just done). */
	lift?: () => string | null;
}): void {
	/** What the list last showed: the replay's starting point. */
	let snapshot: Map<string, Box> | null = null;
	let snapshotHeight = 0;
	/** Measured just before this change, while shown. */
	let before: Map<string, Box> | null = null;
	let beforeHeight = 0;

	$effect.pre(() => {
		const keys = o.keys().map(String);
		o.shown?.();
		untrack(() => {
			before = null;
			const list = o.container();
			if (!list || !laidOut(list) || reducedMotion()) return;
			// Where things are drawn now, mid-animation included, so a fast second
			// change starts from there; then the old animations go.
			const rows = rowsOf(list);
			before = measure(list, rows);
			beforeHeight = list.getBoundingClientRect().height;
			for (const row of rows) {
				const key = row.dataset.flip ?? '';
				if (!keys.includes(key)) leave(row, list);
			}
			for (const a of [list, ...rows].flatMap((el) => el.getAnimations())) a.cancel();
		});
	});

	$effect(() => {
		o.keys();
		o.shown?.();
		untrack(() => {
			const list = o.container();
			if (!list || !laidOut(list)) return;
			const rows = rowsOf(list);
			const after = measure(list, rows);
			const height = list.getBoundingClientRect().height;
			if (before) animate(list, rows, before, after, beforeHeight, height, MS.medium, null);
			else if (snapshot && o.replayOnShow?.())
				animate(list, rows, snapshot, after, snapshotHeight, height, MS.long, o.lift?.() ?? null);
			before = null;
			snapshot = after;
			snapshotHeight = height;
		});
	});
}

const laidOut = (el: HTMLElement) => el.getClientRects().length > 0;

const rowsOf = (list: HTMLElement) => [
	...list.querySelectorAll<HTMLElement>(':scope > [data-flip]')
];

function measure(list: HTMLElement, rows: HTMLElement[]): Map<string, Box> {
	const top = list.getBoundingClientRect().top;
	return new Map(
		rows.map((row) => {
			const r = row.getBoundingClientRect();
			return [row.dataset.flip ?? '', { top: r.top - top, height: r.height }];
		})
	);
}

/** A row that left: its ghost slides off to the left from where it is, and fades. */
function leave(row: HTMLElement, list: HTMLElement): void {
	const copy = ghost(row, list);
	play(copy, [{ transform: 'none' }, { transform: 'translateX(-100%)' }], {
		duration: MS.short,
		easing: LEAVE,
		fill: 'forwards'
	});
	play(copy, [{ opacity: 1 }, { opacity: 0 }], {
		duration: MS.short,
		delay: 60,
		fill: 'forwards'
	});
}

function animate(
	list: HTMLElement,
	rows: HTMLElement[],
	from: Map<string, Box>,
	to: Map<string, Box>,
	fromHeight: number,
	toHeight: number,
	ms: number,
	lift: string | null
): void {
	const plan = flipPlan(from, to);
	const byKey = new Map(rows.map((row) => [row.dataset.flip ?? '', row]));
	for (const { key, dy } of plan.moves) {
		const row = byKey.get(key);
		if (!row) continue;
		play(row, [{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: ms });
		if (key === lift) {
			row.style.position ||= 'relative';
			row.style.zIndex = '1';
			const a = play(
				row,
				[
					{ boxShadow: '0 8px 24px #0000' },
					{ boxShadow: '0 8px 24px #0002', offset: 0.5 },
					{ boxShadow: '0 8px 24px #0000' }
				],
				{ duration: ms }
			);
			void a?.finished.finally(() => row.style.removeProperty('z-index')).catch(() => {});
		}
	}
	for (const key of plan.entering) {
		const row = byKey.get(key);
		if (!row) continue;
		play(
			row,
			[
				{ opacity: 0, transform: 'scale(.96)' },
				{ opacity: 0, offset: 0.45 },
				{ opacity: 1, transform: 'none' }
			],
			{ duration: MS.medium + MS.short, easing: SETTLE }
		);
	}
	if (Math.abs(fromHeight - toHeight) >= 0.5)
		play(list, [{ height: `${fromHeight}px` }, { height: `${toHeight}px` }], { duration: ms });
}
