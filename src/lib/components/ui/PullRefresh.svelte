<script lang="ts">
	/*
	 * Pull down to refresh (device first, look C): at the top of a page, a finger
	 * pulling down slides the sheet (and a hero on it) down off the band, and the
	 * band's colour fills the gap with words only. Let go past the trigger: push
	 * what waits and pull (`syncNow`), re-read the page, "Up to date", spring back.
	 * Offline it says so and springs back. Phone only: the desktop listens to
	 * nothing. The numbers and decisions are `$lib/motion/pull-refresh`.
	 */
	import { invalidateAll } from '$app/navigation';
	import { t } from '$lib/i18n/catalog';
	import { desk } from '$lib/nav/desk.svelte';
	import { syncNow } from '$lib/offline/device.svelte';
	import { sheetStack } from '$lib/sheets/history.svelte';
	import { reducedMotion } from '$lib/motion/motion';
	import {
		DECIDE_PX,
		DONE_MS,
		OFFLINE_MS,
		PULL_HOLD,
		SPRING_MS,
		doneWord,
		mayStart,
		phaseWhilePulling,
		pullDistance,
		watchesMove,
		type PullPhase
	} from '$lib/motion/pull-refresh';

	let { sheet }: { sheet: HTMLElement | undefined } = $props();

	let d = $state(0);
	let phase = $state<PullPhase>('idle');
	/** Where the gap starts (the hero's top, else the sheet's), in the viewport: the page is at its top. */
	let origin = $state(0);
	/** How far below `origin` the sheet's own top is (a hero rises above it): the band fills that too. */
	let below = $state(0);

	/** Somewhere a downward drag already means something, or a layer over the page. */
	const EXCLUDED = 'dialog, [role="dialog"], [data-no-pull], video, input[type="range"]';
	/** The sheet's rounded top (`rounded-t-[28px]` in `Screen`): the band shows in its corners. */
	const SHEET_RADIUS = 28;

	const word = $derived(
		phase === 'syncing'
			? t().sync.pull.syncing
			: phase === 'done'
				? t().sync.pull.done
				: phase === 'offline'
					? t().sync.pull.offline
					: phase === 'ready'
						? t().sync.pull.release
						: t().sync.pull.pull
	);

	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

	/** Moves the sheet to `to`, springing when `spring` (none for reduced motion). */
	function place(to: number, spring: boolean): Promise<void> {
		d = to;
		if (!sheet) return Promise.resolve();
		const el = sheet;
		const animate = spring && !reducedMotion();
		el.style.transition = animate ? `transform ${SPRING_MS}ms cubic-bezier(.2,.8,.2,1)` : '';
		el.style.transform = to > 0 ? `translateY(${to}px)` : '';
		if (!animate) return Promise.resolve();
		return wait(SPRING_MS).then(() => {
			el.style.transition = '';
		});
	}

	async function release(): Promise<void> {
		if (phase !== 'ready') {
			phase = 'idle';
			await place(0, true);
			return;
		}
		if (!navigator.onLine) {
			phase = 'offline';
			await place(PULL_HOLD, true);
			await wait(OFFLINE_MS);
		} else {
			phase = 'syncing';
			await place(PULL_HOLD, true);
			let summary = null;
			try {
				summary = await syncNow();
				await invalidateAll();
			} catch (e) {
				console.warn('[pull] the sync failed', e);
			}
			if (doneWord(summary)) {
				phase = 'done';
				await wait(DONE_MS);
			}
		}
		await place(0, true);
		phase = 'idle';
	}

	$effect(() => {
		if (!sheet || desk.current) return;
		const el = sheet;
		let start: { x: number; y: number; target: Element | null } | null = null;
		let decided = false;
		let pulling = false;

		const onStart = (e: TouchEvent) => {
			if (phase !== 'idle' || e.touches.length !== 1) return;
			// Scrolled down, the page scrolls freely: no listener it would wait on.
			if (!watchesMove(window.scrollY)) return;
			window.addEventListener('touchmove', onMove, { passive: false });
			const touch = e.touches[0];
			start = {
				x: touch.clientX,
				y: touch.clientY,
				target: e.target instanceof Element ? e.target : null
			};
			decided = false;
			pulling = false;
		};
		const onMove = (e: TouchEvent) => {
			if (!start) return;
			const touch = e.touches[0];
			const dx = touch.clientX - start.x;
			const dy = touch.clientY - start.y;
			if (!decided) {
				if (Math.hypot(dx, dy) < DECIDE_PX) return;
				decided = true;
				pulling = mayStart({
					pointerType: 'touch',
					scrollY: window.scrollY,
					dx,
					dy,
					inside:
						e.defaultPrevented || sheetStack.openCount > 0 || !!start.target?.closest(EXCLUDED)
				});
				if (!pulling) return;
				const hero = el.querySelector(':scope > [data-band-hero]')?.getBoundingClientRect();
				const top = el.getBoundingClientRect().top;
				origin = hero && hero.height > 0 ? Math.min(top, hero.top) : top;
				below = top - origin;
			}
			if (!pulling) return;
			// The page must not scroll or bounce under the pull.
			e.preventDefault();
			const to = pullDistance(dy - DECIDE_PX);
			phase = phaseWhilePulling(to);
			void place(to, false);
		};
		const onEnd = () => {
			window.removeEventListener('touchmove', onMove);
			const was = pulling;
			start = null;
			decided = false;
			pulling = false;
			if (was) void release();
		};

		window.addEventListener('touchstart', onStart, { passive: true });
		window.addEventListener('touchend', onEnd);
		window.addEventListener('touchcancel', onEnd);
		return () => {
			window.removeEventListener('touchstart', onStart);
			window.removeEventListener('touchmove', onMove);
			window.removeEventListener('touchend', onEnd);
			window.removeEventListener('touchcancel', onEnd);
			el.style.transform = '';
			el.style.transition = '';
		};
	});
</script>

{#if d > 0}
	<!--
		The gap the sheet leaves: the band's colour, and the words in its middle.
		Before the sheet in the page, so the sheet (later, positioned) paints over it.
	-->
	<div
		aria-hidden={phase === 'pull' || phase === 'ready' ? 'true' : undefined}
		role={phase === 'pull' || phase === 'ready' ? undefined : 'status'}
		class="pointer-events-none fixed inset-x-0 bg-band text-[14px] font-semibold text-band-small desk:hidden"
		style="top: {origin}px; height: {d + below + SHEET_RADIUS}px"
	>
		<!-- The words in the middle of what the pull opened, above the hero. -->
		<span
			class="flex items-center justify-center"
			style="height: {d}px; opacity: {Math.min(1, d / 36)}">{word}</span
		>
	</div>
{/if}
