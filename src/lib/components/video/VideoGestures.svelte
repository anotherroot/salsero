<!-- src/lib/components/video/VideoGestures.svelte -->
<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import {
		clampView,
		fitSize,
		panView,
		pinchView,
		wheelView,
		type Pt,
		type Size,
		type View
	} from '$lib/video/zoom';
	import {
		CHAIN_MS,
		DOUBLE_TAP_MS,
		expire,
		IDLE,
		tap,
		zoneOf,
		type Side,
		type TapResult
	} from '$lib/video/taps';

	/**
	 * The layer over the picture: a tap (play/pause, or wake faded controls),
	 * a double tap on a side (jump 1 s, more taps jump more), two fingers to
	 * zoom, one finger to move a zoomed picture, Ctrl+wheel (a trackpad pinch)
	 * on the PC. The maths is `zoom.ts` and `taps.ts`; this only feeds them.
	 */
	interface Props {
		view: View;
		/** The video's own size, for where `object-fit: contain` puts the picture. */
		natural: Size;
		label: string;
		onsingle: () => void;
		onjump: (side: Side) => void;
		children?: Snippet;
	}

	let { view = $bindable(), natural, label, onsingle, onjump, children }: Props = $props();

	/** Further than this and a touch is a drag, not a tap. */
	const TAP_SLOP_PX = 10;
	const TAP_MAX_MS = 300;

	let el: HTMLButtonElement;
	let box = $state<Size>({ w: 0, h: 0 });
	const pic = $derived(fitSize(box, natural));

	$effect(() => {
		const ro = new ResizeObserver(([e]) => {
			box = { w: e.contentRect.width, h: e.contentRect.height };
		});
		ro.observe(el);
		return () => ro.disconnect();
	});

	// A new box (a rotation, a panel opening) or a new picture: re-clamp.
	$effect(() => {
		if (!box.w || !box.h) return;
		const next = clampView(
			untrack(() => view),
			box,
			pic
		);
		untrack(() => {
			if (next.scale !== view.scale || next.x !== view.x || next.y !== view.y) view = next;
		});
	});

	/** A point relative to the box's centre. */
	function rel(e: { clientX: number; clientY: number }): Pt {
		const r = el.getBoundingClientRect();
		return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
	}

	// Fingers on the picture: bookkeeping for the handlers, never shown, so not reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const pts = new Map<number, Pt>();
	let press: { at: Pt; t: number; last: Pt; moved: boolean } | null = null;
	let pinch: { start: View; from: [Pt, Pt] } | null = null;

	function two(): [Pt, Pt] {
		const [a, b] = [...pts.values()];
		return [a, b];
	}

	/* ---------- taps ---------- */

	let taps = IDLE;
	let waitTimer: ReturnType<typeof setTimeout> | undefined;
	let markTimer: ReturnType<typeof setTimeout> | undefined;
	let mark = $state<{ side: Side; total: number } | null>(null);

	function apply(r: TapResult) {
		taps = r.state;
		if (r.act?.kind === 'single') onsingle();
		else if (r.act?.kind === 'jump') {
			onjump(r.act.side);
			mark = { side: r.act.side, total: r.act.total };
			clearTimeout(markTimer);
			markTimer = setTimeout(() => {
				mark = null;
				taps = expire(taps, performance.now()).state;
			}, CHAIN_MS);
		}
		if (r.wait) {
			clearTimeout(waitTimer);
			waitTimer = setTimeout(() => apply(expire(taps, performance.now())), DOUBLE_TAP_MS + 10);
		}
	}

	$effect(() => () => {
		clearTimeout(waitTimer);
		clearTimeout(markTimer);
	});

	/* ---------- pointers ---------- */

	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		try {
			el.setPointerCapture(e.pointerId);
		} catch {
			// A pointer the browser no longer tracks: moves still arrive while over the picture.
		}
		const p = rel(e);
		pts.set(e.pointerId, p);
		if (pts.size === 1) press = { at: p, t: performance.now(), last: p, moved: false };
		else if (pts.size === 2) {
			// A second finger: a pinch, never a tap.
			press = null;
			pinch = { start: view, from: two() };
		}
	}

	function move(e: PointerEvent) {
		if (!pts.has(e.pointerId)) return;
		const p = rel(e);
		pts.set(e.pointerId, p);
		if (pinch && pts.size >= 2) {
			view = pinchView(pinch.start, pinch.from, two(), box, pic);
			return;
		}
		if (!press || pts.size !== 1) return;
		if (!press.moved && Math.hypot(p.x - press.at.x, p.y - press.at.y) > TAP_SLOP_PX) {
			press.moved = true;
		}
		if (press.moved && view.scale > 1) {
			view = panView(view, p.x - press.last.x, p.y - press.last.y, box, pic);
		}
		press.last = p;
	}

	function up(e: PointerEvent) {
		if (!pts.has(e.pointerId)) return;
		pts.delete(e.pointerId);
		if (pinch) {
			if (pts.size < 2) {
				pinch = null;
				// The finger still down may carry on moving the picture, but is no tap.
				const [rest] = [...pts.values()];
				press = rest ? { at: rest, t: 0, last: rest, moved: true } : null;
			}
			return;
		}
		const p = press;
		press = null;
		if (e.type !== 'pointerup' || !p || p.moved) return;
		const t = performance.now();
		if (t - p.t > TAP_MAX_MS) return;
		apply(tap(taps, t, zoneOf(p.at.x + box.w / 2, box.w)));
	}

	// Ctrl+wheel is how a trackpad pinch arrives; it must be able to stop the page zooming.
	$effect(() => {
		const onwheel = (e: WheelEvent) => {
			if (!e.ctrlKey) return;
			e.preventDefault();
			view = wheelView(view, rel(e), e.deltaY, box, pic);
		};
		el.addEventListener('wheel', onwheel, { passive: false });
		return () => el.removeEventListener('wheel', onwheel);
	});
</script>

<button
	bind:this={el}
	type="button"
	class="absolute inset-0 grid cursor-pointer touch-none place-items-center select-none"
	aria-label={label}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onclick={(e) => {
		// Pointer taps are handled above; this is Enter or Space on the focused button.
		if (e.detail === 0) onsingle();
	}}
>
	{@render children?.()}
	{#if mark}
		<span
			class="pointer-events-none absolute inset-y-[18%] grid w-[34%] place-items-center bg-white/12 text-[15px] font-semibold text-white {mark.side ===
			'left'
				? 'left-0 rounded-r-[50%]'
				: 'right-0 rounded-l-[50%]'}"
		>
			{mark.side === 'left' ? `« ${mark.total} s` : `${mark.total} s »`}
		</span>
	{/if}
</button>
