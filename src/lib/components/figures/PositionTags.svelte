<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidate } from '$app/navigation';
	import PickerMultiField from '$lib/components/picker/PickerMultiField.svelte';
	import PositionFields from '$lib/components/positions/PositionFields.svelte';
	import CopyHereCard from '$lib/components/links/CopyHereCard.svelte';
	import { t } from '$lib/i18n/catalog';
	import { ElsewhereSearch } from '$lib/picker/elsewhere-search.svelte';
	import { copyable, elsewhereFrom, elsewhereOf } from '$lib/picker/elsewhere';
	import { copyToUse } from '$lib/picker/elsewhere-api';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button } from '$lib/components/ui/styles';
	import { positionRow, withPositionRow } from '$lib/picker/build';
	import {
		BUSY,
		SHEET,
		TAGS_CLEAR,
		tagsCreateFailed,
		tagsHelp,
		tagsNewSub,
		TAGS_PICKER,
		tagsEmpty,
		tagsSub,
		type StyleLabel
	} from '$lib/positions/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { PickGroup, PickRow } from '$lib/picker/model';
	import type { CopyableRow, PositionSummary } from '$lib/types';

	/**
	 * A figure's Starts in and Ends in: two pickers that take any number of
	 * positions, each posting its ids (`startIds`, `endIds`). None at all is the
	 * default and fits anywhere.
	 *
	 * "Not in the list?" opens New position as a level over the picker: what was
	 * typed is its name, the figure's type its type. It posts to
	 * `POST /api/positions` (ruling 9), never to a page action: this sits inside
	 * the figure's own form, which a page action would submit. The level is
	 * drawn just after that form (`afterForm`), since a form inside a form is
	 * not HTML. A refusal stays in the level, under Name or as a Banner, with
	 * the button back; a made position is chosen in the picker it came from and
	 * offered in both.
	 *
	 * In a group (`into`, for an editor), a search also finds the positions of
	 * the person's own app and other groups (link from other places): a tap
	 * opens the card, and Copy and use copies the position into the group
	 * (`POST /api/elsewhere/copy`) and chooses the copy in the picker it was
	 * tapped in, offered in both.
	 *
	 * **Key this component on the figure's id**: it seeds its values once.
	 */
	let {
		dance,
		startIds,
		endIds,
		groups,
		figureLabel,
		figureStyle,
		styleLabel,
		figureId,
		into = null
	}: {
		dance: DanceSlug;
		startIds: number[];
		endIds: number[];
		groups: PickGroup[];
		/** "Enchufla · Doble". */
		figureLabel: string;
		figureStyle: string | null;
		styleLabel: StyleLabel;
		figureId: number;
		/** A group's figure, for an editor: the group the other places' positions copy into. */
		into?: { teamId: number; name: string } | null;
	} = $props();

	let starts = $state<number[]>(untrack(() => [...startIds]));
	let ends = $state<number[]>(untrack(() => [...endIds]));
	/** Positions made here, offered in both pickers until the page's data lists them. */
	let made = $state<PositionSummary[]>([]);
	const offered = $derived(
		made.reduce((gs, p) => withPositionRow(gs, p, figureStyle, styleLabel), groups)
	);
	const sub = $derived(tagsSub(figureLabel, figureStyle ? styleLabel(figureStyle) : null));

	/* Link from other places: one search for whichever picker is open. */
	type Side = 'start' | 'end';
	let open = $state<Record<Side, boolean>>({ start: false, end: false });
	let query = $state<Record<Side, string>>({ start: '', end: '' });
	const away = new ElsewhereSearch();
	const side = $derived<Side | null>(open.start ? 'start' : open.end ? 'end' : null);
	$effect(() => {
		if (!into || side === null) return away.reset();
		away.search(into.teamId, ['position'], query[side]);
	});
	const awayPicker = $derived(
		into ? { here: into.name, state: away.state, groups: away.groups } : null
	);

	/** The card: the position from another place, the picker it was tapped in, where it was found. */
	let card = $state<{
		side: Side;
		row: CopyableRow;
		from: string | null;
		restore: number | null;
	} | null>(null);
	let cardBusy = $state(false);
	let cardMessage = $state<string | null>(null);

	function openCard(at: Side, pick: PickRow) {
		const row = elsewhereOf(away.places, pick.key);
		if (!row || !copyable(row)) return;
		card = { side: at, row, from: elsewhereFrom(away.places, pick.key), restore: row.restore };
		cardMessage = null;
	}

	/** Choose `id` in the picker on `at`. */
	function choose(at: Side, id: number) {
		if (at === 'start' && !starts.includes(id)) starts = [...starts, id];
		if (at === 'end' && !ends.includes(id)) ends = [...ends, id];
	}

	/** Copy and use, or Restore and use with `restore`. */
	async function sendCopy(use: Record<string, number>, restore: number | null) {
		const sent = card;
		if (!sent || !into || cardBusy) return;
		cardBusy = true;
		cardMessage = null;
		const res = await copyToUse(into.teamId, 'position', sent.row.id, use, restore);
		cardBusy = false;
		if (card !== sent) return;
		if (res.ok) {
			if (res.position) made = [...made, res.position];
			choose(sent.side, res.id);
			card = null;
			away.refresh();
			void invalidate('app:moves');
		} else if ('restore' in res) card = { ...sent, restore: res.restore };
		else cardMessage = res.message ?? t().clones.copyHere.failedUse;
	}

	/** The card's "Use the group's one": the group's same-named position, chosen. */
	function useGroups() {
		const c = card;
		if (!c || c.row.sameName === null) return;
		card = null;
		choose(c.side, c.row.sameName);
	}

	/**
	 * The create step, while open: what was typed, the picker waiting for it,
	 * and its opening's number (`seq`), which a request carries so an answer
	 * for a level that closed (or another opening) is not taken as this one's.
	 */
	type Level = { seq: number; name: string; done: (row: PickRow | undefined) => void };
	let level = $state<Level | null>(null);
	/** The last level opened: its fields stay drawn while the sheet closes. */
	let shown = $state<Level | null>(null);
	let seq = 0;
	/** True once the level sits outside the figure's form: only then may it open. */
	let placed = $state(false);
	let busy = $state(false);
	let errors = $state<Partial<Record<'name' | 'notes', string>>>({});
	let refused = $state<string | null>(null);
	const uid = $props.id();
	const formId = `${uid}-new-position`;

	function oncreate(query: string): Promise<PickRow | undefined> {
		errors = {};
		refused = null;
		busy = false;
		return new Promise((done) => {
			level = { seq: ++seq, name: query.trim(), done };
			shown = level;
		});
	}

	/** Close the level; the picker hears what was made, or nothing. */
	function finish(row: PickRow | undefined) {
		const l = level;
		level = null;
		l?.done(row);
	}

	/** Move the level out of the figure's form, so its own form is not nested in it. */
	function afterForm(node: HTMLElement) {
		node.closest('form')?.after(node);
		placed = true;
		return {
			destroy() {
				placed = false;
				node.remove();
			}
		};
	}

	const text = (fd: FormData, key: string) => {
		const v = fd.get(key);
		return typeof v === 'string' && v !== '' ? v : null;
	};

	async function create(e: SubmitEvent) {
		e.preventDefault();
		// One create per tap: a second tap while the first is out is dropped.
		if (busy || !level) return;
		const sent = level.seq;
		/** Still the level that sent it: not closed, not opened again since. */
		const current = () => level?.seq === sent;
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		busy = true;
		errors = {};
		refused = null;
		try {
			const res = await fetch('/api/positions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					figureId,
					name: String(fd.get('name') ?? ''),
					styleTag: text(fd, 'styleTag'),
					hands: text(fd, 'hands'),
					crossed: fd.get('crossed') === '1',
					facing: text(fd, 'facing'),
					frame: text(fd, 'frame'),
					notes: text(fd, 'notes')
				})
			});
			const body = (await res.json().catch(() => null)) as
				(PositionSummary & { message?: unknown; field?: unknown }) | null;
			// Made, whichever level asked: it exists now, so both pickers offer it,
			// and so does the Positions list (the (moves) layout's), saved or not.
			if (res.status === 201 && body) {
				made = [...made, body];
				void invalidate('app:moves');
			}
			// A level that closed, or was opened again, since: its answer is not this one's.
			if (!current()) return;
			if (res.status === 201 && body) {
				finish(positionRow(body));
			} else if (
				typeof body?.message === 'string' &&
				(body.field === 'name' || body.field === 'notes')
			) {
				errors = { [body.field]: body.message };
			} else {
				refused = typeof body?.message === 'string' ? body.message : tagsCreateFailed();
			}
		} catch {
			if (current()) refused = tagsCreateFailed();
		} finally {
			// Another opening reset `busy` itself; this one's answer leaves it alone.
			if (current() || level === null) busy = false;
		}
	}
