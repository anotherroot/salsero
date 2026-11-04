<script lang="ts">
	import { untrack } from 'svelte';
	import PickerMultiField from '$lib/components/picker/PickerMultiField.svelte';
	import PositionFields from '$lib/components/positions/PositionFields.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button } from '$lib/components/ui/styles';
	import { positionRow, withPositionRow } from '$lib/picker/build';
	import {
		SHEET,
		TAGS_CLEAR,
		TAGS_CREATE_FAILED,
		TAGS_HELP,
		TAGS_NEW_SUB,
		TAGS_PICKER,
		tagsEmpty,
		tagsSub,
		type StyleLabel
	} from '$lib/positions/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { PickGroup, PickRow } from '$lib/picker/model';
	import type { PositionSummary } from '$lib/types';

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
		figureId
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
	} = $props();

	let starts = $state<number[]>(untrack(() => [...startIds]));
	let ends = $state<number[]>(untrack(() => [...endIds]));
	/** Positions made here, offered in both pickers until the page's data lists them. */
	let made = $state<PositionSummary[]>([]);
	const offered = $derived(
		made.reduce((gs, p) => withPositionRow(gs, p, figureStyle, styleLabel), groups)
	);
	const sub = $derived(tagsSub(figureLabel, figureStyle ? styleLabel(figureStyle) : null));

	/** The create step, while open: what was typed, and the picker waiting for it. */
	let level = $state<{ name: string; done: (row: PickRow | undefined) => void } | null>(null);
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
		return new Promise((done) => (level = { name: query.trim(), done }));
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
			if (res.status === 201 && body) {
				made = [...made, body];
				finish(positionRow(body));
			} else if (
				typeof body?.message === 'string' &&
				(body.field === 'name' || body.field === 'notes')
			) {
				errors = { [body.field]: body.message };
			} else {
				refused = typeof body?.message === 'string' ? body.message : TAGS_CREATE_FAILED;
			}
		} catch {
			refused = TAGS_CREATE_FAILED;
		} finally {
			busy = false;
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
		empty={tagsEmpty}
		groups={offered}
		clear={TAGS_CLEAR}
		bind:values={starts}
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
		empty={tagsEmpty}
		groups={offered}
		clear={TAGS_CLEAR}
		bind:values={ends}
		create={{ label: TAGS_PICKER.create, key: 'position' }}
		{oncreate}
		nothingLeft={TAGS_PICKER.nothingLeft}
	/>
	<p class="-mt-1.5 pl-1 text-[13px] leading-[1.4] text-muted">{TAGS_HELP}</p>
</div>

{#if level}
	<div use:afterForm>
		<Sheet
			title={SHEET.newTitle}
			sub={TAGS_NEW_SUB}
			open={placed}
			back
			onclose={() => finish(undefined)}
		>
			<!-- A fetch form, not use:guarded: it posts JSON, and keeps what was typed until it closes. -->
			<form id={formId} novalidate onsubmit={create} class="flex flex-col gap-3.5">
				{#if refused}<Banner kind="error">{refused}</Banner>{/if}
				<PositionFields {dance} name={level.name} styleTag={figureStyle} {errors} autofocus />
			</form>
			{#snippet footer()}
				<button
					type="submit"
					form={formId}
					class={button('primary', 'md', true)}
					aria-busy={busy}
					aria-label={busy ? 'Adding position' : undefined}
				>
					{#if busy}<Spinner />{:else}{SHEET.add}{/if}
				</button>
			{/snippet}
		</Sheet>
	</div>
{/if}
