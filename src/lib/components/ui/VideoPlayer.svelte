<!-- src/lib/components/ui/VideoPlayer.svelte -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { t } from '$lib/i18n/catalog';
	import { goto, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import {
		loadVideoPrefs,
		saveVideoPrefs,
		type VideoChoice,
		type VideoRate
	} from '$lib/video-prefs';
	import {
		edgeViewTime,
		editOpening,
		hearAt,
		sectionProgress,
		lengthText,
		loopTarget,
		MIN_SECTION_MS,
		moveEdge,
		msOf,
		preciseTime,
		sortSpots,
		spotLabel,
		spotTime,
		step,
		TENTH_MS
	} from '$lib/video/spots';
	import {
		fetchSpots,
		patchSpot,
		postSpot,
		removeSpot,
		restoreTrashEntry,
		SpotsApiError
	} from '$lib/video/spots-api';
	import {
		doneTarget,
		editStack,
		levelOf,
		linkStepsOf,
		loopOf,
		openingStack,
		prune,
		sheetOf,
		type PlayerSheet as SheetKind,
		type Screen,
		type Stack
	} from '$lib/video/screens';
	import { PlayerHistory } from '$lib/video/player-history';
	import { entryState } from '$lib/sheets/history.svelte';
	import { keyAction, type KeyAction } from '$lib/video/keys';
	import { layoutFor } from '$lib/video/layout';
	import {
		buffering,
		cornerBadge,
		linkEntry,
		playerMode,
		toastPlace,
		portraitBody,
		topBar,
		type ToastTone
	} from '$lib/video/chrome';
	import { holdScreenOn } from '$lib/video/screen-on';
	import { letPhoneTurn, type TurnBridge } from '$lib/video/turning';
	import { NO_ZOOM, zoomTransform, type View } from '$lib/video/zoom';
	import VideoGestures from '$lib/components/video/VideoGestures.svelte';
	import UiIcon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import {
		HIDE,
		INVITE,
		KBD,
		MARK_DESK,
		MARK_DESK_SQUARE,
		MARK_FILL,
		MARK_GLASS,
		MARK_GLASS_SQUARE,
		MARK_WIDE,
		ON_VIDEO,
		SECTION_ON_DESK,
		SECTION_WIDE
	} from '$lib/components/video/styles';
	import TopBar from '$lib/components/video/TopBar.svelte';
	import Transport from '$lib/components/video/Transport.svelte';
	import Timeline from '$lib/components/video/Timeline.svelte';
	import Toast from '$lib/components/video/Toast.svelte';
	import SpotList from '$lib/components/video/SpotList.svelte';
	import SectionView from '$lib/components/video/SectionView.svelte';
	import SectionRow from '$lib/components/video/SectionRow.svelte';
	import SpotEditor, { type MoveHow, type Times } from '$lib/components/video/SpotEditor.svelte';
	import PlayerSheet from '$lib/components/video/PlayerSheet.svelte';
	import LinkPopup from '$lib/components/links/LinkPopup.svelte';
	import ClashSheet from './ClashSheet.svelte';
	import type { ClashAsk } from '$lib/unsaved/guard.svelte';
	import {
		clashView,
		mineOverTheirs,
		seenAfterSave,
		type ClashInfo,
		type Seen
	} from '$lib/clash/clash';
	import { nameFromServer, openingSteps, type LinkStep } from '$lib/video/link-steps';
	import type { Spot, SpotOwner } from '$lib/types';

	interface Props {
		src: string;
		owner: SpotOwner;
		/** Seconds: where the inline player was. */
		startAt: number;
		mirror: boolean;
		rate: VideoRate;
		/** The sound off; remembered beside mirror and speed. */
		muted?: boolean;
		onchoose: (next: VideoChoice) => void;
		/** Seconds: where to leave the inline player. */
		onclose: (at: number) => void;
		/** A section to open on: its own view, looping and playing. */
		loopSpot?: Spot;
		/** What the top bar names: the lesson or figure, and what kind of video. */
		title?: string;
		subtitle?: string;
		/**
		 * Linking sections from inside the player: the toast's Link, the section
		 * view's link badge and the editor's line. Only where the page manages the
		 * video's sections (a lesson's videos, a figure's recordings); elsewhere
		 * what a section links to is shown, never changed.
		 */
		linking?: boolean;
		/**
		 * Marking, editing and deleting spots: off for a reader of a group's
		 * video, who plays its sections and points but changes none of them. No
		 * Mark or Section, no editor level, no M or S key.
		 */
		canEdit?: boolean;
		/**
		 * The simple player (Follow my class, Practise and keep my own): always the folded bar
		 * with −5 s / +5 s, a top bar of close, title, repeat, mute, mirror and speed, and nothing to
		 * mark, edit or link. A `loopSpot` plays as a fixed loop with repeat lit.
		 */
		simple?: boolean;
		/** Simple only: loop the whole video when it ends. */
		repeat?: boolean;
	}

	let {
		src,
		owner,
		startAt,
		mirror,
		rate,
		muted = false,
		onchoose,
		onclose,
		loopSpot,
		title = t().video.untitled,
		subtitle = '',
		linking: linkingProp = false,
		canEdit: canEditProp = true,
		simple = false,
		repeat = false
	}: Props = $props();
	const w = $derived(t().video);
	/** The simple player marks and edits nothing, whoever the reader is. */
	const canEdit = $derived(canEditProp && !simple);
	/** A reader links nothing either. */
	const linking = $derived(linkingProp && canEdit);

	const FULL: Screen = { kind: 'full' };

	let dialog: HTMLDialogElement = $state()!;
	let stage: HTMLDivElement = $state()!;
	let video: HTMLVideoElement = $state()!;

	let current = $state(0);
	let duration = $state(NaN);
	let paused = $state(true);
	let naturalW = $state(16);
	let naturalH = $state(9);
	/** Pinch zoom: kept across levels, gone when the player closes. */
	let view = $state<View>(NO_ZOOM);
	/** Portrait: the controls folded to a slim bar, remembered beside mirror and speed. */
	let hidden = $state(false);
	onMount(() => {
		hidden = loadVideoPrefs().hidden;
	});
	function setHidden(h: boolean) {
		hidden = h;
		saveVideoPrefs({ hidden: h });
	}
	let vw = $state(390);
	let vh = $state(844);
	const layout = $derived(layoutFor(vw, vh));

	let spots = $state<Spot[]>(untrack(() => (loopSpot ? [loopSpot] : [])));
	let loadFailed = $state(false);
	/*
	 * Raw, not deep: a deep proxy re-wraps every screen on each change, so the
	 * level would look new when only a sheet opened — resetting the editor's
	 * chosen edge and Loop toggle under it.
	 */
	let stack = $state.raw<Stack>([]);
	/** A level a jump is on its way to (see `go`). */
	let arriving = $state.raw<Screen | null>(null);
	let opened = $state(false);
	/** The editor's Loop toggle: the loop rests while it is off, for that editor visit only. */
	let loopPaused = $state(false);
	let selected = $state<'start' | 'end'>('start');
	/** Milliseconds: the start of a section whose end has not been tapped yet. */
	let pendingStart = $state<number | null>(null);
	let sheetMessage = $state<string | null>(null);

	/*
	 * The clash check. Each edit says what it saw: the values this player last
	 * set or got back for the spot, so a run of 0.1 s nudges never clashes with
	 * its own previous one however slow the answers. A spot someone else saved
	 * since opens the clash sheet; its queued edits wait for the choice.
	 */
	const spotSeen = (s: Pick<Spot, 'label' | 'startMs' | 'endMs'>): Seen => ({
		label: s.label,
		startMs: s.startMs,
		endMs: s.endMs
	});
	// Not reactive: nothing renders from it.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const known = new Map<number, Seen>(
		untrack(() => (loopSpot ? [[loopSpot.id, spotSeen(loopSpot)]] : []))
	);
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const clashed = new Set<number>();
	/** By spot: the fields of this player's own edits that wait behind an open clash. */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const held = new Map<number, Set<string>>();
	const hold = (id: number, keys: string[]) =>
		held.set(id, new Set([...(held.get(id) ?? []), ...keys]));
	let clash = $state<ClashAsk | null>(null);
	type ToastAction = { label: string; run: () => void };
	let toast = $state<{
		id: number;
		text: string;
		tone: ToastTone;
		actions: ToastAction[];
	} | null>(null);
	let toastSeq = 0;
	type LinkCreateStep = 'variation' | 'drill' | 'position';
	/** The player's sheet for each of the Link popup's levels; every create step is 'link-new'. */
	const LINK_SHEET: Record<LinkStep, SheetKind> = {
		links: 'link',
		pick: 'link-pick',
		variation: 'link-new',
		drill: 'link-new',
		position: 'link-new',
		'variation-figure': 'link-figure',
		unlink: 'link-unlink'
	};
	const LINK_SHEETS: readonly SheetKind[] = Object.values(LINK_SHEET);
	/** The section or point the Link popup is on, and the create step its 'link-new' sheet stands for. */
	let linkSpotId = $state<number | null>(null);
	/** Whether that spot is a point, for the popup's words before its options come; unknown: undefined. */
	const linkPoint = $derived.by(() => {
		const s = spots.find((x) => x.id === linkSpotId);
		return s ? s.endMs === null : undefined;
	});
	let linkCreate = $state<LinkCreateStep>('variation');
	/** A page a linked row was tapped for: the player closes, then the app goes there. */
	let leaving: string | null = null;

	const level = $derived(levelOf(stack));
	const sheet = $derived(sheetOf(stack));
	/** The Link popup's levels, one history entry each; empty while it is closed. */
	const linkSteps = $derived(linkStepsOf(stack, linkCreate));
	const linkOpen = $derived(sheet !== null && LINK_SHEETS.includes(sheet));
	const openSpot = $derived(
		level.kind === 'section' || level.kind === 'edit'
			? (spots.find((s) => s.id === level.spotId) ?? null)
			: null
	);
	/** The simple player has one level: a section it opened on is its fixed loop. */
	const simpleLoop = $derived(simple && loopSpot && loopSpot.endMs !== null ? loopSpot : null);
	const loop = $derived(simple ? simpleLoop : loopOf(stack, spots, loopPaused, arriving));
	const currentMs = $derived(current * 1000);
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
		// After the close: its Backs have landed, so the new page's entry goes on top of the host page.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the Link popup passes a resolved href
		if (leaving) void goto(leaving);
	}

	const nav = new PlayerHistory(
		{
			// The entry's own state spread in: a sheet under the player keeps its depth.
			push: (d) => pushState('', { ...entryState(), videoPlayer: d }),
			replace: (d) => replaceState('', { ...entryState(), videoPlayer: d }),
			go: (d) => history.go(d)
		},
		(s) => {
			stack = s;
			arriving = null;
		},
		finish
	);

	onMount(() => {
		dialog.showModal();
		nav.open(openingStack(simple ? undefined : loopSpot?.id));
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
	/** A toast; one offering Link stays a little longer, since linking is the next step. */
	function say(text: string, tone: ToastTone, ...actions: ToastAction[]) {
		toast = { id: ++toastSeq, text, tone, actions };
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), toastMs());
	}
	const toastMs = () => (toast?.actions.some((a) => a.label === w.link) ? 6000 : 4000);
	/** A finger on the toast stops its clock; letting go starts it again, in full. */
	function holdToast(held: boolean) {
		clearTimeout(toastTimer);
		if (!held && toast) toastTimer = setTimeout(() => (toast = null), toastMs());
	}
	function dropToast() {
		clearTimeout(toastTimer);
		toast = null;
	}
	onMount(() => () => clearTimeout(toastTimer));

	function loaded(list: Spot[]) {
		spots = list;
		known.clear();
		for (const s of list) known.set(s.id, spotSeen(s));
		const pruned = prune(nav.stack, list);
		if (pruned !== nav.stack) nav.jump(pruned);
	}

	onMount(() => {
		fetchSpots(owner).then(loaded, () => {
			loadFailed = true;
			say(w.loadFailed, 'failed');
		});
	});

	onMount(() => holdScreenOn({ wakeLock: navigator.wakeLock, doc: document }));

	// The Android app stands upright everywhere else; the video may turn.
	onMount(() => letPhoneTurn((window as { SalsaTurn?: TurnBridge }).SalsaTurn));

	async function save(input: { startMs: number; endMs: number | null; label: string | null }) {
		try {
			const spot = await postSpot(owner, input);
			spots = [...spots, spot];
			known.set(spot.id, spotSeen(spot));
			return spot;
		} catch {
			say(w.toast.saveFailed, 'failed');
			return null;
		}
	}

	async function mark() {
		const spot = await save({ startMs: msOf(video.currentTime), endMs: null, label: null });
		if (spot)
			say(
				w.toast.pointSaved(spotTime(spot.startMs)),
				'saved',
				{ label: t().common.edit, run: () => toEdit(spot) },
				// A point links positions (ruling 10).
				...(linking ? [{ label: w.link, run: () => openLink(spot.id) }] : [])
			);
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
			say(w.toast.playOn, 'note');
			return;
		}
		saving = true;
		try {
			const spot = await save({ startMs: pendingStart, endMs: now, label: null });
			if (spot) {
				pendingStart = null;
				say(
					w.toast.sectionSaved(lengthText(now - spot.startMs)),
					'saved',
					{ label: t().common.edit, run: () => toEdit(spot) },
					...(linking ? [{ label: w.link, run: () => openLink(spot.id) }] : [])
				);
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
			if (clashed.has(id)) {
				// Kept for the choice: the screen shows it, so it is still yours to send.
				hold(id, Object.keys(changes));
				return;
			}
			try {
				const before = known.get(id);
				const answer = spotSeen(await patchSpot(id, changes, before));
				// Only what this edit wrote is seen anew: the screen still shows the
				// rest as it was, and the next edit must not claim to have seen more.
				known.set(id, before ? seenAfterSave(before, Object.keys(changes), answer) : answer);
			} catch (e) {
				if (e instanceof SpotsApiError && e.clash) {
					// Every field this edit wrote waits for the choice, the ones that clashed and not.
					hold(id, Object.keys(changes));
					askClash(id, e.clash);
					return;
				}
				// Deleted since by someone else in the group: "Ana deleted this · 2 min ago".
				say(
					e instanceof SpotsApiError && e.status === 410 ? e.message : w.toast.saveFailed,
					'failed'
				);
				await fetchSpots(owner).then(loaded, () => {});
			}
		});
	}

	/** Put a spot's values on screen as given (theirs, or what was chosen). */
	function show(id: number, values: Seen) {
		spots = spots.map((s) =>
			s.id === id
				? {
						...s,
						label: values.label === null ? null : String(values.label),
						startMs: Number(values.startMs),
						endMs: values.endMs === null ? null : Number(values.endMs)
					}
				: s
		);
	}

	/** Someone else saved this spot since: theirs above, yours below, the player's sheet. */
	function askClash(id: number, info: ClashInfo) {
		const mine = spots.find((s) => s.id === id);
		if (!mine) return;
		clashed.add(id);
		/** The choice is made: the edits that waited are handed over, and the spot is free again. */
		const settle = () => {
			clash = null;
			clashed.delete(id);
			known.set(id, info.current);
			const waited = [...(held.get(id) ?? [])];
			held.delete(id);
			return waited;
		};
		/** Your values for `out`'s fields, sent over theirs and shown. */
		const sendOut = (out: Seen, shown: Seen) => {
			const changes: { label?: string | null; startMs?: number; endMs?: number | null } = {};
			if ('label' in out) changes.label = out.label ? String(out.label) : null;
			if ('startMs' in out) changes.startMs = Number(out.startMs);
			if ('endMs' in out) changes.endMs = out.endMs === null ? null : Number(out.endMs);
			show(id, { ...shown, ...changes });
			if (Object.keys(changes).length > 0) send(id, changes);
		};
		clash = {
			kind: 'clash',
			by: info.by,
			at: info.at,
			view: clashView(
				info,
				spotSeen(mine),
				known.get(id) ?? null,
				(key) => (key === 'label' ? 'text' : 'time'),
				(_, ms) => (ms === null ? '' : preciseTime(Number(ms)))
			),
			typed: [],
			mine: (values) => {
				const waited = settle();
				const now = spots.find((s) => s.id === id);
				if (!now) return;
				// Yours for what clashed and what waited, theirs for everything else.
				const boxes: Record<string, string> =
					'label' in values ? { label: values.label.trim() } : {};
				const r = mineOverTheirs(info, spotSeen(now), boxes, waited);
				sendOut(r.send, r.show);
			},
			theirs: () => {
				const waited = settle();
				const now = spots.find((s) => s.id === id);
				if (!now) return show(id, info.current);
				// Theirs for what clashed; your waiting edits to other fields still go.
				const kept = waited.filter((k) => !info.changed.includes(k));
				const r = mineOverTheirs({ ...info, changed: [] }, spotSeen(now), {}, kept);
				sendOut(r.send, r.show);
			}
		};
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

	/**
	 * Playing: from the start, or the last two seconds up to the end, so the
	 * cut is heard. Paused: it stays paused where the edge shows (`hearAt`).
	 */
	function hear(spot: Spot, edge: 'start' | 'end', paused = video.paused) {
		const h = hearAt(spot, edge, paused);
		video.currentTime = h.atS;
		if (h.play) void video.play().catch(() => {});
	}

	function moved(spot: Spot, times: Times, how: MoveHow, edge: 'start' | 'end') {
		const next = change(spot, diff(spot, times), how !== 'drag');
		if (how === 'now') {
			const at = edge === 'start' ? next.startMs : (next.endMs ?? next.startMs);
			say(w.toast.edgeSet(edge, preciseTime(at)), 'note');
		} else if (how === 'tenth' || how === 'drag') {
			// A fine move is for looking: pause where the edge shows.
			video.pause();
			video.currentTime = edgeViewTime(next, edge);
		} else {
			hear(next, edge);
		}
	}

	/** Whether the video was playing when a drag began: its release plays the cut only then. */
	let playedBeforeDrag = false;

	/** A drag sends one write, on release, with where the edge ended up. */
	function dragged(edge: 'start' | 'end') {
		if (!openSpot) return;
		send(openSpot.id, { startMs: openSpot.startMs, endMs: openSpot.endMs });
		hear(openSpot, edge, !playedBeforeDrag);
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
			const { trashId } = await removeSpot(spot.id);
			spots = spots.filter((s) => s.id !== spot.id);
			nav.jump([FULL]);
			say(w.toast.deleted(spotLabel(spot)), 'deleted', {
				label: t().common.undo,
				run: () => undo(spot, trashId)
			});
		} catch (e) {
			// A linked section: the server says what to unlink first.
			sheetMessage =
				e instanceof SpotsApiError && e.status === 409 ? e.message : w.toast.saveFailed;
		} finally {
			deleting = false;
		}
	}

	/**
	 * A group's deleted spot comes back from Recently deleted: the same row,
	 * its id and its History (risk 18). A person's comes back as a new one:
	 * same times and name, a new id. It was never linked.
	 */
	async function undo(spot: Spot, trashId: number | null) {
		toast = null;
		if (trashId === null) {
			await save({ startMs: spot.startMs, endMs: spot.endMs, label: spot.label });
			return;
		}
		try {
			await restoreTrashEntry(trashId);
			await fetchSpots(owner).then(loaded);
		} catch (e) {
			say(
				e instanceof SpotsApiError && e.status === 409 ? e.message : w.toast.restoreFailed,
				'failed'
			);
		}
	}

	/* ---------- levels ---------- */

	/**
	 * A jump that goes back through history lands a moment later: until then
	 * the target is `arriving`, so the old section's loop cannot pull the video
	 * back. Any stack change clears it (a push lands at once).
	 */
	function go(target: Stack) {
		arriving = target[target.length - 1];
		nav.jump(target);
	}

	function toSection(spot: Spot) {
		go([FULL, { kind: 'section', spotId: spot.id }]);
		video.currentTime = spot.startMs / 1000;
		void video.play().catch(() => {});
	}

	function toEdit(spot: Spot) {
		if (!canEdit) return;
		toast = null;
		go(editStack(nav.stack, spot.id));
		const o = editOpening(spot, video.paused);
		video.currentTime = o.atS;
		if (o.play) void video.play().catch(() => {});
	}

	/** A card or a chip: a section's view or a point's editor, always right above the full video, so Back returns there. */
	function fromList(spot: Spot) {
		if (spot.endMs !== null) toSection(spot);
		else if (canEdit) toEdit(spot);
		else seek(spot.startMs);
	}

	function done() {
		if (!openSpot) return;
		const target = doneTarget(nav.stack, openSpot);
		if (target === 'pop') nav.up();
		else nav.replaceTop(target);
	}

	function openSheet(kind: SheetKind) {
		sheetMessage = null;
		nav.push({ kind: 'sheet', sheet: kind });
	}

	/* ---------- linking ---------- */

	/*
	 * Linking pauses the video. Once every sheet is gone (the popup and the
	 * Rename it may offer), it plays on only if it was playing when the popup
	 * opened. Null: no popup has held it.
	 */
	let resumeAfterLink: boolean | null = null;
	function holdForLink() {
		resumeAfterLink ??= !video.paused;
		video.pause();
	}
	$effect(() => {
		if (sheet !== null) return;
		untrack(() => {
			const resume = resumeAfterLink;
			resumeAfterLink = null;
			if (resume && !closed) void video.play().catch(() => {});
		});
	});

	/*
	 * Every level of the Link popup is a sheet of its own, so the phone's Back
	 * and Esc (the dialog's cancel, or the popup's own overlay) step down it one
	 * level at a time; a create step's × or Back lands on the picker, its search
	 * text kept. A section with no links opens straight into the picker.
	 */
	function openLink(spotId: number) {
		toast = null;
		holdForLink();
		linkSpotId = spotId;
		const linked = spots.find((s) => s.id === spotId)?.linkedTo.length ?? 0;
		for (const step of openingSteps(linked)) linkPush(step);
	}

	function linkPush(step: LinkStep) {
		if (step === 'variation' || step === 'drill' || step === 'position') linkCreate = step;
		nav.push({ kind: 'sheet', sheet: LINK_SHEET[step] });
	}

	/**
	 * Finished (a tap, Done, Create and link): every link level goes at once. A
	 * section that had no name now has one, the server's (its first link's,
	 * spec A3): the player reads it back, so the section shows it and a later
	 * save sends what the server holds.
	 */
	function closeLink() {
		const under = nav.stack.filter((s) => !(s.kind === 'sheet' && LINK_SHEETS.includes(s.sheet)));
		const spot = spots.find((s) => s.id === linkSpotId);
		sheetMessage = null;
		nav.jump(under);
		if (spot && nameFromServer(spot.label, spot.linkedTo)) void readName(spot.id);
	}

	/** The section's name as the server holds it, into the player's list and what it last saw. */
	async function readName(id: number) {
		const fresh = (await fetchSpots(owner).catch(() => [] as Spot[])).find((s) => s.id === id);
		if (!fresh) return;
		spots = spots.map((s) => (s.id === id ? { ...s, label: fresh.label } : s));
		known.set(id, spotSeen(fresh));
	}

	/**
	 * "Use this moment as a point" (a section's popup): a point at the playhead,
	 * saved through the spots API, and the popup moves onto it, its own levels
	 * from the bottom (a new point has no links: the picker, positions only).
	 * A refusal or a failure is the popup's to show; nothing moves.
	 */
	async function useMoment(): Promise<string | null> {
		let spot: Spot;
		try {
			spot = await postSpot(owner, { startMs: msOf(video.currentTime), endMs: null, label: null });
		} catch (e) {
			return e instanceof SpotsApiError && e.status < 500 ? e.message : w.toast.pointFailed;
		}
		spots = [...spots, spot];
		known.set(spot.id, spotSeen(spot));
		const under = nav.stack.filter((s) => !(s.kind === 'sheet' && LINK_SHEETS.includes(s.sheet)));
		linkSpotId = spot.id;
		nav.jump([
			...under,
			...openingSteps(0).map((step): Screen => ({ kind: 'sheet', sheet: LINK_SHEET[step] }))
		]);
		return null;
	}

	/** A linked row's tap: the player closes, then the app goes to the row's page. */
	function openLinked(href: string) {
		leaving = href;
		nav.close();
	}

	/** The popup changed a section's links: its small lines follow. */
	function linkedChanged(labels: string[]) {
		spots = spots.map((s) => (s.id === linkSpotId ? { ...s, linkedTo: labels } : s));
	}

	/* ---------- playback ---------- */

	$effect(() => {
		video.playbackRate = rate;
	});
	$effect(() => {
		video.muted = muted;
	});

	function toggle() {
		if (video.paused) void video.play().catch(() => {});
		else video.pause();
	}

	function nudge(deltaS: number) {
		video.currentTime = step(video.currentTime, deltaS, video.duration);
	}

	function tenth(d: -1 | 1) {
		video.pause();
		video.currentTime = step(video.currentTime, (d * TENTH_MS) / 1000, video.duration);
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
		if (loop) {
			video.currentTime = loop.startMs / 1000;
			void video.play();
		} else if (simple && repeat) {
			// Repeat: the whole video again.
			video.currentTime = 0;
			void video.play().catch(() => {});
		}
	}

	/** −5 s / +5 s, the simple player's steps. */
	function five(d: -1 | 1) {
		nudge(d * 5);
	}

	/* ---------- keys ---------- */

	/** The simple player answers only to play and the 1 s arrows (as its double-tap jumps). */
	const SIMPLE_KEYS: readonly KeyAction[] = ['toggle', 'back1', 'fwd1'];

	function act(a: KeyAction) {
		if (simple && !SIMPLE_KEYS.includes(a)) return;
		const spot = openSpot;
		switch (a) {
			case 'toggle':
				return toggle();
			case 'back1':
				return nudge(-1);
			case 'fwd1':
				return nudge(1);
			case 'tenthBack':
				return tenth(-1);
			case 'tenthFwd':
				return tenth(1);
			case 'mark':
				return canEdit ? void mark() : undefined;
			case 'section':
				return canEdit ? void section() : undefined;
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
		if (closed || e.target instanceof HTMLInputElement) return;
		if (sheet) return;
		const onSlider = e.target instanceof Element && e.target.getAttribute('role') === 'slider';
		const a = keyAction(e, level.kind, onSlider);
		if (!a) return;
		// Also stops a focused button's own Space activation, which would toggle twice.
		e.preventDefault();
		act(a);
		wake();
	}

	/* ---------- layout ---------- */

	/**
	 * portrait: everything below the video. overlay: a landscape phone, the
	 * video fills the screen and the controls float over it. panel: a landscape
	 * phone with the editor or the list beside the video. desktop: video,
	 * sidebar, keys.
	 */
	/** `levelOf` skips sheets, so this is never 'sheet'; it only narrows the type for chrome.ts. */
	const chromeLevel = $derived(level.kind === 'sheet' ? 'full' : level.kind);
	const mode = $derived(playerMode(layout, chromeLevel, sheet === 'list'));
	/** A phone, either way up: a section view carries ‹ Full video and Edit in its top bar. */
	const phone = $derived(mode === 'portrait' || mode === 'overlay');
	const portraitPart = $derived(
		portraitBody(chromeLevel, {
			listOpen: sheet === 'list',
			hidden,
			spot: openSpot !== null,
			simple
		})
	);

	/* Floating controls fade after 3 s of playing; a tap brings them back. */
	let shown = $state(true);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	function wake() {
		shown = true;
		clearTimeout(hideTimer);
		if (mode === 'overlay' && !paused) hideTimer = setTimeout(() => (shown = false), 3000);
	}
	$effect(() => {
		void paused;
		void mode;
		untrack(wake);
		return () => clearTimeout(hideTimer);
	});
	const faded = $derived(mode === 'overlay' && !shown);

	/** The desktop's key legend; `?` opens the full list. */
	const LEGEND = $derived<[string, string][]>([
		['Space', w.legend.play],
		['← →', w.secs(1)],
		[', .', w.secs(0.1)],
		['I O', w.legend.edges],
		['[ ]', w.legend.jump],
		['M', w.legend.mark],
		['S', w.legend.section],
		['L', w.legend.loop],
		['?', w.legend.all]
	]);
	/** A reader has no mark, section or edge keys. */
	const legend = $derived(
		simple
			? LEGEND.filter(([k]) => k === 'Space' || k === '← →')
			: canEdit
				? LEGEND
				: LEGEND.filter(([k]) => k !== 'M' && k !== 'S' && k !== 'I O')
	);

	/** A tap on the picture: brings faded controls back, else plays or pauses. */
	function tapVideo() {
		if (faded) wake();
		else toggle();
	}

	const badge = $derived(cornerBadge(rate, mirror));
	let waiting = $state(false);
	const loopProgress = $derived(
		loop && loop.endMs !== null
			? Math.max(0, Math.min(100, ((currentMs - loop.startMs) / (loop.endMs - loop.startMs)) * 100))
			: 0
	);
</script>

<!-- Keys on the window, not the dialog: a level change removes the focused
     button and focus falls to the body, outside the dialog. -->
<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} {onkeydown} />

