<!-- src/lib/components/ui/VideoPlayer.svelte -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { getDance } from '$lib/dances/dances';
	import type { VideoRate } from '$lib/video-prefs';
	import {
		DEFAULT_FRAME_S,
		edgeFrameTime,
		frameNumber,
		frameSeek,
		lengthText,
		loopTarget,
		MIN_SECTION_MS,
		moveEdge,
		msOf,
		preciseTime,
		sortSpots,
		spotLabel,
		spotTime,
		step
	} from '$lib/video/spots';
	import { fetchSpots, patchSpot, postSpot, removeSpot, SpotsApiError } from '$lib/video/spots-api';
	import {
		doneTarget,
		levelOf,
		loopOf,
		openingStack,
		prune,
		sheetOf,
		type PlayerSheet as SheetKind,
		type Screen,
		type Stack
	} from '$lib/video/screens';
	import { PlayerHistory } from '$lib/video/player-history';
	import { keyAction, type KeyAction } from '$lib/video/keys';
	import { layoutFor } from '$lib/video/layout';
	import { watchFrameDuration } from '$lib/video/frame-rate';
	import Icon from '$lib/components/video/Icon.svelte';
	import { icons } from '$lib/components/video/icons';
	import { BTN, BTN_ACCENT } from '$lib/components/video/styles';
	import TopBar from '$lib/components/video/TopBar.svelte';
	import Transport from '$lib/components/video/Transport.svelte';
	import Timeline from '$lib/components/video/Timeline.svelte';
	import Toast from '$lib/components/video/Toast.svelte';
	import SpotList from '$lib/components/video/SpotList.svelte';
	import SectionView from '$lib/components/video/SectionView.svelte';
	import SpotEditor, { type MoveHow, type Times } from '$lib/components/video/SpotEditor.svelte';
	import PlayerSheet from '$lib/components/video/PlayerSheet.svelte';
	import type { Spot, SpotOwner } from '$lib/types';

	interface Props {
		src: string;
		owner: SpotOwner;
		/** Seconds: where the inline player was. */
		startAt: number;
		mirror: boolean;
		rate: VideoRate;
		onchoose: (next: { mirror?: boolean; rate?: VideoRate }) => void;
		/** Seconds: where to leave the inline player. */
		onclose: (at: number) => void;
		/** A section to open on: its own view, looping and playing. */
		loopSpot?: Spot;
		/** What the top bar names: the lesson or figure, and what kind of video. */
		title?: string;
		subtitle?: string;
	}

	let {
		src,
		owner,
		startAt,
		mirror,
		rate,
		onchoose,
		onclose,
		loopSpot,
		title = 'Video',
		subtitle = ''
	}: Props = $props();

	const FULL: Screen = { kind: 'full' };

	let dialog: HTMLDialogElement = $state()!;
	let stage: HTMLDivElement = $state()!;
	let video: HTMLVideoElement = $state()!;

	let current = $state(0);
	let duration = $state(NaN);
	let paused = $state(true);
	let naturalW = $state(16);
	let naturalH = $state(9);
	let vw = $state(390);
	let vh = $state(844);
	const layout = $derived(layoutFor(vw, vh));

	let spots = $state<Spot[]>(untrack(() => (loopSpot ? [loopSpot] : [])));
	let loadFailed = $state(false);
	let stack = $state<Stack>([]);
	let opened = $state(false);
	/** The editor's Loop toggle: the loop rests while it is off, for that editor visit only. */
	let loopPaused = $state(false);
	let selected = $state<'start' | 'end'>('start');
	/** Milliseconds: the start of a section whose end has not been tapped yet. */
	let pendingStart = $state<number | null>(null);
	let frameS = $state(DEFAULT_FRAME_S);
	let sheetMessage = $state<string | null>(null);
	let toast = $state<{ text: string; action?: { label: string; run: () => void } } | null>(null);

	const level = $derived(levelOf(stack));
	const sheet = $derived(sheetOf(stack));
	const openSpot = $derived(
		level.kind === 'section' || level.kind === 'edit'
			? (spots.find((s) => s.id === level.spotId) ?? null)
			: null
	);
	const loop = $derived(loopOf(stack, spots, loopPaused));
	const currentMs = $derived(current * 1000);
	const frameNo = $derived(frameNumber(current, frameS));
	const durationMs = $derived(Number.isFinite(duration) ? duration * 1000 : 0);

	/*
	 * The list keeps its order while an editor is open: a row that jumped as its
	 * start moved would lose the thumb under it (desktop shows both at once).
	 */
	let frozenOrder: number[] | null = null;
	const listSpots = $derived.by(() => {
		const sorted = sortSpots(spots);
		if (level.kind !== 'edit') {
			frozenOrder = null;
			return sorted;
		}
		frozenOrder ??= sorted.map((s) => s.id);
		const order = frozenOrder;
		const at = (s: Spot) => {
			const i = order.indexOf(s.id);
			return i === -1 ? Infinity : i;
		};
		return [...spots].sort((a, b) => at(a) - at(b));
	});

	const accent = $derived(getDance(page.params.dance ?? 'salsa').accentDark);

	/* ---------- history: one entry per screen ---------- */

	let closed = false;
	let wentFullscreen = false;

	function finish() {
		if (closed) return;
		closed = true;
		wentFullscreen = false;
		const at = video.currentTime;
		video.pause();
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		if (dialog.open) dialog.close();
		onclose(at);
	}

	const nav = new PlayerHistory(
		{
			push: (d) => pushState('', { videoPlayer: d }),
			replace: (d) => replaceState('', { videoPlayer: d }),
			go: (d) => history.go(d)
		},
		(s) => (stack = s),
		finish
	);

	onMount(() => {
		dialog.showModal();
		nav.open(openingStack(loopSpot?.id));
		opened = true;
		stage.requestFullscreen?.().then(
			() => (wentFullscreen = true),
			() => {
				// Refused (no user activation left, or an iframe): the dialog still fills the screen.
			}
		);
		/*
		 * Leaving browser fullscreen (Esc, Android's back in the app) goes up one
		 * level like any back, and the player stays open filling the viewport —
		 * it never asks for fullscreen again. At the full video that closes it.
		 */
		const left = () => {
			if (!wentFullscreen || document.fullscreenElement) return;
			wentFullscreen = false;
			nav.up();
		};
		document.addEventListener('fullscreenchange', left);
		return () => document.removeEventListener('fullscreenchange', left);
	});

	$effect(() => {
		const depth = page.state.videoPlayer;
		if (opened) untrack(() => nav.sync(depth));
	});

	/* A new level starts with its loop running and the start selected. */
	$effect(() => {
		void level;
		untrack(() => {
			loopPaused = false;
			selected = 'start';
		});
	});

	/* ---------- spots ---------- */

	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	function say(text: string, action?: { label: string; run: () => void }) {
		toast = { text, action };
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 4000);
	}
	onMount(() => () => clearTimeout(toastTimer));

	function loaded(list: Spot[]) {
		spots = list;
		const pruned = prune(nav.stack, list);
		if (pruned !== nav.stack) nav.jump(pruned);
	}

	onMount(() => {
		fetchSpots(owner).then(loaded, () => {
			loadFailed = true;
			say("Couldn't load spots");
		});
		return watchFrameDuration(video, (s) => (frameS = s));
	});

	async function save(input: { startMs: number; endMs: number | null; label: string | null }) {
		try {
			const spot = await postSpot(owner, input);
			spots = [...spots, spot];
			return spot;
		} catch {
			say("Couldn't save");
			return null;
		}
	}

	async function mark() {
		const spot = await save({ startMs: msOf(video.currentTime), endMs: null, label: null });
		if (spot)
			say(`Point saved at ${spotTime(spot.startMs)}`, { label: 'Edit', run: () => toEdit(spot) });
	}

	/** Set while a section save is in flight, so a double tap cannot post it twice. */
	let saving = false;
	async function section() {
		if (saving) return;
		const now = msOf(video.currentTime);
		if (pendingStart === null) {
			pendingStart = now;
			return;
		}
		if (now - pendingStart < MIN_SECTION_MS) {
			say('Play on a little, then end the section');
			return;
		}
		saving = true;
		try {
			const spot = await save({ startMs: pendingStart, endMs: now, label: null });
			if (spot) {
				pendingStart = null;
				say(`Section saved · ${lengthText(now - spot.startMs)}`, {
					label: 'Edit',
					run: () => toEdit(spot)
				});
			}
		} finally {
			saving = false;
		}
	}

	/*
	 * Edits show at once and are sent one after another, so a run of quick
	 * taps arrives in order. Each sends absolute values, so the last to land is
	 * the truth. A failure reloads the list rather than guessing which of the
	 * queued edits the server kept.
	 */
	let sending: Promise<void> = Promise.resolve();
	function send(
		id: number,
		changes: { label?: string | null; startMs?: number; endMs?: number | null }
	) {
		sending = sending.then(async () => {
			try {
				await patchSpot(id, changes);
			} catch {
				say("Couldn't save");
				await fetchSpots(owner).then(loaded, () => {});
			}
		});
	}

	function change(
		spot: Spot,
		changes: Partial<Pick<Spot, 'label' | 'startMs' | 'endMs'>>,
		write = true
	) {
		const next = { ...spot, ...changes };
		spots = spots.map((s) => (s.id === next.id ? next : s));
		if (write) send(spot.id, changes);
		return next;
	}

	/** Only the keys that differ: a point never sends an end, nor a start-only edit its end. */
	function diff(spot: Spot, times: Times) {
		const out: { startMs?: number; endMs?: number | null } = {};
		if (times.startMs !== spot.startMs) out.startMs = times.startMs;
		if (times.endMs !== spot.endMs) out.endMs = times.endMs;
		return out;
	}

	/** Play from the start, or the last two seconds up to the end, so the cut is heard. */
	function hear(spot: Spot, edge: 'start' | 'end') {
		video.currentTime =
			edge === 'end' && spot.endMs !== null
				? Math.max(spot.startMs, spot.endMs - 2000) / 1000
				: spot.startMs / 1000;
		void video.play().catch(() => {});
	}

	function moved(spot: Spot, times: Times, how: MoveHow, edge: 'start' | 'end') {
		const next = change(spot, diff(spot, times), how !== 'drag');
		if (how === 'now') {
			const at = edge === 'start' ? next.startMs : (next.endMs ?? next.startMs);
			say(`${edge === 'start' ? 'Start' : 'End'} set to ${preciseTime(at)}`);
		} else if (how === 'frame' || how === 'drag') {
			// A frame is for looking: pause on the edge's own frame.
			video.pause();
			video.currentTime = edgeFrameTime(next, edge, frameS);
		} else {
			hear(next, edge);
		}
	}

	/** A drag sends one write, on release, with where the edge ended up. */
	function dragged(edge: 'start' | 'end') {
		if (!openSpot) return;
		send(openSpot.id, { startMs: openSpot.startMs, endMs: openSpot.endMs });
		hear(openSpot, edge);
	}

	function relabel(label: string) {
		const spot = openSpot;
		const clean = label.trim() || null;
		if (spot && clean !== spot.label) change(spot, { label: clean });
		nav.up();
	}

	/** Ids with a delete in flight, so a double tap cannot send it twice. */
	let deleting = false;
	async function remove() {
		const spot = openSpot;
		if (!spot || deleting) return;
		deleting = true;
		try {
			await removeSpot(spot.id);
			spots = spots.filter((s) => s.id !== spot.id);
			nav.jump([FULL]);
			say(`Deleted ${spotLabel(spot)}`, { label: 'Undo', run: () => undo(spot) });
		} catch (e) {
			// A linked section: the server says what to unlink first.
			sheetMessage = e instanceof SpotsApiError && e.status === 409 ? e.message : "Couldn't save";
		} finally {
			deleting = false;
		}
	}

	/** A deleted spot comes back as a new one: same times and name, a new id. It was never linked. */
	async function undo(spot: Spot) {
		toast = null;
		await save({ startMs: spot.startMs, endMs: spot.endMs, label: spot.label });
	}

	/* ---------- levels ---------- */

	function toSection(spot: Spot) {
		const target: Screen = { kind: 'section', spotId: spot.id };
		if (nav.stack.length === 1) nav.push(target);
		else nav.jump([FULL, target]);
		video.currentTime = spot.startMs / 1000;
		void video.play().catch(() => {});
	}

	function toEdit(spot: Spot) {
		toast = null;
		const target: Screen = { kind: 'edit', spotId: spot.id };
		const lvl = levelOf(nav.stack);
		if (lvl.kind === 'section' && lvl.spotId === spot.id) nav.push(target);
		else if (nav.stack.length === 1) nav.push(target);
		else nav.jump([FULL, target]);
		video.currentTime = spot.startMs / 1000;
		if (spot.endMs !== null) void video.play().catch(() => {});
	}

	function fromList(spot: Spot) {
		if (spot.endMs === null) toEdit(spot);
		else toSection(spot);
	}

	function done() {
		if (!openSpot) return;
		const t = doneTarget(nav.stack, openSpot);
		if (t === 'pop') nav.up();
		else nav.replaceTop(t);
	}

	function openSheet(kind: SheetKind) {
		sheetMessage = null;
		nav.push({ kind: 'sheet', sheet: kind });
	}

	/* ---------- playback ---------- */

	$effect(() => {
		video.playbackRate = rate;
	});

	function toggle() {
		if (video.paused) void video.play().catch(() => {});
		else video.pause();
	}

	function nudge(deltaS: number) {
		video.currentTime = step(video.currentTime, deltaS, video.duration);
	}

	function frameStep(f: -1 | 1) {
		video.pause();
		video.currentTime = frameSeek(video.currentTime, f, frameS, video.duration);
	}

	function seek(ms: number) {
		video.currentTime = ms / 1000;
	}

	function selectEdge(edge: 'start' | 'end') {
		selected = edge;
		if (openSpot) hear(openSpot, edge);
	}

	/*
	 * The loop is checked every animation frame, not on `timeupdate`: that fires
	 * about four times a second, which overshoots a section's end by up to a
	 * quarter-second at 1×.
	 */
	$effect(() => {
		if (paused || !loop) return;
		const l = loop;
		let frame = requestAnimationFrame(function tick() {
			const to = loopTarget(video.currentTime, l);
			if (to !== null) video.currentTime = to;
			frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	});

	/** A section that ends at (or rounds past) the last frame: the frame check never sees it. */
	function onended() {
		if (!loop) return;
		video.currentTime = loop.startMs / 1000;
		void video.play();
	}

	/* ---------- keys ---------- */

	function act(a: KeyAction) {
		const spot = openSpot;
		switch (a) {
			case 'toggle':
				return toggle();
			case 'back1':
				return nudge(-1);
			case 'fwd1':
				return nudge(1);
			case 'framePrev':
				return frameStep(-1);
			case 'frameNext':
				return frameStep(1);
			case 'mark':
				return void mark();
			case 'section':
				return void section();
			case 'setStart':
			case 'setEnd': {
				if (!spot) return;
				const edge = a === 'setStart' ? 'start' : 'end';
				const times = moveEdge(spot, edge, msOf(video.currentTime), video.duration);
				selected = edge;
				if (times) moved(spot, times, 'now', edge);
				return;
			}
			case 'jumpStart':
				return spot && hear(spot, 'start');
			case 'jumpEnd':
				return spot && hear(spot, 'end');
			case 'loop':
				loopPaused = !loopPaused;
				return;
			case 'keys':
				return openSheet('keys');
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement) return;
		if (sheet) return;
		const a = keyAction(e, level.kind);
		if (!a) return;
		// Also stops a focused button's own Space activation, which would toggle twice.
		e.preventDefault();
		act(a);
	}

	const tokens = $derived(
		[
			['bg', '#0a0a0b'],
			['surface', '#141417'],
			['sheet', '#17171b'],
			['raised', '#1e1e23'],
			['hover', '#27272e'],
			['line', '#2a2a31'],
			['tick', '#3f3f46'],
			['fill', '#52525b'],
			['faint', '#71717a'],
			['band', '#8b8b95'],
			['muted', '#a1a1aa'],
			['handle', '#d4d4d8'],
			['ink-2', '#d4d4d8'],
			['ink', '#f4f4f5'],
			['accent', accent],
			['accent-ink', '#140803'],
			['danger', '#fca5a5'],
			['danger-fill', '#dc2626']
		]
			.map(([k, v]) => `--pl-${k}: ${v}`)
			.join('; ')
	);

	const badge = $derived(
		[rate !== 1 ? `${rate}×` : null, mirror ? 'Mirrored' : null].filter(Boolean).join(' · ')
	);
	const loopProgress = $derived(
		loop && loop.endMs !== null
			? Math.max(0, Math.min(100, ((currentMs - loop.startMs) / (loop.endMs - loop.startMs)) * 100))
			: 0
	);
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<dialog
	bind:this={dialog}
	aria-label="Video"
	class="player"
	data-layout={layout}
	style={tokens}
	oncancel={(e) => {
		// Esc, and Android Chrome's back on a modal dialog: up one level.
		e.preventDefault();
		nav.up();
	}}
	onclose={() => {
		// Closed under us (Chrome may close a modal dialog on a repeated back
		// without a cancel): reopen it and treat it as the back it was.
		if (closed) return;
		dialog.showModal();
		nav.up();
	}}
	{onkeydown}
>
	<div
		bind:this={stage}
		class="relative flex h-full w-full flex-col overflow-hidden bg-(--pl-bg) text-(--pl-ink)"
	>
		<TopBar {title} {subtitle} {mirror} {rate} onclose={() => nav.close()} {onchoose} />

		<div
			class="relative w-full shrink-0 bg-black"
			style:aspect-ratio="{naturalW} / {naturalH}"
			style:max-height="55dvh"
		>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={video}
				{src}
				playsinline
				preload="auto"
				class="absolute inset-0 h-full w-full object-contain"
				class:mirror
				bind:currentTime={current}
				bind:duration
				bind:paused
				onloadedmetadata={() => {
					video.preservesPitch = true;
					if (video.videoWidth && video.videoHeight) {
						naturalW = video.videoWidth;
						naturalH = video.videoHeight;
					}
					video.currentTime = loopSpot ? loopSpot.startMs / 1000 : startAt;
					// Opened from a tap on a section card, so play() is allowed.
					if (loopSpot) void video.play().catch(() => {});
				}}
				{onended}
			></video>
			<button
				type="button"
				class="absolute inset-0 grid cursor-pointer place-items-center"
				aria-label={paused ? 'Play' : 'Pause'}
				onclick={toggle}
			>
				{#if paused}
					<span class="grid size-14 place-items-center rounded-full bg-black/55 text-white">
						<Icon d={icons.play} filled size={26} />
					</span>
				{/if}
			</button>
			{#if badge}
				<span
					class="pointer-events-none absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-0.5 text-[12px] text-zinc-200"
					>{badge}</span
				>
			{/if}
			{#if loop}
				<span
					class="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-0.5 text-[12px] text-zinc-200"
				>
					<Icon d={icons.loop} size={13} class="text-(--pl-accent)" />{spotLabel(loop)}
				</span>
				<span
					class="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-(--pl-accent)"
					style:width="{loopProgress}%"
				></span>
			{/if}
		</div>

		{#if level.kind === 'section' && openSpot}
			<SectionView
				spot={openSpot}
				{currentMs}
				{frameNo}
				{paused}
				{rate}
				variant="panel"
				onfull={() => nav.up()}
				onedit={() => openSpot && toEdit(openSpot)}
				onseek={seek}
				ontoggle={toggle}
				onstep={nudge}
				onframe={frameStep}
				onrate={(r) => onchoose({ rate: r })}
			/>
		{:else if level.kind === 'edit' && openSpot}
			{@const spot = openSpot}
			<SpotEditor
				{spot}
				{selected}
				{currentMs}
				durationS={duration}
				{frameS}
				{frameNo}
				{paused}
				looping={!loopPaused}
				transport
				onselect={selectEdge}
				onmove={(times, how, edge) => moved(spot, times, how, edge)}
				ondragstart={(edge) => {
					selected = edge;
					video.pause();
				}}
				ondragend={dragged}
				onseek={seek}
				onloop={() => (loopPaused = !loopPaused)}
				onrename={() => openSheet('rename')}
				ondelete={() => openSheet('delete')}
				ondone={done}
				ontoggle={toggle}
				onframe={frameStep}
			/>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col">
				<div class="px-4 pt-2.5">
					<div class="flex items-baseline gap-2 text-[13px] tabular-nums">
						<span class="text-[15px] font-semibold">{preciseTime(currentMs)}</span>
						<span class="text-(--pl-muted)">frame {frameNo}</span>
						<span class="ml-auto text-(--pl-muted)"
							>{durationMs ? preciseTime(durationMs) : '–'}</span
						>
					</div>
					<Timeline
						fromMs={0}
						toMs={durationMs || 1}
						{currentMs}
						bands={listSpots.map((s) => ({ ...s, active: false }))}
						pending={pendingStart === null ? null : { startMs: pendingStart }}
						onseek={seek}
					/>
				</div>
				<div class="px-4 pt-1">
					<Transport {paused} ontoggle={toggle} onstep={nudge} onframe={frameStep} />
				</div>
				<div class="flex gap-2 px-4 pt-3 pb-1">
					<button type="button" class="{BTN} flex-1" onclick={mark}>
						<Icon d={icons.flag} />Mark point
					</button>
					<button
						type="button"
						class="{pendingStart === null ? BTN : BTN_ACCENT} flex-[1.4]"
						onclick={section}
					>
						<Icon d={icons.bracket} />{pendingStart === null
							? 'Start section'
							: `End section · ${lengthText(Math.max(0, currentMs - pendingStart))}`}
					</button>
				</div>
				<div class="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-(--pl-raised)">
					<SpotList spots={listSpots} activeId={null} {loadFailed} onopen={fromList} />
				</div>
			</div>
		{/if}

		{#if toast}
			<div class="absolute inset-x-4 z-30" style:bottom={level.kind === 'edit' ? '84px' : '20px'}>
				<Toast text={toast.text} action={toast.action} />
			</div>
		{/if}

		{#if sheet}
			<PlayerSheet
				kind={sheet}
				spot={openSpot}
				message={sheetMessage}
				oncancel={() => nav.up()}
				onrename={relabel}
				ondelete={remove}
			/>
		{/if}
	</div>
</dialog>

<style>
	.player {
		margin: 0;
		/* 100%, not 100vw: vw counts a desktop page's scrollbar and pushes the right edge off screen. */
		width: 100%;
		height: 100dvh;
		max-width: none;
		max-height: none;
		padding: 0;
		border: 0;
		background: #0a0a0b;
		color-scheme: dark;
	}
	.player::backdrop {
		background: black;
	}
	/* Learn it facing the teacher, as in a studio mirror. */
	.mirror {
		transform: scaleX(-1);
	}
</style>
