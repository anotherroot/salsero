<script lang="ts">
	import { leaveRemoved } from '$lib/nav/trail.svelte';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { focusKeyed, focusAfterRemoval } from '$lib/focus';
	import { afterNavigate } from '$app/navigation';
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
	import RoutineMenu from '$lib/components/routines/RoutineMenu.svelte';
	import SlotList from '$lib/components/routines/SlotList.svelte';
	import SlotPicker from '$lib/components/routines/SlotPicker.svelte';
	import SelectionBar from '$lib/components/routines/SelectionBar.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { act, type Field } from '$lib/act';
	import { restoreArchived, type ArchivedTarget } from '$lib/teams/restore-api';
	import type { PickFrom, RowView, Swiped } from '$lib/components/routines/types';
	import {
		anchorAfter,
		anchorAlternative,
		anchorBefore,
		anchorBetween,
		canBridge,
		type Anchor,
		type Candidate
	} from '$lib/routines/fit';
	import { actionBlocks, extractBlock, inOrder } from '$lib/routines/selection';
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
		type OwnSend
	} from '$lib/routines/page';
	import { longDayLabel } from '$lib/format';
	import type { IconName } from '$lib/icons/icons';
	import MakeMineSheet from '$lib/components/clones/MakeMineSheet.svelte';
	import SourceTabs from '$lib/components/clones/SourceTabs.svelte';
	import { cloneSubtitle } from '$lib/clones/view';
	import type { ActionData, PageData, SubmitFunction } from './$types';

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
	let toast = $state<{ id: number; message: string; undo: () => void } | null>(null);
	let toastSeq = 0;
	/** The selection bar's height: the Undo toast sits above it while selecting. */
	let barHeight = $state(0);

	/*
	 * Optimistic overlays, cleared when their action returns — by which time
	 * `act` has re-run the load, so the server's state takes over. While any is
	 * in flight the seams are hidden: they were computed for the order on the
	 * server, not the one on screen.
	 */
	let order = $state<number[] | null>(null);
	let gone = $state<number[]>([]);
	let goneOptions = $state<string[]>([]);
	let pending = $state(0);

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

	function optionName(id: number): string {
		const name = data.labels[id] ?? 'a figure';
		return figuresById.has(id) ? name : `${name} (archived)`;
	}

	/** What does not connect below server row `i`, worded; null when it connects. */
	function seamOf(i: number): RowView['seam'] {
		const p = data.positionSeams.find((s) => s.after === i);
		const t = data.timingSeams.find((s) => s.after === i);
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
			next,
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
	const stale = $derived(pending > 0 || dragging);

	const rows: RowView[] = $derived(
		shown.map(({ slot, edges, i }) => {
			const isRoutine = slot.childId !== null;
			const main = slot.figureIds[0] as number | undefined;
			return {
				id: slot.id,
				source: isRoutine || main === undefined ? null : sourceOf(main),
				title: isRoutine
					? (slot.childName ?? 'a routine')
					: main === undefined
						? 'Empty — nothing to call here'
						: optionName(main),
				meta: slotMeta(
					edges,
					posName,
					isRoutine ? (data.childSlots[slot.childId as number] ?? 0) : null
				),
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
						source: sourceOf(f)
					})),
				canAddAlternative: !isRoutine && main !== undefined && figuresById.has(main),
				failure:
					place?.where === 'slot' && place.stepId === slot.id && !archivedForm
						? place.message
						: null,
				seam: stale ? null : seamOf(i)
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
		data.exerciseId === null
			? resolve(`/${data.dance.slug}/player?routine=${routine.id}`)
			: resolve(`/${data.dance.slug}/player?routine=${routine.id}&exercise=${data.exerciseId}`)
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
		pending++;
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
			pending--;
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
				? `Slot ${rows.findIndex((r) => r.id === ids[0]) + 1} deleted`
				: `${ids.length} slots deleted`;
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
		goneOptions = [...goneOptions, key];
		swiped = null;
		const result = await send('removeOption', { stepId, figureId });
		goneOptions = goneOptions.filter((k) => k !== key);
		if (result.type === 'success') {
			// When it went: in a group, Undo brings back what the remove took off members' Today.
			const removedAt = typeof result.data?.removedAt === 'number' ? result.data.removedAt : '';
			showToast(`Removed ${label}`, () => send('restoreOption', { stepId, figureId, removedAt }));
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
				? 'Add a figure'
				: from.side === 'between'
					? `Add between slots ${from.row + 1} and ${from.next + 1}`
					: from.side === 'after'
						? `Add after slot ${from.row + 1}`
						: `Add before slot ${from.row + 1}`;
		picker = { title, anchor, insertAt: at, stepId: null };
	}

	function openAlternative(stepId: number) {
		const slot = data.slots.find((s) => s.id === stepId);
		if (!slot) return;
		const main = figuresById.get(slot.figureIds[0]);
		const anchor = anchorAlternative(main, slot.figureIds);
		if (!main || !anchor) return;
		picker = { title: `Alternative for ${main.label}`, anchor, insertAt: null, stepId };
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
		await put(p, c);
	}

	async function put(p: PickerState, c: Candidate) {
		lastPick = { p, c };
		if (p.stepId !== null) {
			await send('addOption', { stepId: p.stepId, figureId: c.id });
			return;
		}
		const content: Record<string, Field> =
			c.kind === 'figure' ? { figureId: c.id } : { childId: c.id };
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
		}
	}

	$effect(() => {
		if (flash === null) return;
		const timer = setTimeout(() => (flash = null), 1200);
		return () => clearTimeout(timer);
	});

	/* ── Selection ─────────────────────────────────────────────────────── */

	const press = longPress({
		ms: 450,
		// Under the swipe's 10 px lock, so a locked swipe has always cancelled it.
		tolerancePx: 9.5,
		enabled: () => !selecting && !dragging,
		onLongPress: (id) => {
			selecting = true;
			selected = [id];
			expanded = null;
			swiped = null;
		}
	});

	function tap(id: number) {
		if (swiped) {
			swiped = null;
			return;
		}
		if (selecting) {
			selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
			if (selected.length === 0) selecting = false;
			return;
		}
		expanded = expanded === id ? null : id;
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
		stopSelecting();
		focusBand('more');
	}

	const extractBlocked = $derived(extractBlock(rows, selected, data.embeddedIn));

	/**
	 * Add above / below the one selected slot. The selection is KEPT while the
	 * picker is open: closing it without picking leaves you where you were.
	 * Picking ends selection and opens the new slot expanded (see `pick`).
	 */
	function addAround(side: 'after' | 'before') {
		const i = rows.findIndex((r) => r.id === selected[0]);
		if (i < 0) return;
		openPicker(side === 'after' ? i + 1 : i, { row: i, side });
	}

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

{#snippet back()}
	{#if selecting}
		<BandButton
			focusKey="stop-selecting"
			icon="close"
			label="Stop selecting"
			onclick={leaveSelecting}
		/>
	{:else if editing}
		<BandButton
			focusKey="stop-editing"
			icon="close"
			label="Stop editing"
			onclick={() => leaveOrAsk(editForm ?? null, stopEditing, 'Stop editing')}
		/>
	{:else}
		<BackButton
			fallback={{
				href: resolve('/[dance]/(moves)/routines', { dance: data.dance.slug }),
				label: 'Back to Moves'
			}}
		/>
	{/if}
{/snippet}

{#snippet actions()}
	{#if data.historyHref}
		<BandButton icon="clock" label="History" href={data.historyHref} />
	{/if}
	<BandButton focusKey="edit" icon="pencil" label="Edit routine" onclick={startEditing} />
	{#if data.slots.length > 0}
		<BandButton
			focusKey="more"
			icon="more"
			label="More actions"
			onclick={() => (menuOpen = true)}
		/>
	{/if}
{/snippet}

<!-- A reader's Edit makes the routine theirs (ruling 1). On the desktop it is pinned at the pane's foot instead. -->
{#snippet readerActions()}
	<span class="contents desk:hidden"
		><BandButton icon="pencil" label="Edit routine" onclick={() => (makingMine = true)} /></span
	>
{/snippet}

{#snippet practise()}
	<!-- The player picks the song: count only, or any of this dance's ready ones. A reader's
	     Practise is pinned at the pane's foot on the desktop, beside Edit. -->
	{#if data.makeMine}
		<span class="contents desk:hidden"
			><HeroCard title="Practise" meta="Count only or with a song" href={practiseHref} /></span
		>
	{:else}
		<HeroCard title="Practise" meta="Count only or with a song" href={practiseHref} />
	{/if}
{/snippet}

<Screen
	title={selecting ? selectionTitle(selected.length) : editing ? 'Edit routine' : routine.name}
	compact={selecting || (!editing && bandCompact(routine.name))}
	subtitle={selecting || editing ? undefined : (cloneSubtitle(data.cloneLine) ?? undefined)}
	left={back}
	right={selecting || editing
		? undefined
		: data.canEdit
			? actions
			: data.makeMine
				? readerActions
				: undefined}
	hero={selecting || editing || !danceable ? undefined : practise}
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
					label: 'Routine edits',
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
					<label class={LABEL} for="edit-name">Name</label>
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
							Up to 200 characters
						</p>
					{/if}
				</div>
				<div>
					<label class={LABEL} for="edit-notes"
						>Notes <span class="font-medium text-muted">(optional)</span></label
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

			<h2 class="{SECTION_LABEL} pt-1">More</h2>
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
								<span class="text-[16px] leading-tight font-bold text-ink">Duplicate routine</span>
								<span class="text-[13px] text-muted">Makes a copy and opens it</span>
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
							<span class="text-[16px] leading-tight font-bold text-danger">Archive routine</span>
							<span class="text-[13px] text-muted">Its slots and practice history are kept</span>
						</span>
					</button>
				</li>
			</ul>
		{:else}
			<!-- Selecting shows only the slots. -->
			{#if !selecting}
				<SourceTabs
					sources={data.sources}
					kind="routine"
					dance={data.dance.slug}
					current={routine.id}
					mineId={data.mineId}
					compare={data.compare}
					family={data.family}
					drop={data.drop}
					detach={data.detach}
					copy={data.copyTo}
					sameAs={data.sameAs}
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
										>{#if restoring}<Spinner /><span class="sr-only">Restoring…</span
											>{:else}Restore{/if}</button
									>
								{/if}
								<button type="button" class={button('tertiary', 'sm')} onclick={pickAnother}
									>Pick another</button
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
								{#if facts.from !== null}Starts from <b class="font-extrabold text-ink"
										>{facts.from}</b
									>{#if facts.to !== null}&nbsp;· ends at <b class="font-extrabold text-ink"
											>{facts.to}</b
										>{/if}{:else}Ends at <b class="font-extrabold text-ink">{facts.to}</b>{/if}
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
			{/if}

			{#if !data.canEdit}
				<!-- A reader sees the slots as they are: no gestures, no picker, no notes to edit. -->
				{#if rows.length === 0}
					<p class="rounded-2xl bg-surface px-4 py-3.5 text-[14px] text-muted">No slots yet.</p>
				{:else}
					<section>
						<h2 class="{SECTION_LABEL} mb-2 pt-1.5">Slots · {rows.length}</h2>
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
												>or {#each row.alternatives as a, k (a.id)}{k > 0
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
					title="No slots yet"
					body="The first slot is where the routine starts. Add a figure, then build from it."
				>
					{#snippet action()}
						<button type="button" class={button('primary')} onclick={() => openPicker(0, null)}
							><Icon name="plus" size={20} />Add a figure</button
						>
					{/snippet}
				</EmptyState>
			{:else}
				<section>
					<h2 class="{SECTION_LABEL} mb-2 pt-1.5">Slots · {rows.length}</h2>
					<SlotList
						{rows}
						{expanded}
						{selecting}
						{selected}
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
						onnote={(id, note) => send('note', { stepId: id, note })}
						onadd={openPicker}
					/>
					{@render groupNote()}
				</section>
			{/if}

			{#if !selecting && (data.exerciseId !== null || data.taughtIn.length > 0)}
				<h2 class="{SECTION_LABEL} pt-3.5">More</h2>
				<ul class={GROUP}>
					{#if data.exerciseId !== null}
						{@render moreRow(
							resolve('/[dance]/exercises/[id]', {
								dance: data.dance.slug,
								id: String(data.exerciseId)
							}),
							'repeat',
							'Exercise',
							'History, how often, active'
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
							`Taught in · ${longDayLabel(lesson.lessonDay)}`
						)}
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
</Screen>

{#snippet moreRow(href: string, icon: IconName, title: string, meta: string)}
	<li>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a resolved href -->
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

<RoutineMenu
	open={menuOpen}
	title={routine.name}
	canSelect={data.slots.length > 0}
	onselect={() => {
		selecting = true;
		selected = [];
		expanded = null;
		swiped = null;
		focusBand('stop-selecting');
	}}
	onclose={() => (menuOpen = false)}
/>

{#if data.makeMine}
	<!-- A reader's Edit and Practise, pinned at the pane's foot on the desktop (as a group's
	     figure pins them); the phone has the band's pencil and the Practise hero. -->
	<div class="hidden desk:contents">
		<BottomBar>
			<div class="grid gap-2 {danceable ? 'grid-cols-2' : ''}">
				<button
					type="button"
					class={button('secondary', 'md', true)}
					aria-haspopup="dialog"
					onclick={() => (makingMine = true)}><Icon name="pencil" size={20} />Edit</button
				>
				{#if danceable}
					<a href={practiseHref} class={button('primary', 'md', true)}
						><Icon name="play" size={20} />Practise</a
					>
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
			{#if saving}<Spinner /><span class="sr-only">Saving…</span>{:else}Save{/if}
		</button>
	</BottomBar>
{/if}

<Dialog
	open={archiving}
	icon="trash"
	tone="danger"
	title="Archive “{routine.name}”?"
	body="It leaves the Routines list. Its slots and practice history are kept."
	onclose={() => (archiving = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (archiving = false)}
			>Cancel</button
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
				{#if archivingNow}<Spinner /><span class="sr-only">Archiving…</span>{:else}Archive{/if}
			</button>
		</form>
	{/snippet}
</Dialog>

{#if selecting}
	<SelectionBar
		bind:height={barHeight}
		count={selected.length}
		blocks={actionBlocks(selected.length, extractBlocked)}
		onabove={() => addAround('before')}
		onbelow={() => addAround('after')}
		onduplicate={() => {
			// Selection from ⋯ starts empty: nothing to post yet.
			if (selected.length === 0) return;
			const ids = inOrder(rows, selected);
			stopSelecting();
			send('duplicateMany', { stepIds: ids });
		}}
		onextract={() => {
			// A refused earlier Make routine (or rename) must not greet this one.
			dismissed = form;
			naming = true;
		}}
		ondelete={() => {
			if (selected.length === 0) return;
			const ids = inOrder(rows, selected);
			stopSelecting();
			remove(ids);
		}}
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

<Sheet title="Make a routine" open={naming} onclose={() => (naming = false)}>
	<form
		id="make-routine"
		novalidate
		method="POST"
		action="?/extract"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'New routine name',
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
			<label class={LABEL} for="make-name">Name</label>
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
				placeholder="Shine opener"
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
			aria-label={making ? 'Making routine' : undefined}
		>
			{#if making}<Spinner />{:else}<Icon name="route" size={20} />Make routine{/if}
		</button>
	{/snippet}
</Sheet>

<Toast
	toast={toast && { id: toast.id, message: toast.message, action: 'Undo' }}
	bottom={selecting
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
