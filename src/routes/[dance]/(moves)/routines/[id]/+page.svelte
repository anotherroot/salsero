<script lang="ts">
	import { withView } from '$lib/teams/group-view';
	import { page } from '$app/state';
	import MusicSection from '$lib/components/songs/MusicSection.svelte';
	import { practiseHref as musicHref } from '$lib/songs/music';
	import { leaveRemoved } from '$lib/nav/trail.svelte';
	import { claimBottom } from '$lib/nav/chrome.svelte';
	import { keepInPlace } from '$lib/motion/anchor';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import { routinePractiseHref } from '$lib/player/view';
	import { tick, untrack } from 'svelte';
	import { entryState, sheetStack } from '$lib/sheets/history.svelte';
	import { t } from '$lib/i18n/catalog';
	import { focusKeyed, focusAfterRemoval } from '$lib/focus';
	import { afterNavigate, pushState } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import HeroCard from '$lib/components/ui/HeroCard.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { groupSlotNotes } from '$lib/clones/view';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, GROUP, LABEL, SECTION_LABEL, TEXTAREA, button } from '$lib/components/ui/styles';
	import SlotList from '$lib/components/routines/SlotList.svelte';
	import SlotPicker from '$lib/components/routines/SlotPicker.svelte';
	import SelectionBar from '$lib/components/routines/SelectionBar.svelte';
	import CardToolbar from '$lib/components/routines/CardToolbar.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { act, type Field } from '$lib/act';
	import { restoreArchived, type ArchivedTarget } from '$lib/teams/restore-api';
	import type { PickFrom, RowView, Swiped, ToolItem } from '$lib/components/routines/types';
	import {
		anchorAfter,
		anchorBefore,
		anchorBetween,
		canBridge,
		preselect,
		type Anchor,
		type Candidate
	} from '$lib/routines/fit';
	import { startOn } from '$lib/graph/timing';
	import LengthSheet from '$lib/components/routines/LengthSheet.svelte';
	import EndSheet from '$lib/components/routines/EndSheet.svelte';
	import { actionBlocks, extractBlock, inOrder, selectionShape } from '$lib/routines/selection';
	import { moved } from '$lib/gestures/drag';
	import { longPress } from '$lib/longpress';
	import {
		bandCompact,
		danceable as hasCounts,
		factBadges,
		factsOf,
		makeRoutineCaption,
		failurePlace,
		fingerprintToSend,
		seamLabel,
		selectionTitle,
		slotMeta,
		alternativeAnchor,
		type OwnSend
	} from '$lib/routines/page';
	import type { RowEdges } from '$lib/routines/routines';
	import { longDayLabel } from '$lib/format';
	import type { IconName } from '$lib/icons/icons';
	import MakeMineSheet from '$lib/components/clones/MakeMineSheet.svelte';
	import Versions from '$lib/components/clones/Versions.svelte';
	import ItemMenu from '$lib/components/clones/ItemMenu.svelte';
	import { hasMenu, type CloneOffers } from '$lib/clones/menu';
	import { menuLabel } from '$lib/menu';
	import type { MenuItem } from '$lib/menu';
	import { cloneSubtitle } from '$lib/clones/view';
	import type { ActionData, PageData, SubmitFunction } from './$types';
	// The page's group view (`?in=`, or its row's): links to the lists keep it.
	const viewTeam = $derived(page.data.groupMode?.teamId ?? null);

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	/** The Save in the pinned bar is posting. */
	let saving = $state(false);
	/** The Archive question is open. */
	let archiving = $state(false);
	/** Archive is posting. */
	let archivingNow = $state(false);
	/** The slot tapped open, by id. One at a time. */
	let expanded = $state<number | null>(null);
	let selecting = $state(false);
	/** A reader's Edit: the Make it mine sheet (ruling 1). */
	let makingMine = $state(false);
	/** Selected slot ids, in tap order. */
	let selected = $state<number[]>([]);
	let swiped = $state<Swiped>(null);
	let dragging = $state(false);
	let flash = $state<number | null>(null);
	let naming = $state(false);
	/** Make routine is posting. */
	let making = $state(false);
	/** The band's ⋯ sheet. */
	let menuOpen = $state(false);
	/** The routine's own ⋯ item: Select slots, the way into selection without a long-press. */
	const routineOwn = $derived<MenuItem[]>(
		data.canEdit && data.slots.length > 0
			? [
					{
						key: 'select',
						icon: 'check-circle',
						label: t().routine.selection.item,
						meta: t().routine.selection.itemMeta,
						onclick: () => {
							selecting = true;
							selected = [];
							expanded = null;
							swiped = null;
							void focusBand('stop-selecting');
						}
					}
				]
			: []
	);
	let editForm = $state<HTMLFormElement>();
	/**
	 * The `form` whose page banner was dismissed. Raw, not a deep proxy, so it
	 * stays the same object as `form`: the next refusal is a new object, and
	 * its banner shows.
	 */
	let dismissed = $state.raw<ActionData | null>(null);
	let picker = $state<{
		title: string;
		anchor: Anchor;
		insertAt: number | null;
		stepId: number | null;
	} | null>(null);
	/**
	 * How long? (spec 2026-11-11): open for a figure whose length the routine
	 * sets, after it is picked or from a slot's length chip. `onpick` sends.
	 */
	let howLong = $state<{
		figure: string;
		start: number;
		want: number | null;
		current: number | null;
		pre: number | null;
		onpick: (n: number) => void;
	} | null>(null);
	/** Where does it end? (spec 2026-11-11, slot end): the slot it is open for. */
	let endFor = $state<number | null>(null);
	let toast = $state<{ id: number; message: string; undo: () => void } | null>(null);
	let toastSeq = 0;
	/** The selection bar's height: the Undo toast sits above it while selecting. */
	let barHeight = $state(0);

	/*
	 * Optimistic overlays, cleared when their action returns — by which time
	 * `act` has re-run the load, so the server's state takes over. While any is
	 * in flight a seam shows only where it still holds for the slots on screen
	 * (`seamOf`): the seams were computed for the server's order.
	 */
	let order = $state<number[] | null>(null);
	let gone = $state<number[]>([]);
	let goneOptions = $state<string[]>([]);

	const routine = $derived(data.routine);
	/**
	 * Where the last refusal shows: under the slot it was aimed at (on a long
	 * routine a banner at the top is off-screen), under its field, or in a
	 * banner — a slot id that names no slot here included.
	 */
	const place = $derived(
		failurePlace(
			form,
			data.slots.map((s) => s.id)
		)
	);
	/** A pick refused because it was archived since: its target, and whether Restore is offered. */
	const archivedForm = $derived.by(() => {
		if (!form || dismissed === form || !('archived' in form)) return null;
		const a = form.archived as { restorable?: boolean; target?: ArchivedTarget } | undefined;
		return a?.target ? { restorable: a.restorable === true, target: a.target } : null;
	});
	/** The routine-level refusal, until it is dismissed. */
	const bannerMessage = $derived(
		place?.where === 'banner' && dismissed !== form && !archivedForm ? place.message : null
	);

	/** The Edit form's refusals, each under its own field. */
	const nameFieldError = $derived(
		place?.where === 'edit' && place.field === 'name' && dismissed !== form ? place.message : null
	);
	const notesFieldError = $derived(
		place?.where === 'edit' && place.field === 'notes' && dismissed !== form ? place.message : null
	);
	/** What was typed into the Edit form before a refused Save, so it is not lost. */
	function typed(key: 'name' | 'notes'): string | undefined {
		return place?.where === 'edit' &&
			dismissed !== form &&
			form &&
			key in form &&
			typeof form[key] === 'string'
			? form[key]
			: undefined;
	}

	/**
	 * The band button that was focused is replaced when the band flips, so hand
	 * focus to its successor. The page has a big header and a slim band, each
	 * with the button; one is inert.
	 */
	async function focusBand(key: string) {
		await tick();
		focusKeyed(key);
	}
	function startEditing() {
		// A refusal or typed value from an earlier edit is stale now.
		dismissed = form;
		editing = true;
		window.scrollTo({ top: 0 });
		focusBand('stop-editing');
	}
	function stopEditing() {
		dismissed = form;
		editing = false;
		focusBand('edit');
	}

	/*
	 * Another routine reuses this component: nothing open, selected or pending
	 * here may carry over — above all the Undo toast, whose restore would post
	 * to the new routine's URL.
	 */
	afterNavigate(({ from, to }) => {
		if (from?.params?.id === to?.params?.id) return;
		toast = null;
		selecting = false;
		selected = [];
		expanded = null;
		swiped = null;
		picker = null;
		naming = false;
		menuOpen = false;
		editing = false;
		archiving = false;
		dismissed = null;
	});

	/** The Make routine sheet's refusal about its Name field. */
	const nameError = $derived(
		place?.where === 'extract' && place.field === 'name' && dismissed !== form
			? place.message
			: null
	);

	const positionNames = $derived(new Map(data.positions.map((p) => [p.id, p.name])));
	/** A position's name from the graph; an unknown id names nothing. */
	const posName = (id: number) => positionNames.get(id) ?? '';
	const posNames = (ids: number[]) => ids.map(posName).filter(Boolean);
	/** Live figures and variations, by id. A slot's figure missing here is archived. */
	const figuresById = $derived(
		new Map(data.candidates.filter((c) => c.kind === 'figure').map((c) => [c.id, c]))
	);

	const figureHref = (id: number) =>
		resolve('/[dance]/(moves)/figures/[id]', { dance: data.dance.slug, id: String(id) });
	const routineHref = (id: number) =>
		resolve('/[dance]/(moves)/routines/[id]', { dance: data.dance.slug, id: String(id) });

	/** The group a figure belongs to, when it is a group's and the person may still use it. */
	/** Opened from the person's copy (`?vs=`): the place this page is, for the note under the tabs. */
	const sourcePlace = $derived(
		data.vs !== null && data.cloneLine.self.kind === 'team' ? data.cloneLine.self.name : null
	);
	const sourceOf = (id: number): string | null => data.groupFigures[id]?.team ?? null;

	/** An option's length in its slot when the routine sets it (spec 2026-11-11); null for a fixed figure. */
	function lengthIn(slot: { lengths: Record<number, number> }, id: number): number | null {
		const c = figuresById.get(id);
		if (!c?.free) return null;
		return slot.lengths[id] ?? c.length ?? null;
	}

	function optionName(id: number): string {
		const name = data.labels[id] ?? t().routine.slot.aFigure;
		return figuresById.has(id) ? name : t().routine.slot.archived(name);
	}

	/**
	 * Whether the server's seam between its rows `i` and `j` still holds with
	 * server row `i` drawn at `k`: the same rows follow it, and neither side lost
	 * an option on the way. Timing also needs every row above unchanged — where
	 * a slot leaves off depends on the whole run before it. Everything holds when
	 * nothing is in flight; a seam the change would make waits for the server.
	 */
	function holds(i: number, j: number, k: number, timing: boolean): boolean {
		if (timing && k !== i) return false;
		const server = data.slots.map((s) => s.id);
		const ids = shown.map((s) => s.slot.id);
		const lost = new Set(goneOptions.map((key) => Number(key.split(':')[0])));
		// Server rows `from…j` drawn in order, each `k - i` places from where the server has it.
		const from = timing ? 0 : i;
		for (let n = from; n <= j; n++) {
			const id = ids[k - i + n];
			if (id === undefined || id !== server[n] || lost.has(id)) return false;
		}
		return true;
	}

	/**
	 * What does not connect below server row `i`, drawn at `k`, worded; null
	 * when it connects. Shown through a drag and a selection, so the page never
	 * jumps under the finger (and the warning never blinks away).
	 */
	function seamOf(i: number, k: number): RowView['seam'] {
		const p = data.positionSeams.find((s) => s.after === i && holds(i, s.next, k, false));
		const t = data.timingSeams.find((s) => s.after === i && holds(i, s.next, k, true));
		const next = (p ?? t)?.next;
		if (next === undefined) return null;
		const a = data.edges[i];
		const b = data.edges[next];
		return {
			label: seamLabel(
				p && a.ends !== null && a.ends.length > 0
					? { ends: posNames(a.ends), next: posNames(b.starts) }
					: null,
				t ? { ready: a.next, next: b.startCounts } : null
			),
			next: k + next - i,
			bridge: canBridge(data.candidates, anchorBetween(a, b))
		};
	}

	/** The slots as shown: the server's, with any in-flight reorder or delete applied. */
	const shown = $derived.by(() => {
		const byId = new Map(data.slots.map((slot, i) => [slot.id, { slot, edges: data.edges[i], i }]));
		const ids = (order ?? data.slots.map((s) => s.id)).filter(
			(id) => !gone.includes(id) && byId.has(id)
		);
		return ids.map((id) => byId.get(id)!);
	});

	const rows: RowView[] = $derived(
		shown.map(({ slot, edges, i }, k) => {
			const isRoutine = slot.childId !== null;
			const main = slot.figureIds[0] as number | undefined;
			return {
				id: slot.id,
				source: isRoutine || main === undefined ? null : sourceOf(main),
				title: isRoutine
					? (slot.childName ?? t().routine.slot.aRoutine)
					: main === undefined
						? t().routine.slot.empty
						: optionName(main),
				meta: slotMeta(
					edges,
					posName,
					isRoutine ? (data.childSlots[slot.childId as number] ?? 0) : null,
					k === 0
				),
				end: endView(i, edges, isRoutine),
				empty: !isRoutine && main === undefined,
				note: slot.note,
				href: isRoutine
					? routineHref(slot.childId as number)
					: main === undefined
						? null
						: figureHref(main),
				isRoutine,
				alternatives: slot.figureIds
					.slice(1)
					.filter((f) => !goneOptions.includes(`${slot.id}:${f}`))
					.map((f) => ({
						id: f,
						label: optionName(f),
						href: figureHref(f),
						source: sourceOf(f),
						length: lengthIn(slot, f)
					})),
				length: (() => {
					const n = main === undefined || isRoutine ? null : lengthIn(slot, main);
					return n === null ? null : { figureId: main as number, n };
				})(),
				canAddAlternative: !isRoutine && main !== undefined && figuresById.has(main),
				failure:
					place?.where === 'slot' && place.stepId === slot.id && !archivedForm
						? place.message
						: null,
				seam: seamOf(i, k)
			};
		})
	);

	/** One note per group whose figures the slots use: what leaving the group does. */
	const groupNotes = $derived(
		groupSlotNotes(
			data.groupFigures,
			data.slots.map((s) => s.figureIds)
		)
	);

	const facts = $derived(factsOf(posNames(data.starts), posNames(data.ends)));
	const badges = $derived(
		factBadges({
			slots: data.slots.length,
			breaks: data.breaks.length,
			timingBreaks: data.timingBreaks.length,
			loops: data.loops
		})
	);
	// By its counts: an untagged routine starts anywhere and is still danced.
	const danceable = $derived(hasCounts(data.edges));

	const practiseHref = $derived(
		resolve(routinePractiseHref(data.dance.slug, routine.id, data.exerciseId))
	);

	/* ── Talking to the server ─────────────────────────────────────────── */

	/*
	 * Every slot action carries the routine's fingerprint as this page last saw
	 * it, and one aimed at a routine that changed since is refused (the clash
	 * check). They go one at a time, and one tapped while this page's own were
	 * still out follows their answers (`fingerprintToSend`), so the page never
	 * clashes with itself.
	 */
	let chain: Promise<unknown> = Promise.resolve();
	/** This page's own actions not yet answered, in the order they were sent. */
	let queued: OwnSend[] = [];
	async function send(name: string, fields: Record<string, Field>) {
		const aimed = data.fingerprint;
		const ahead = [...queued];
		const mine: OwnSend = { sent: null, after: null };
		queued.push(mine);
		const run = chain.then(async () => {
			mine.sent = fingerprintToSend(aimed, ahead);
			const result = await act(name, { ...fields, fingerprint: mine.sent });
			if (result.type === 'success' && typeof result.data?.fingerprint === 'string') {
				mine.after = result.data.fingerprint;
			}
			return result;
		});
		chain = run.catch(() => {});
		try {
			return await run;
		} finally {
			queued = queued.filter((q) => q !== mine);
		}
	}

	function showToast(message: string, undo: () => void) {
		toast = { id: ++toastSeq, message, undo };
	}

	async function reorder(id: number, to: number) {
		const ids = rows.map((r) => r.id);
		const from = ids.indexOf(id);
		if (from < 0 || to < 0 || to >= ids.length || to === from) return;
		order = moved(ids, from, to);
		await send('reorder', { stepId: id, index: to });
		order = null;
	}

	async function remove(ids: number[]) {
		const message =
			ids.length === 1
				? t().routine.slot.deleted(rows.findIndex((r) => r.id === ids[0]) + 1)
				: t().routine.slot.manyDeleted(ids.length);
		gone = [...gone, ...ids];
		swiped = null;
		if (expanded !== null && ids.includes(expanded)) expanded = null;
		const result = await send('deleteMany', { stepIds: ids });
		gone = gone.filter((id) => !ids.includes(id));
		if (result.type === 'success' && result.data?.snapshot) {
			const snapshot = JSON.stringify(result.data.snapshot);
			showToast(message, () => send('restore', { snapshot }));
		}
	}

	/**
	 * One slot's Delete: the swipe's, or the desktop's trash button. The slot
	 * leaves at once (`gone`), so a keyboard user's focus goes to the next slot,
	 * else the one before, else Add a slot.
	 */
	async function removeSlot(id: number) {
		const keys = rows.map((r) => `slot-${r.id}`);
		const done = remove([id]);
		await focusAfterRemoval(keys, `slot-${id}`, 'add-slot');
		await done;
	}

	async function removeAlternative(stepId: number, figureId: number, label: string) {
		const keys = (data.slots.find((s) => s.id === stepId)?.figureIds ?? [])
			.slice(1)
			.map((f) => `alt-${stepId}-${f}`);
		const key = `${stepId}:${figureId}`;
		// Its length in the slot comes back with it (spec 2026-11-11).
		const length = data.slots.find((s) => s.id === stepId)?.lengths[figureId] ?? '';
		goneOptions = [...goneOptions, key];
		swiped = null;
		const result = await send('removeOption', { stepId, figureId });
		goneOptions = goneOptions.filter((k) => k !== key);
		if (result.type === 'success') {
			// When it went: in a group, Undo brings back what the remove took off members' Today.
			const removedAt = typeof result.data?.removedAt === 'number' ? result.data.removedAt : '';
			showToast(t().routine.slot.removed(label), () =>
				send('restoreOption', { stepId, figureId, removedAt, length })
			);
			await focusAfterRemoval(keys, `alt-${stepId}-${figureId}`, `slot-${stepId}`);
		}
	}

	function openPicker(at: number, from: PickFrom | null) {
		const edges = from === null ? null : shown[from.row]?.edges;
		const anchor: Anchor =
			edges == null
				? { kind: 'none' }
				: from?.side === 'between'
					? (anchorBetween(edges, shown[from.next]?.edges ?? edges) ?? { kind: 'none' })
					: from?.side === 'after'
						? anchorAfter(edges)
						: anchorBefore(edges);
		const title =
			from === null
				? t().routine.slots.addFigure
				: from.side === 'between'
					? t().routine.picker.between(from.row + 1, from.next + 1)
					: from.side === 'after'
						? t().routine.picker.after(from.row + 1)
						: t().routine.picker.before(from.row + 1);
		picker = { title, anchor, insertAt: at, stepId: null };
	}

	function openAlternative(stepId: number) {
		const slot = data.slots.find((s) => s.id === stepId);
		if (!slot) return;
		const main = figuresById.get(slot.figureIds[0]);
		// The slot as the routine walks it (spec 2026-11-11), the way `addOption` judges it.
		const anchor = alternativeAnchor(stepId, data.slots, data.edges, figuresById);
		if (!main || !anchor) return;
		picker = { title: t().routine.picker.alternative(main.label), anchor, insertAt: null, stepId };
	}

	type PickerState = NonNullable<typeof picker>;
	/** The last pick sent, so "Archived by Ana" can Restore and put it in, or reopen the picker. */
	let lastPick: { p: PickerState; c: Candidate } | null = null;
	let restoring = $state(false);

	async function restoreAndPick() {
		const a = archivedForm;
		const last = lastPick;
		if (!a || restoring) return;
		restoring = true;
		const refused = await restoreArchived(a.target);
		restoring = false;
		if (refused) {
			// Stays up, saying why: "Enchufla is taken; rename that one first".
			restoreRefusal = refused;
			return;
		}
		dismissed = form;
		if (last) await put(last.p, last.c);
	}

	function pickAnother() {
		dismissed = form;
		picker = lastPick?.p ?? null;
	}
	let restoreRefusal = $state<string | null>(null);
	$effect(() => {
		if (!archivedForm) restoreRefusal = null;
	});

	async function pick(c: Candidate) {
		const p = picker;
		picker = null;
		if (!p) return;
		// A figure whose length the routine sets asks How long? first (spec 2026-11-11).
		if (c.kind === 'figure' && c.free) {
			howLong = {
				figure: c.label,
				...whereItGoes(p, c),
				current: null,
				onpick: (n) => put(p, c, n)
			};
			return;
		}
		await put(p, c);
	}

	/**
	 * Where a picked figure would start and what its length must land on: an
	 * alternative where the slot's main figure starts, going on where the slot
	 * does; a new slot where the row above leaves off, preselecting the length
	 * that lands where the row below starts.
	 */
	function whereItGoes(
		p: PickerState,
		c: Candidate
	): { start: number; want: number | null; pre: number | null } {
		if (p.anchor.kind === 'alternative') {
			return { start: p.anchor.startCount, want: p.anchor.next, pre: null };
		}
		const at = p.insertAt ?? rows.length;
		const incoming = shown[at - 1]?.edges.next ?? null;
		const start = startOn(c.startCounts, c.startCounts[0] ?? 1, incoming);
		const below = shown[at]?.edges.start ?? null;
		return { start, want: null, pre: preselect(start, below) };
	}

	/**
	 * A row's end as its card draws it (spec 2026-11-11, slot end): the state
	 * from the load, the name from the row's effective end. Null with nothing
	 * to show, and for data from before the end existed.
	 */
	function endView(i: number, edges: RowEdges, isRoutine: boolean): RowView['end'] {
		const e = data.slotEnds?.[i];
		if (!e || isRoutine || e.state === 'none') return null;
		const one = edges.ends?.length === 1 ? edges.ends[0] : null;
		const name = e.state === 'open' || one === null ? null : posName(one) || null;
		return { state: e.state, name };
	}

	/** The Where does it end? sheet's rows for the slot it is open for. */
	const endSheet = $derived.by(() => {
		if (endFor === null) return null;
		const k = shown.findIndex((s) => s.slot.id === endFor);
		const e = k === -1 ? null : data.slotEnds?.[shown[k].i];
		if (!e) return null;
		const ends = shown[k].edges.ends;
		const pressed = ends?.length === 1 ? ends[0] : null;
		return {
			figure: rows[k].title,
			n: k + 1,
			canClear: e.state === 'chosen',
			choices: e.choices.map((c) => ({
				id: c.id,
				name: posName(c.id),
				pressed: c.id === pressed,
				why: c.blockedBy === null ? null : t().routine.end.altNot(optionName(c.blockedBy)),
				warn: c.belowMisses ? t().routine.end.belowNot(k + 2) : null
			}))
		};
	});

	/** A slot option's length chip: How long? with its length lit, then save it. */
	function openLength(stepId: number, figureId: number, current: number) {
		const row = shown.find((s) => s.slot.id === stepId);
		if (!row) return;
		const c = figuresById.get(figureId);
		const start = row.edges.start ?? c?.startCounts[0] ?? 1;
		// With other options, a new length must still go on where they do.
		const want = row.slot.figureIds.length > 1 ? row.edges.next : null;
		howLong = {
			figure: optionName(figureId),
			start,
			want,
			current,
			pre: null,
			onpick: (n) => {
				if (n !== current) void send('length', { stepId, figureId, length: n });
			}
		};
	}

	async function put(p: PickerState, c: Candidate, length?: number) {
		lastPick = { p, c };
		const sized: Record<string, Field> = length === undefined ? {} : { length };
		if (p.stepId !== null) {
			await send('addOption', { stepId: p.stepId, figureId: c.id, ...sized });
			return;
		}
		const content: Record<string, Field> =
			c.kind === 'figure' ? { figureId: c.id, ...sized } : { childId: c.id };
		const result = await send('insert', { at: p.insertAt ?? rows.length, ...content });
		if (result.type === 'success' && typeof result.data?.stepId === 'number') {
			const id = result.data.stepId;
			flash = id;
			// The new slot opens expanded, as if tapped — its note field and
			// + Alternative ready. Expansion is off while selecting, so a pick made
			// from Add above / below ends selection mode first.
			if (selecting) stopSelecting();
			expanded = id;
			// The picker's opener (a seam, a slot's Add) is gone or elsewhere now.
			await tick();
			document.querySelector<HTMLElement>(`[data-slot="${id}"] [role=button]`)?.focus();
			// Where does it end? right after it (spec 2026-11-11, slot end), when the
			// figure has ends to choose and the slot below does not decide.
			if (rows.find((r) => r.id === id)?.end?.state === 'open') endFor = id;
		}
	}

	$effect(() => {
		if (flash === null) return;
		const timer = setTimeout(() => (flash = null), 1200);
		return () => clearTimeout(timer);
	});

	/* ── Selection ─────────────────────────────────────────────────────── */

	/*
	 * Nothing jumps (spec 2026-11-11, routine lift): opening, closing or
	 * selecting a slot moves what is around it — a card closing above, a tip
	 * or a toolbar coming and going, neighbours joining — so each change keeps
	 * the touched slot's card where it is on screen. The card, not its row: a
	 * run's header is drawn in its top row, above the card.
	 */
	const slotEl = (id: number | null) =>
		id === null ? null : document.querySelector(`[data-swipe="slot:${id}"]`);
	/** The slot last tapped or pressed: × leaves the selection around it. */
	let touched: number | null = null;

	const press = longPress({
		ms: 450,
		// Under the swipe's 10 px lock, so a locked swipe has always cancelled it.
		tolerancePx: 9.5,
		enabled: () => !selecting && !dragging,
		onLongPress: (id) => {
			touched = id;
			void keepInPlace(slotEl(id), () => {
				selecting = true;
				selected = [id];
				expanded = null;
				swiped = null;
			});
		}
	});

	function tap(id: number) {
		if (swiped) {
			swiped = null;
			return;
		}
		touched = id;
		void keepInPlace(slotEl(id), () => {
			if (selecting) {
				selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
				if (selected.length === 0) selecting = false;
				return;
			}
			expanded = expanded === id ? null : id;
		});
	}

	/*
	 * A press anywhere outside the open card closes it. Capture phase, so it is
	 * seen before anything under the finger handles it; a press on the open
	 * card itself — its revealed Delete or Open included — is left to the card.
	 */
	$effect(() => {
		if (!swiped) return;
		const key = swiped.key;
		const close = (e: PointerEvent) => {
			const card = document.querySelector(`[data-swipe="${key}"]`);
			if (card && e.target instanceof Node && card.contains(e.target)) return;
			swiped = null;
		};
		window.addEventListener('pointerdown', close, true);
		return () => window.removeEventListener('pointerdown', close, true);
	});

	function stopSelecting() {
		selecting = false;
		selected = [];
	}
	/** × or Escape: the band's ⋯ takes the focus the × had. */
	function leaveSelecting() {
		void keepInPlace(slotEl(touched), stopSelecting);
		focusBand('item-menu');
	}

	/*
	 * Back closes an open slot or leaves selection before it leaves the page
	 * (asked for with spec 2026-11-11, slot end). Opening either pushes one
	 * shallow entry (`routineFocus`, the entry's other values spread in, as the
	 * sheets and the video player do); closing it any other way takes that
	 * entry back off. The entry is read from history itself (`entryState`):
	 * a refresh empties `page.state` while the entry keeps its own.
	 */
	const focused = $derived(expanded !== null || selecting);
	/** This page's own Back (a close by tap), so its popstate holds the scroll too. */
	let ownBack = false;
	/** This page pushed its entry and has not taken it back: only then is a Back its own to close. */
	let pushed = false;
	/** What Back closes, run once the scroll is held (below). */
	let closeLater: (() => void) | null = null;
	$effect(() => {
		const on = focused;
		// Once the sheets' own Back moves have landed: a pick from the ⋯ sheet closes
		// it and opens a selection at once, and its Back must not take this entry.
		untrack(() =>
			sheetStack.settled(() => {
				if (on !== focused) return;
				const held = entryState().routineFocus === true;
				if (on && !held) {
					pushState('', { ...entryState(), routineFocus: true });
					pushed = true;
				} else if (!on && held) {
					pushed = false;
					ownBack = true;
					history.back();
				}
			})
		);
	});
	$effect(() => {
		void page.state;
		untrack(() => {
			if (entryState().routineFocus === true) return;
			// Not ours: a sheet's Back, or this page's entry not pushed yet.
			if (!pushed) return;
			pushed = false;
			if (!selecting && expanded === null) return;
			// Back took the entry: close what it held, the card under the finger staying put.
			closeLater = () => {
				if (selecting) leaveSelecting();
				else if (expanded !== null) {
					const id = expanded;
					void keepInPlace(slotEl(id), () => (expanded = null));
				}
			};
		});
	});
	/*
	 * A shallow Back makes SvelteKit scroll to where the page was when the entry
	 * was pushed; since then the page kept the touched card in place
	 * (`keepInPlace`), so that scroll would jump. The scroll is read before any
	 * popstate listener runs (capture runs first at the window) and put back in
	 * the next frame, after SvelteKit's; only then does Back's close run, so it
	 * measures the page where it stands.
	 */
	$effect(() => {
		const before = () => {
			const y = ownBack || (focused && pushed) ? window.scrollY : null;
			ownBack = false;
			if (y === null) return;
			requestAnimationFrame(() => {
				window.scrollTo(window.scrollX, y);
				const close = closeLater;
				closeLater = null;
				close?.();
			});
		};
		window.addEventListener('popstate', before, true);
		return () => window.removeEventListener('popstate', before, true);
	});

	const extractBlocked = $derived(extractBlock(rows, selected, data.embeddedIn));
	/** How the selection lifts: each row's piece, and the runs of neighbours (spec 2026-11-11, routine lift). */
	const shape = $derived(
		selectionShape(
			rows.map((r) => r.id),
			selected
		)
	);
	/** The selection's toolbar docks at the foot unless the selection is one run, which carries it. */
	const docked = $derived(selecting && shape.runs.length !== 1);
	// The tab bar steps aside for the whole selection, docked or not.
	claimBottom(() => selecting);

	/** The one run of neighbours the selection is, or null (apart, or none yet). */
	const run = $derived(shape.runs.length === 1 ? shape.runs[0] : null);
	const blocks = $derived(actionBlocks(selected.length, run !== null, extractBlocked));

	/**
	 * Add before the run's first slot / after its last. The selection is KEPT
	 * while the picker is open: closing it without picking leaves you where you
	 * were. Picking ends selection and opens the new slot expanded (see `pick`).
	 */
	function addAround(side: 'after' | 'before') {
		if (run === null) return;
		const i = side === 'after' ? run.to : run.from;
		openPicker(side === 'after' ? i + 1 : i, { row: i, side });
	}

	function duplicateSelected() {
		// Selection from ⋯ starts empty: nothing to post yet.
		if (selected.length === 0) return;
		const ids = inOrder(rows, selected);
		stopSelecting();
		send('duplicateMany', { stepIds: ids });
	}

	function extractSelected() {
		// A refused earlier Make routine (or rename) must not greet this one.
		dismissed = form;
		naming = true;
	}

	function deleteSelected() {
		if (selected.length === 0) return;
		const ids = inOrder(rows, selected);
		stopSelecting();
		remove(ids);
	}

	/** The toolbar at the foot of a run of selected neighbours (spec 2026-11-11, S6/S7). */
	const runTools: ToolItem[] = $derived(
		run === null
			? []
			: [
					{
						key: 'above',
						label: t().routine.seam.before(run.from + 1),
						name: t().routine.seam.addBefore(run.from + 1),
						icon: 'arrow-up',
						why: blocks.above,
						onclick: () => addAround('before')
					},
					{
						key: 'below',
						label: t().routine.seam.after(run.to + 1),
						name: t().routine.seam.addAfter(run.to + 1),
						icon: 'arrow-down',
						why: blocks.below,
						onclick: () => addAround('after')
					},
					{
						key: 'duplicate',
						label: t().routine.selection.duplicate,
						icon: 'copy',
						why: blocks.duplicate,
						onclick: duplicateSelected
					},
					{
						key: 'extract',
						label: t().routine.selection.make,
						icon: 'route',
						why: blocks.extract,
						onclick: extractSelected
					},
					{
						key: 'delete',
						label: t().common.delete,
						icon: 'trash',
						why: blocks.delete,
						danger: true,
						onclick: deleteSelected
					}
				]
	);

	/**
	 * The Make routine form's enhance callback. The form goes through
	 * `use:guarded`, so a typed name is unsaved work the sheet asks about before
	 * closing; on success the new embedded slot opens expanded like any new slot.
	 */
	const extracted: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type !== 'success') return;
			naming = false;
			stopSelecting();
			const id = result.data && 'stepId' in result.data ? result.data.stepId : undefined;
			if (typeof id === 'number') {
				flash = id;
				expanded = id;
			}
		};
	/** What the ⋯ offers of the copy actions (ItemMenu, mounted once below the page). */
	const offers = $derived<CloneOffers>({
		sync: data.keep.mode ? data.keep : null,
		drop: data.drop,
		detach: data.detach,
		copy: data.copyTo,
		sameAs: data.sameAs
	});