</script>

<div class="flex flex-col gap-3.5">
	<PickerMultiField
		name="startIds"
		label={TAGS_PICKER.starts}
		title={TAGS_PICKER.starts}
		{sub}
		placeholder={TAGS_PICKER.search}
		empty={tagsEmpty()}
		groups={offered}
		clear={TAGS_CLEAR}
		bind:values={starts}
		bind:open={open.start}
		bind:query={query.start}
		elsewhere={awayPicker}
		onelsewhere={(row) => openCard('start', row)}
		create={{ label: TAGS_PICKER.create, key: 'position' }}
		{oncreate}
		nothingLeft={TAGS_PICKER.nothingLeft}
	/>
	<PickerMultiField
		name="endIds"
		label={TAGS_PICKER.ends}
		title={TAGS_PICKER.ends}
		{sub}
		placeholder={TAGS_PICKER.search}
		empty={tagsEmpty()}
		groups={offered}
		clear={TAGS_CLEAR}
		bind:values={ends}
		bind:open={open.end}
		bind:query={query.end}
		elsewhere={awayPicker}
		onelsewhere={(row) => openCard('end', row)}
		create={{ label: TAGS_PICKER.create, key: 'position' }}
		{oncreate}
		nothingLeft={TAGS_PICKER.nothingLeft}
	/>
	<p class="-mt-1.5 pl-1 text-[13px] leading-[1.4] text-muted">{tagsHelp()}</p>