{#snippet editor(spot: Spot, keys: boolean, transport: boolean)}
	<SpotEditor
		{spot}
		{selected}
		{currentMs}
		durationS={duration}
		{paused}
		looping={!loopPaused}
		{transport}
		{keys}
		onselect={selectEdge}
		onmove={(times, how, edge) => moved(spot, times, how, edge)}
		ondragstart={(edge) => {
			selected = edge;
			playedBeforeDrag = !video.paused;
			video.pause();
		}}
		ondragend={dragged}
		onseek={seek}
		onloop={() => (loopPaused = !loopPaused)}
		onrename={() => openSheet('rename')}
		ondelete={() => openSheet('delete')}
		onlink={linking ? () => openLink(spot.id) : undefined}
		ondone={done}
		ontoggle={toggle}
		ontenth={tenth}
	/>
{/snippet}

<!-- The loop's name, and what it links to: a column on the picture, a row above the landscape timeline. -->
{#snippet loopBadges(spot: Spot, row: boolean, link: boolean)}
	{@const entry = linkEntry(spot.linkedTo, linking, 'badge')}
	<div class={row ? 'mb-1 flex gap-1.5' : 'flex flex-col items-start gap-1.5'}>
		<span class="{ON_VIDEO} pointer-events-none font-bold text-white/92">
			<span class="flex text-accent"><UiIcon name="repeat" size={15} /></span>
			<span class="max-w-[60vw] truncate">{spotLabel(spot)}</span>
		</span>
		{#if link && entry.kind === 'open'}
			<!-- The 30 px pill sits in a 44 px button; the negative margin keeps the row's height. -->
			<button
				type="button"
				class="-my-[7px] grid h-11 cursor-pointer place-items-center"
				aria-label={entry.label}
				onclick={() => openLink(spot.id)}
			>
				<span
					class="{entry.invite ? INVITE : ON_VIDEO} {entry.invite
						? 'font-extrabold text-accent-text'
						: 'font-bold text-white/92'}"
				>
					<span class="flex {entry.invite ? '' : 'text-white/80'}"
						><UiIcon name="link" size={14} /></span
					>{entry.text}
				</span>
			</button>
		{:else if link && entry.kind === 'show'}
			<span class="{ON_VIDEO} pointer-events-none font-bold text-white/92">
				<span class="flex text-white/80"><UiIcon name="link" size={14} /></span>{entry.text}
			</span>
		{/if}
	</div>
{/snippet}

{#snippet editorCard(spot: Spot)}
	<div class="flex flex-col rounded-2xl border border-hairline bg-surface">
		{@render editor(spot, true, false)}
	</div>
{/snippet}

{#snippet clock()}
	<span class="text-[15px] font-extrabold tabular-nums">{preciseTime(currentMs)}</span>
{/snippet}

{#snippet fullTimeline(glass: boolean)}
	<Timeline
		fromMs={0}
		toMs={durationMs || 1}
		{currentMs}
		bands={simple ? [] : listSpots.map((s) => ({ ...s, active: false }))}
		pending={pendingStart === null ? null : { startMs: pendingStart }}
		{glass}
		onseek={seek}
	/>
{/snippet}

{#snippet markButtons(overlay: boolean, iconOnly = false)}
	{#if canEdit}{@render markPair(overlay, iconOnly)}{/if}
{/snippet}

{#snippet markPair(overlay: boolean, iconOnly: boolean)}
	<!-- iconOnly: a square 44 px button in place of the labelled pill (narrow landscape). -->
	{@const markClass = overlay
		? iconOnly
			? MARK_GLASS_SQUARE
			: MARK_GLASS
		: iconOnly
			? MARK_DESK_SQUARE
			: MARK_DESK}
	<button type="button" class={markClass} aria-label={w.markPoint} onclick={mark}>
		<UiIcon name="flag" size={18} />{#if !iconOnly}{w.mark}{/if}
	</button>
	<button
		type="button"
		class={pendingStart !== null ? SECTION_ON_DESK : markClass}
		aria-label={pendingStart === null ? w.startSection : w.endSection}
		onclick={section}
	>
		<UiIcon name="scissors" size={18} />{#if pendingStart !== null}{@const marked = lengthText(
				Math.max(0, currentMs - pendingStart)
			)}{iconOnly ? marked : w.endShort(marked)}{:else if !iconOnly}{w.section}{/if}
	</button>
{/snippet}

{#snippet sectionRow(activeId: number | null)}
	<SectionRow
		spots={listSpots}
		{activeId}
		{loadFailed}
		onopen={fromList}
		onall={() => openSheet('list')}
	/>
{/snippet}

{#snippet slimBar(spot: Spot | null)}
	<div class="flex flex-col bg-ground px-4 pt-1 pb-[max(var(--safe-bottom),22px)]">
		<div class="px-1">
			{#if spot}
				<Timeline
					fromMs={spot.startMs}
					toMs={spot.endMs ?? spot.startMs}
					{currentMs}
					accentFill
					onseek={seek}
				/>
			{:else}
				{@render fullTimeline(false)}
			{/if}
		</div>
		<div class="-mx-1 flex items-center">
			{#if simple}
				<span class="w-[92px]"></span>
			{:else}
				<button type="button" class={HIDE} onclick={() => setHidden(false)}>
					<UiIcon name="chevron-up" size={18} />{w.show}
				</button>
			{/if}
			<span class="flex-1"></span>
			<Transport
				{paused}
				size="compact"
				steps={simple ? 'five' : 'fine'}
				ontoggle={toggle}
				onstep={nudge}
				ontenth={tenth}
				onfive={five}
			/>
			<span class="flex-1"></span>
			<span class="w-[92px] text-right text-[15px] font-extrabold tabular-nums"
				>{spot ? sectionProgress(spot, currentMs) : preciseTime(currentMs)}</span
			>
		</div>
	</div>
{/snippet}

{#snippet keyLegend()}
	<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pt-1 pb-3 text-[12px] text-muted">
		{#each legend as [k, what] (k)}
			<span><kbd class={KBD}>{k}</kbd> {what}</span>
		{/each}
	</div>
{/snippet}

<dialog
	bind:this={dialog}
	aria-label={w.player}
	class="player theme-media"
	data-layout={layout}
	oncancel={(e) => {
		// Esc, and Android Chrome's back on a modal dialog: up one level. Chrome
		// makes a cancel uncancellable after a run of Escapes with no tap between
		// (the Link popup's levels take some of them); the close that follows it
		// takes the step below, so taking it here too would go up two levels.
		if (!e.cancelable) return;
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
>
	<!-- A mouse move only brings faded controls back; the keys have their own handler. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={stage}
		class="stage relative h-full w-full overflow-hidden bg-ground text-ink {mode}"
		class:simple
		onpointermove={(e) => {
			if (mode === 'overlay' && e.pointerType === 'mouse') wake();
		}}
	>
		<!-- 1. the top bar -->
		<div
			class="area-top fade {mode === 'overlay'
				? 'absolute inset-x-0 top-0 z-20 bg-linear-to-b from-black/60 to-transparent px-11 pt-2.5 pb-[30px] text-white'
				: ''}"
			class:faded
		>
			<TopBar
				{title}
				{subtitle}
				{mirror}
				{rate}
				{muted}
				parts={topBar(mode, chromeLevel, { simple })}
				place={mode === 'overlay' ? 'overlay' : mode === 'panel' ? 'panel' : undefined}
				spotsCount={spots.length}
				repeat={repeat || simpleLoop !== null}
				repeatLocked={simpleLoop !== null}
				onspots={mode === 'overlay' && level.kind === 'full' && !simple
					? () => openSheet('list')
					: undefined}
				onback={phone && level.kind === 'section' ? () => nav.up() : undefined}
				onedit={canEdit && phone && level.kind === 'section'
					? () => openSpot && toEdit(openSpot)
					: undefined}
				onclose={() => nav.close()}
				{onchoose}
			/>
		</div>

		<!-- 2. the video: one element in every layout, so rotating never reloads it -->
		<div
			class="area-video overflow-hidden bg-black {mode === 'portrait'
				? 'relative min-h-[120px] w-full flex-1'
				: mode === 'overlay'
					? 'absolute inset-0'
					: 'relative min-h-0 min-w-0'}"
		>
			<!-- Zoom on a wrapper, mirror on the video: the two transforms compose. -->
			<div class="absolute inset-0 origin-center" style:transform={zoomTransform(view)}>
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
					onwaiting={() => (waiting = buffering(waiting, 'waiting'))}
					onplaying={() => (waiting = buffering(waiting, 'playing'))}
					oncanplay={() => (waiting = buffering(waiting, 'canplay'))}
					onseeked={() => (waiting = buffering(waiting, 'seeked'))}
					onpause={() => (waiting = buffering(waiting, 'pause'))}
					onerror={() => (waiting = buffering(waiting, 'error'))}
					onemptied={() => (waiting = buffering(waiting, 'emptied'))}
				></video>
			</div>
			<VideoGestures
				bind:view
				natural={{ w: naturalW, h: naturalH }}
				label={faded ? w.showControls : paused ? w.play : w.pause}
				onsingle={tapVideo}
				onjump={(side) => nudge(side === 'left' ? -1 : 1)}
			>
				{#if waiting && !faded}
					<span
						class="grid size-16 place-items-center rounded-full bg-black/55 text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.35)]"
						><span class="text-white"><Spinner size={30} label={w.loadingVideo} /></span></span
					>
				{:else if paused && !faded}
					<span
						class="grid size-16 place-items-center rounded-full bg-black/55 text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.35)]"
					>
						<span class="ml-[3px] flex"><UiIcon name="play" filled size={30} /></span>
					</span>
				{/if}
			</VideoGestures>
			{#if view.scale > 1}
				<span
					class="absolute right-2.5 z-10 flex h-9 items-center gap-0.5 rounded-full bg-black/75 pl-3 text-[13px] font-bold text-white/92 {mode ===
					'overlay'
						? 'top-16'
						: badge
							? 'top-[46px]'
							: 'top-2.5'}"
				>
					<span class="text-white/80"><UiIcon name="search" size={15} /></span>
					<span class="ml-1">{w.zoom(Math.round(view.scale * 10) / 10)}</span>
					<button
						type="button"
						class="-my-1 h-11 cursor-pointer pr-3.5 pl-2.5 text-[13px] font-extrabold text-accent-text"
						onclick={() => (view = NO_ZOOM)}>{w.resetZoom}</button
					>
				</span>
			{/if}
			{#if badge && mode !== 'overlay'}
				<span
					class="{ON_VIDEO} pointer-events-none absolute top-2.5 right-2.5 font-bold text-white/92"
					>{badge}</span
				>
			{/if}
			{#if loop && mode !== 'overlay' && !simple}
				<div class="absolute top-2.5 left-2.5 z-10">
					{@render loopBadges(loop, false, level.kind === 'section')}
				</div>
			{/if}
			{#if loop}
				<span
					class="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-accent"
					style:width="{loopProgress}%"
				></span>
			{/if}
			{#if toast && toastPlace(mode, chromeLevel, toast.tone) === 'video'}
				<div class="absolute inset-x-4 bottom-3 z-30 mx-auto max-w-md">
					<Toast
						id={toast.id}
						text={toast.text}
						tone={toast.tone}
						actions={toast.actions}
						ondismiss={dropToast}
						onhold={holdToast}
					/>
				</div>
			{/if}
		</div>

		<!-- 3. under the video (or over it, in overlay) -->
		{#if mode === 'portrait'}
			<!-- Sized first: the video takes what is left, never under 120 px. -->
			<div
				class="area-below flex shrink-0 flex-col overflow-y-auto"
				style:max-height="calc(100dvh - 176px)"
			>
				{#if portraitPart === 'list'}
					<section
						aria-label={w.spots}
						class="flex max-h-[50dvh] min-h-0 flex-col gap-2 rounded-t-[28px] bg-sheet px-4 pt-2 pb-[max(var(--safe-bottom),22px)]"
					>
						<SpotList
							variant="sheet"
							spots={listSpots}
							activeId={null}
							{loadFailed}
							onopen={fromList}
							onedit={canEdit ? toEdit : undefined}
							onclose={() => nav.up()}
						/>
					</section>
				{:else if portraitPart === 'editor' && openSpot}
					{@render editor(openSpot, false, true)}
				{:else if portraitPart === 'slim'}
					{@render slimBar(level.kind === 'section' ? openSpot : null)}
				{:else if portraitPart === 'section' && openSpot}
					<SectionView
						spot={openSpot}
						{currentMs}
						{paused}
						variant="panel"
						onfull={() => nav.up()}
						onseek={seek}
						ontoggle={toggle}
						onstep={nudge}
						ontenth={tenth}
						onhide={() => setHidden(true)}
					>
						{#snippet row()}
							{@render sectionRow(openSpot?.id ?? null)}
						{/snippet}
					</SectionView>
				{:else}
					<div class="flex flex-col gap-1.5 bg-ground pt-1.5 pb-[max(var(--safe-bottom),22px)]">
						<div class="flex items-center pr-2 pl-5">
							<span class="flex items-baseline gap-2">
								<span
									class="font-display text-[26px] font-extrabold tracking-[-0.01em] tabular-nums"
									>{preciseTime(currentMs)}</span
								>
								<span class="text-[14px] font-semibold text-muted tabular-nums"
									>/ {durationMs ? preciseTime(durationMs) : '–'}</span
								>
							</span>
							<span class="flex-1"></span>
							<button type="button" class={HIDE} onclick={() => setHidden(true)}>
								{w.hide}<UiIcon name="chevron-down" size={18} />
							</button>
						</div>
						<div class="px-5">{@render fullTimeline(false)}</div>
						<div class="px-4 pt-0.5 pb-1">
							<Transport {paused} ontoggle={toggle} onstep={nudge} ontenth={tenth} />
						</div>
						{#if canEdit}
							<div class="flex gap-2 px-4 pt-0.5 pb-1.5">
								<button type="button" class={MARK_FILL} onclick={mark}>
									<UiIcon name="flag" size={20} />{w.markPoint}
								</button>
								<button
									type="button"
									class={pendingStart === null ? MARK_WIDE : SECTION_WIDE}
									onclick={section}
								>
									<UiIcon name="scissors" size={20} />{pendingStart === null
										? w.startSection
										: w.endSectionAt(lengthText(Math.max(0, currentMs - pendingStart)))}
								</button>
							</div>
						{/if}
						{@render sectionRow(null)}
					</div>
				{/if}
			</div>
		{:else if mode === 'overlay'}
			<div
				class="area-below fade absolute inset-x-0 bottom-0 z-20 bg-linear-to-b from-transparent to-black/72 px-12 pt-10 pb-3.5 text-white"
				class:faded
			>
				{#if level.kind === 'section' && openSpot}
					<SectionView
						spot={openSpot}
						{currentMs}
						{paused}
						variant="overlay"
						onfull={() => nav.up()}
						onseek={seek}
						ontoggle={toggle}
						onstep={nudge}
						ontenth={tenth}
					>
						{#snippet badges()}
							{@render loopBadges(openSpot!, true, true)}
						{/snippet}
					</SectionView>
				{:else}
					<div class="flex flex-col">
						{@render fullTimeline(true)}
						<div class="mt-0.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
							<span class="flex min-w-0 items-baseline gap-2">
								<span class="font-display text-[20px] font-extrabold tabular-nums"
									>{preciseTime(currentMs)}</span
								>
								{#if vw >= 760}
									<span class="text-[14px] font-semibold text-white/85 tabular-nums"
										>/ {durationMs ? preciseTime(durationMs) : '–'}</span
									>
								{/if}
							</span>
							<Transport
								{paused}
								size="float"
								glass
								steps={simple ? 'five' : 'fine'}
								ontoggle={toggle}
								onstep={nudge}
								ontenth={tenth}
								onfive={five}
							/>
							<span class="flex min-w-0 justify-end gap-1.5"
								>{@render markButtons(true, vw < 760)}</span
							>
						</div>
					</div>
				{/if}
			</div>
		{:else if mode === 'panel'}
			<div class="area-below flex h-[60px] items-center gap-2 pr-3 pl-11">
				{@render clock()}
				<span class="flex-1"></span>
				<Transport
					{paused}
					size={level.kind === 'edit' ? 'compact' : 'float'}
					ontoggle={toggle}
					onstep={nudge}
					ontenth={tenth}
				/>
			</div>
		{:else}
			<div class="area-below flex flex-col">
				{#if (level.kind === 'section' || level.kind === 'edit') && openSpot}
					<SectionView
						spot={openSpot}
						{currentMs}
						{paused}
						variant="bar"
						onfull={() => nav.jump([FULL])}
						onseek={seek}
						ontoggle={toggle}
						onstep={nudge}
						ontenth={tenth}
					/>
				{:else}
					<div class="px-4 pt-3">{@render fullTimeline(false)}</div>
					<div class="flex items-center gap-2 px-4 py-2">
						{@render clock()}
						<span class="text-[12px] text-muted tabular-nums"
							>/ {durationMs ? preciseTime(durationMs) : '–'}</span
						>
						<span class="flex-1"></span>
						<Transport
							{paused}
							steps={simple ? 'five' : 'fine'}
							ontoggle={toggle}
							onstep={nudge}
							ontenth={tenth}
							onfive={five}
						/>
						<span class="flex-1"></span>
						{@render markButtons(false)}
					</div>
				{/if}
				{@render keyLegend()}
			</div>
		{/if}

		<!-- 4. beside the video -->
		{#if mode === 'panel'}
			<div
				class="area-side flex min-h-0 flex-col border-l border-surface bg-ground pr-[var(--safe-right)]"
			>
				{#if sheet === 'list'}
					<SpotList
						variant="panel"
						spots={listSpots}
						activeId={null}
						{loadFailed}
						onopen={fromList}
						onedit={canEdit ? toEdit : undefined}
						onclose={() => nav.up()}
					/>
				{:else if level.kind === 'edit' && openSpot}
					{@render editor(openSpot, false, false)}
				{/if}
			</div>
		{:else if mode === 'desktop' && !simple}
			<div class="area-side flex min-h-0 flex-col border-l border-surface">
				<SpotList
					spots={listSpots}
					activeId={openSpot?.id ?? null}
					{loadFailed}
					variant="sidebar"
					onopen={fromList}
					onedit={canEdit ? toEdit : undefined}
					expanded={level.kind === 'edit' ? editorCard : undefined}
				/>
			</div>
		{/if}

		{#if toast && toastPlace(mode, chromeLevel, toast.tone) === 'bottom'}
			<div class="absolute inset-x-4 z-30 mx-auto max-w-md" style:bottom="20px">
				<Toast
					id={toast.id}
					text={toast.text}
					tone={toast.tone}
					actions={toast.actions}
					ondismiss={dropToast}
					onhold={holdToast}
				/>
			</div>
		{/if}

		{#if linkOpen && linkSpotId !== null}
			<!-- Keyed: "Use this moment as a point" moves the popup onto a new spot, which loads its own options. -->
			{#key linkSpotId}
				<LinkPopup
					spotId={linkSpotId}
					theme="dark"
					steps={linkSteps}
					onpush={linkPush}
					onback={() => nav.up()}
					onchange={linkedChanged}
					onclose={closeLink}
					onopen={openLinked}
					onmoment={useMoment}
					point={linkPoint}
				/>
			{/key}
		{:else if sheet && sheet !== 'list'}
			<PlayerSheet
				kind={sheet}
				spot={openSpot}
				message={sheetMessage}
				oncancel={() => nav.up()}
				onrename={relabel}
				ondelete={remove}
			/>
		{/if}
		<!-- Above every other layer: an edit someone else's save refused. Closing keeps theirs. -->
		<ClashSheet layer ask={clash} onclose={() => clash?.theirs()} />
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
		/* Clear of the status bar: in the Android app the page runs under it. */
		padding: var(--safe-top) 0 0;
		border: 0;
		background: var(--color-ground);
	}
	.player::backdrop {
		background: black;
	}
	/* Learn it facing the teacher, as in a studio mirror. */
	.mirror {
		transform: scaleX(-1);
	}

	/*
	 * The four areas — top bar, video, below, side — keep one order in the DOM
	 * in every layout, so a rotation re-arranges them instead of remounting the
	 * video.
	 */
	.stage.portrait {
		display: flex;
		flex-direction: column;
	}
	.stage.panel,
	.stage.desktop {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
	}
	.stage.panel {
		grid-template-columns: minmax(0, 1fr) minmax(300px, 44%);
	}
	.stage.desktop {
		grid-template-columns: minmax(0, 1fr) 400px;
	}
	.stage.panel > .area-top,
	.stage.panel > .area-video,
	.stage.panel > .area-below,
	.stage.desktop > .area-video,
	.stage.desktop > .area-below {
		grid-column: 1;
	}
	.stage.panel > .area-side {
		grid-column: 2;
		grid-row: 1 / span 3;
	}
	.stage.desktop > .area-top {
		grid-column: 1 / span 2;
	}
	/* The simple player has no side column. */
	.stage.desktop.simple {
		grid-template-columns: minmax(0, 1fr);
	}
	.stage.desktop.simple > .area-top {
		grid-column: 1;
	}
	.stage.desktop > .area-side {
		grid-column: 2;
		grid-row: 2 / span 2;
	}

	.fade {
		transition: opacity 200ms;
	}
	.faded {
		opacity: 0;
	}
	.faded,
	.faded :global(*) {
		pointer-events: none;
	}
</style>