</script>

<svelte:head><title>{routine.name} · {data.dance.label}</title></svelte:head>

<svelte:window
	onkeydown={(e) => {
		// Not while a sheet is open: that Escape closes the sheet, not the selection.
		if (e.key === 'Escape' && selecting && !naming && !menuOpen && picker === null)
			leaveSelecting();
	}}
/>

{#snippet groupNote()}
	{#each groupNotes as note (note)}
		<p
			class="mt-2 flex items-start gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-[14px] leading-snug text-accent-text"
		>
			<span class="mt-px flex-none"><Icon name="group" size={18} /></span>
			<span>{note}</span>
		</p>
	{/each}
{/snippet}

<!-- The selection's toolbar at the foot of its run (spec 2026-11-11, S6/S7). -->
{#snippet runToolbar()}
	<CardToolbar label={t().routine.selection.bar} items={runTools} />
{/snippet}

{#snippet back()}
	{#if selecting}
		<BandButton
			focusKey="stop-selecting"
			icon="close"
			label={t().moves.coverage.stopSelecting}
			onclick={leaveSelecting}
		/>
	{:else if editing}
		<BandButton
			focusKey="stop-editing"
			icon="close"
			label={t().figure.edit.stop}
			onclick={() => leaveOrAsk(editForm ?? null, stopEditing, t().figure.edit.stop)}
		/>
	{:else}
		<BackButton
			fallback={{
				href: withView(resolve('/[dance]/(moves)/routines', { dance: data.dance.slug }), viewTeam),
				label: t().shell.backTo(t().shell.tabs.moves)
			}}
		/>
	{/if}
{/snippet}

{#snippet actions()}
	{#if data.historyHref}
		<BandButton icon="clock" label={t().figure.menu.history} href={data.historyHref} />
	{/if}
	<BandButton focusKey="edit" icon="pencil" label={t().routine.band.edit} onclick={startEditing} />
	{@render menu()}
{/snippet}

<!-- The ⋯: Select slots for an editor, then the copy actions. -->
{#snippet menu()}
	{#if hasMenu(routineOwn, offers)}
		<BandButton
			icon="more"
			label={menuLabel('routine')}
			focusKey="item-menu"
			onclick={() => (menuOpen = true)}
		/>
	{/if}
{/snippet}

<!-- A reader's Edit makes the routine theirs (ruling 1). On the desktop it is pinned at the pane's foot instead. -->
{#snippet readerActions()}
	{#if data.makeMine}
		<span class="contents desk:hidden"
			><BandButton
				icon="pencil"
				label={t().routine.band.edit}
				onclick={() => (makingMine = true)}
			/></span
		>
	{/if}
	{@render menu()}
{/snippet}

{#snippet practise()}
	<!-- The player picks the song: count only, or any of this dance's ready ones. A reader's
	     Practise is pinned at the pane's foot on the desktop, beside Edit (`heroDesk`). -->
	<HeroCard
		title={t().figure.practice.practise}
		meta={t().routine.band.practiseMeta}
		href={practiseHref}
	/>
{/snippet}

<!-- Selecting keeps the whole page, band and hero included (only the title and the band's
     buttons change), so nothing moves under the finger that pressed. -->
<Screen
	title={selecting
		? selectionTitle(selected.length)
		: editing
			? t().routine.band.editTitle
			: routine.name}
	compact={!editing && bandCompact(routine.name)}
	subtitle={editing ? undefined : (cloneSubtitle(data.cloneLine) ?? undefined)}
	left={back}
	right={selecting || editing ? undefined : data.canEdit ? actions : readerActions}
	hero={editing || !danceable ? undefined : practise}
	heroDesk={!data.makeMine}
>
	<div
		class={editing
			? 'flex flex-col gap-3.5 pt-1 pb-28'
			: `flex flex-col gap-2 ${selecting ? 'pb-36' : data.makeMine ? 'pb-4 desk:pb-28' : 'pb-4'}`}
	>
		{#if editing}
			{#if bannerMessage}
				<Banner kind="error" title={bannerMessage} ondismiss={() => (dismissed = form)} />
			{/if}
			<form
				id="edit-form"
				novalidate
				bind:this={editForm}
				method="POST"
				action="?/rename"
				class="flex flex-col gap-3.5"
				use:guarded={{
					label: t().routine.edit.label,
					submit: () => {
						saving = true;
						return async ({ update, result }) => {
							try {
								await update({ reset: false });
							} finally {
								saving = false;
							}
							if (result.type === 'success') stopEditing();
						};
					}
				}}
			>
				<!-- What this form saw: a save that saw another version is refused (the clash check). -->
				<input type="hidden" name="seen" value={JSON.stringify(data.seen)} />
				<div>
					<label class={LABEL} for="edit-name">{t().moves.routines.name}</label>
					<input
						id="edit-name"
						name="name"
						required
						maxlength="200"
						value={typed('name') ?? routine.name}
						class={FIELD}
						aria-invalid={nameFieldError ? 'true' : undefined}
						aria-describedby={nameFieldError ? 'edit-name-error' : 'edit-name-help'}
					/>
					{#if nameFieldError}
						<FieldError id="edit-name-error" message={nameFieldError} />
					{:else}
						<p id="edit-name-help" class="mt-1.5 pl-1 text-[13px] text-muted">
							{t().routine.edit.nameHelp}
						</p>
					{/if}
				</div>
				<div>
					<label class={LABEL} for="edit-notes"
						>{t().moves.routines.notes}
						<span class="font-medium text-muted">{t().routine.edit.optional}</span></label
					>
					<textarea
						id="edit-notes"
						name="notes"
						rows="4"
						maxlength="2000"
						class={TEXTAREA}
						aria-invalid={notesFieldError ? 'true' : undefined}
						aria-describedby={notesFieldError ? 'edit-notes-error' : undefined}
						>{typed('notes') ?? routine.notes ?? ''}</textarea
					>
					{#if notesFieldError}<FieldError id="edit-notes-error" message={notesFieldError} />{/if}
				</div>
			</form>

			<h2 class="{SECTION_LABEL} pt-1">{t().routine.edit.more}</h2>
			<ul class={GROUP}>
				<li>
					<!-- Not behind `use:enhance`: the action redirects to the copy, and a full
					     navigation is what makes it obvious you are now editing the copy. -->
					<form method="POST" action="?/duplicate">
						<button
							type="submit"
							class="flex min-h-16 w-full items-center gap-3 py-2 pr-3.5 pl-4 text-left"
						>
							<span class="flex-none text-accent-text"><Icon name="copy" size={22} /></span>
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-[16px] leading-tight font-bold text-ink"
									>{t().routine.edit.duplicate}</span
								>
								<span class="text-[13px] text-muted">{t().routine.edit.duplicateMeta}</span>
							</span>
							<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
						</button>
					</form>
				</li>
				<li>
					<button
						type="button"
						aria-haspopup="dialog"
						class="flex min-h-16 w-full items-center gap-3 py-2 pr-3.5 pl-4 text-left"
						onclick={() => (archiving = true)}
					>
						<span class="flex-none text-danger"><Icon name="trash" size={22} /></span>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[16px] leading-tight font-bold text-danger"
								>{t().routine.edit.archive}</span
							>
							<span class="text-[13px] text-muted">{t().routine.edit.archiveMeta}</span>
						</span>
					</button>
				</li>
			</ul>
		{:else}
			<Versions
				sources={data.sources}
				kind="routine"
				dance={data.dance.slug}
				current={routine.id}
				mineId={data.mineId}
				self={data.cloneLine.self}
				title={routine.name}
				family={data.family}
				step={data.step}
				keep={data.keep}
				taking={sourcePlace}
			/>
			{#if bannerMessage}
				<Banner kind="error" title={bannerMessage} ondismiss={() => (dismissed = form)} />
			{/if}
			{#if archivedForm && form?.message}
				<!-- "Archived by Ana": Restore and put it in, or pick another. -->
				<Banner kind="error" title={form.message} ondismiss={() => (dismissed = form)}>
					{#if restoreRefusal}{restoreRefusal}{/if}
					{#snippet action()}
						<div class="flex flex-wrap gap-1">
							{#if archivedForm.restorable}
								<button
									type="button"
									class={button('tertiary', 'sm')}
									aria-busy={restoring}
									disabled={restoring}
									onclick={restoreAndPick}
									>{#if restoring}<Spinner /><span class="sr-only"
											>{t().routine.archived.restoring}</span
										>{:else}{t().routine.archived.restore}{/if}</button
								>
							{/if}
							<button type="button" class={button('tertiary', 'sm')} onclick={pickAnother}
								>{t().routine.archived.pickAnother}</button
							>
						</div>
					{/snippet}
				</Banner>
			{/if}
			{#if routine.notes}
				<p class="px-1 text-[15px] leading-[1.45] font-medium whitespace-pre-line text-ink-2">
					{routine.notes}
				</p>
			{/if}
			<!-- With no position anywhere there is no hand fact, but the badges (loops, breaks) still show. -->
			{#if facts || badges.length > 0}
				<div class="flex flex-col gap-2 px-1 pt-0.5 pb-1">
					{#if facts}
						<p class="text-[14px] font-semibold text-ink-2">
							{#if facts.from !== null}{t().routine.facts.from}
								<b class="font-extrabold text-ink">{facts.from}</b>{#if facts.to !== null}&nbsp;· {t()
										.routine.facts.to}
									<b class="font-extrabold text-ink">{facts.to}</b>{/if}{:else}{t().routine.facts
									.endsAt} <b class="font-extrabold text-ink">{facts.to}</b>{/if}
						</p>
					{/if}
					{#if badges.length > 0}
						<div class="flex flex-wrap gap-1.5">
							{#each badges as b (b.text)}
								<Badge tone={b.tone}
									>{#if b.loop}<Icon name="repeat" size={14} />{/if}{b.text}</Badge
								>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if !data.canEdit}
				<!-- A reader sees the slots as they are: no gestures, no picker, no notes to edit. -->
				{#if rows.length === 0}
					<p class="rounded-2xl bg-surface px-4 py-3.5 text-[14px] text-muted">
						{t().routine.slots.none}
					</p>
				{:else}
					<section>
						<h2 class="{SECTION_LABEL} mb-2 pt-1.5">{t().routine.slots.title(rows.length)}</h2>
						<ol class={GROUP}>
							{#each rows as row, i (row.id)}
								<li class="flex min-h-16 items-start gap-3 py-3 pr-3.5 pl-4">
									<span
										class="w-6 flex-none pt-0.5 text-[15px] font-extrabold text-muted tabular-nums"
										>{i + 1}</span
									>
									<span class="flex min-w-0 flex-1 flex-col gap-0.5">
										{#if row.href}
											<a href={row.href} class="text-[16px] leading-tight font-bold text-ink"
												>{row.title}</a
											>
										{:else}
											<span class="text-[16px] leading-tight font-bold text-muted">{row.title}</span
											>
										{/if}
										{#if row.source}<span class="self-start"
												><Badge tone="neutral"><Icon name="group" size={14} />{row.source}</Badge
												></span
											>{/if}
										{#if row.meta}<span class="text-[13px] text-muted">{row.meta}</span>{/if}
										{#if row.alternatives.length > 0}
											<span class="text-[13px] text-ink-2"
												>{t().figure.or}
												{#each row.alternatives as a, k (a.id)}{k > 0
														? ', '
														: ''}{a.label}{#if a.source}
														<Badge tone="neutral"><Icon name="group" size={14} />{a.source}</Badge
														>{/if}{/each}</span
											>
										{/if}
										{#if row.note}<span class="text-[13px] text-ink-2 italic">{row.note}</span>{/if}
									</span>
								</li>
							{/each}
						</ol>
						{@render groupNote()}
					</section>
				{/if}
			{:else if data.slots.length === 0}
				<EmptyState
					icon="route"
					title={t().routine.slots.emptyTitle}
					body={t().routine.slots.emptyBody}
				>
					{#snippet action()}
						<button type="button" class={button('primary')} onclick={() => openPicker(0, null)}
							><Icon name="plus" size={20} />{t().routine.slots.addFigure}</button
						>
					{/snippet}
				</EmptyState>
			{:else}
				<section>
					<h2 class="{SECTION_LABEL} mb-2 pt-1.5">{t().routine.slots.title(rows.length)}</h2>
					<SlotList
						{rows}
						{expanded}
						{selecting}
						{selected}
						{shape}
						tools={selecting && run !== null ? runToolbar : undefined}
						{swiped}
						{flash}
						{press}
						onswipe={(key, side) => (swiped = side === null ? null : { key, side })}
						ontap={tap}
						ondragstart={() => {
							dragging = true;
							expanded = null;
							swiped = null;
						}}
						ondragend={() => (dragging = false)}
						onreorder={reorder}
						ondelete={removeSlot}
						onremoveAlt={removeAlternative}
						onaddAlt={openAlternative}
						onlength={openLength}
						onend={(id) => (endFor = id)}
						onnote={(id, note) => send('note', { stepId: id, note })}
						onadd={openPicker}
					/>
					{@render groupNote()}
				</section>
			{/if}

			<!-- Music (spec B): the songs to practise this routine to, each with a note. -->
			<div class="pt-3.5">
				<MusicSection
					rows={data.music}
					canEdit={data.canEdit}
					choices={data.musicChoices}
					practise={(songId) =>
						musicHref(
							data.dance.slug,
							{ routineId: data.routine.id, entryId: data.exerciseId ?? null },
							songId
						)}
				/>
			</div>

			{#if data.exerciseId !== null || data.taughtIn.length > 0}
				<h2 class="{SECTION_LABEL} pt-3.5">{t().routine.edit.more}</h2>
				<ul class={GROUP}>
					{#if data.exerciseId !== null}
						{@render moreRow(
							resolve('/[dance]/(today)/exercises/[id]', {
								dance: data.dance.slug,
								id: String(data.exerciseId)
							}),
							'repeat',
							t().routine.more.exercise,
							t().routine.more.exerciseMeta
						)}
					{/if}
					{#each data.taughtIn as lesson (lesson.id)}
						{@render moreRow(
							resolve('/[dance]/lessons/[id]', {
								dance: data.dance.slug,
								id: String(lesson.id)
							}),
							'lessons',
							lesson.title,
							t().routine.more.taughtIn(longDayLabel(lesson.lessonDay))
						)}
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
</Screen>

{#snippet moreRow(href: string, icon: IconName, title: string, meta: string)}
	<li>
		<a {href} class="flex min-h-16 items-center gap-3 py-2 pr-3.5 pl-4">
			<span class="flex-none text-accent-text"><Icon name={icon} size={24} /></span>
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="text-[16px] leading-tight font-bold text-ink">{title}</span>
				<span class="text-[13px] text-muted">{meta}</span>
			</span>
			<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
		</a>
	</li>
{/snippet}

{#if data.makeMine}
	<!-- A reader's Edit and Practise, pinned at the pane's foot on the desktop (as a group's
	     figure pins them); the phone has the band's pencil and the Practise hero. -->
	<div class="hidden desk:contents">
		<BottomBar>
			<!-- Edit as wide as its words, Practise the rest (board "A group's routine"). -->
			<div class="flex gap-2">
				<button
					type="button"
					class={button('secondary', 'md', !danceable)}
					aria-haspopup="dialog"
					onclick={() => (makingMine = true)}
					><Icon name="pencil" size={20} />{t().common.edit}</button
				>
				{#if danceable}
					<div class="min-w-0 flex-1">
						<a href={practiseHref} class={button('primary', 'md', true)}
							><Icon name="play" size={20} />{t().figure.practice.practise}</a
						>
					</div>
				{/if}
			</div>
		</BottomBar>
	</div>
{/if}

{#if editing}
	<BottomBar mode>
		<button
			type="submit"
			form="edit-form"
			class={button('primary', 'md', true)}
			aria-busy={saving}
			disabled={saving}
		>
			{#if saving}<Spinner /><span class="sr-only">{t().routine.saving}</span>{:else}{t().common
					.save}{/if}
		</button>
	</BottomBar>
{/if}

<Dialog
	open={archiving}
	icon="trash"
	tone="danger"
	title={t().routine.archive.title(routine.name)}
	body={t().routine.archive.body}
	onclose={() => (archiving = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (archiving = false)}
			>{t().common.cancel}</button
		>
		<form
			method="POST"
			action="?/archive"
			use:enhance={() => {
				archivingNow = true;
				return async ({ update, result }) => {
					if (result.type === 'redirect') {
						archiving = false;
						try {
							await leaveRemoved(result.location);
						} finally {
							archivingNow = false;
						}
						return;
					}
					await update();
					archivingNow = false;
				};
			}}
		>
			<button
				type="submit"
				class={button('danger', 'sm')}
				aria-busy={archivingNow}
				disabled={archivingNow}
			>
				{#if archivingNow}<Spinner /><span class="sr-only">{t().routine.archive.archiving}</span
					>{:else}{t().routine.archive.button}{/if}
			</button>
		</form>
	{/snippet}
</Dialog>

{#if docked}
	<SelectionBar
		bind:height={barHeight}
		{blocks}
		onabove={() => addAround('before')}
		onbelow={() => addAround('after')}
		onduplicate={duplicateSelected}
		onextract={extractSelected}
		ondelete={deleteSelected}
	/>
{/if}

<SlotPicker
	open={picker !== null}
	title={picker?.title ?? ''}
	anchor={picker?.anchor ?? { kind: 'none' }}
	candidates={data.candidates}
	positionName={posName}
	onpick={pick}
	onclose={() => (picker = null)}
/>

<LengthSheet
	open={howLong !== null}
	figure={howLong?.figure ?? ''}
	start={howLong?.start ?? 1}
	want={howLong?.want ?? null}
	current={howLong?.current ?? null}
	pre={howLong?.pre ?? null}
	onpick={(n) => {
		const h = howLong;
		howLong = null;
		h?.onpick(n);
	}}
	onclose={() => (howLong = null)}
/>

<EndSheet
	open={endSheet !== null}
	figure={endSheet?.figure ?? ''}
	slot={endSheet?.n ?? 1}
	choices={endSheet?.choices ?? []}
	canClear={endSheet?.canClear ?? false}
	onpick={(id) => {
		const stepId = endFor;
		endFor = null;
		if (stepId !== null) void send('end', { stepId, positionId: id ?? '' });
	}}
	onclose={() => (endFor = null)}
/>

<Sheet title={t().routine.make.title} open={naming} onclose={() => (naming = false)}>
	<form
		id="make-routine"
		novalidate
		method="POST"
		action="?/extract"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: t().routine.make.label,
			submit: async (input) => {
				// One routine per tap: a second tap while the first is out is dropped.
				if (making) return input.cancel();
				making = true;
				// Behind this page's own slot actions, as `send` goes: aimed at the
				// routine on screen, following their answers.
				const aimed = data.fingerprint;
				const ahead = [...queued];
				await chain;
				input.formData.set('fingerprint', fingerprintToSend(aimed, ahead));
				const done = extracted(input);
				return async (args) => {
					try {
						const run = await done;
						if (typeof run === 'function') await run(args);
					} finally {
						making = false;
					}
				};
			}
		}}
	>
		{#each inOrder(rows, selected) as id (id)}
			<input type="hidden" name="stepIds" value={id} />
		{/each}
		{#if place?.where === 'extract' && place.field === null && dismissed !== form}
			<Banner kind="error" title={place.message} />
		{/if}
		<div>
			<label class={LABEL} for="make-name">{t().moves.routines.name}</label>
			<!-- The sheet exists to type this one thing. -->
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="make-name"
				name="name"
				required
				autofocus
				maxlength="200"
				value={place?.where === 'extract' &&
				dismissed !== form &&
				form &&
				'name' in form &&
				typeof form.name === 'string'
					? form.name
					: ''}
				placeholder={t().routine.make.placeholder}
				class={FIELD}
				aria-invalid={nameError ? 'true' : undefined}
				aria-describedby={nameError ? 'make-name-error' : undefined}
			/>
			{#if nameError}<FieldError id="make-name-error" message={nameError} />{/if}
		</div>
		<p class="text-[14px] leading-[1.45] text-muted">{makeRoutineCaption(selected.length)}</p>
		<ol class="flex flex-col gap-1.5">
			{#each inOrder(rows, selected) as id (id)}
				{@const i = rows.findIndex((r) => r.id === id)}
				<li class="flex items-center gap-2.5">
					<span
						class="grid size-[26px] shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-extrabold text-accent-text tabular-nums"
						>{i + 1}</span
					>
					<span class="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink-2"
						>{rows[i].title}</span
					>
				</li>
			{/each}
		</ol>
	</form>

	{#snippet footer()}
		<button
			type="submit"
			form="make-routine"
			class={button('primary', 'md', true)}
			aria-busy={making}
			aria-label={making ? t().routine.make.making : undefined}
		>
			{#if making}<Spinner />{:else}<Icon name="route" size={20} />{t().routine.make.action}{/if}
		</button>
	{/snippet}
</Sheet>

<Toast
	toast={toast && { id: toast.id, message: toast.message, action: t().common.undo }}
	bottom={docked
		? `calc(${barHeight}px + 0.5rem)`
		: 'calc(1rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)))'}
	onaction={() => {
		const t = toast;
		toast = null;
		t?.undo();
	}}
	ondismiss={() => (toast = null)}
/>

{#if data.makeMine}
	<MakeMineSheet open={makingMine} onclose={() => (makingMine = false)} offer={data.makeMine} />
{/if}

<!-- The ⋯ menu and its sheets, once: the band (drawn twice) only holds its button. -->
<ItemMenu
	bind:open={menuOpen}
	title={routine.name}
	kind="routine"
	current={routine.id}
	own={routineOwn}
	{offers}
/>