</div>

<!-- Link from other places: the card over the picker it was tapped in. -->
{#if card && into}
	{@const c = card}
	<CopyHereCard
		theme="light"
		kind="position"
		then="use"
		id={c.row.id}
		label={c.row.label}
		from={c.from}
		{into}
		sameName={c.row.sameName}
		restore={c.restore}
		busy={cardBusy}
		message={cardMessage}
		oncopy={(use) => sendCopy(use, null)}
		onrestore={(use) => sendCopy(use, c.restore)}
		onlinkgroups={useGroups}
		onclose={() => (card = null)}
	/>
{/if}

<!--
	Always mounted, `open` driven: a native dialog's close hands focus back to
	what had it (the picker's create button), which an unmounted one cannot.
	The fields are keyed on the opening, so each starts from what was typed.
-->
<div use:afterForm>
	<Sheet
		title={SHEET.newTitle}
		sub={tagsNewSub()}
		open={placed && level !== null}
		back
		onclose={() => finish(undefined)}
	>
		<!-- A fetch form, not use:guarded: it posts JSON, and keeps what was typed until it closes. -->
		<form id={formId} novalidate onsubmit={create} class="flex flex-col gap-3.5">
			{#if refused}<Banner kind="error">{refused}</Banner>{/if}
			{#key shown?.seq}
				{#if shown}
					<PositionFields {dance} name={shown.name} styleTag={figureStyle} {errors} autofocus />
				{/if}
			{/key}
		</form>
		{#snippet footer()}
			<button
				type="submit"
				form={formId}
				class={button('primary', 'md', true)}
				aria-busy={busy}
				aria-label={busy ? BUSY.adding : undefined}
			>
				{#if busy}<Spinner />{:else}{SHEET.add}{/if}
			</button>
		{/snippet}
	</Sheet>
</div>
