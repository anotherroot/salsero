<script lang="ts">
	import { untrack } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button, FIELD, LABEL, SECTION_LABEL } from '$lib/components/ui/styles';
	import { moveState } from '$lib/figures/page';
	import PickerField from '$lib/components/picker/PickerField.svelte';
	import { figureRows } from '$lib/picker/build';
	import RemoveWarning from './RemoveWarning.svelte';
	import type { MoveTarget } from '$lib/types';

	/**
	 * "Move <variation> to…": a new figure of its own, or another figure of the
	 * dance. Posts `?/move` with `target` (`new` or the figure's id) and, for a
	 * new one, `figureName`; for an existing one, `name` — what the variation is
	 * called there, so a clash can be renamed away on the way in. The variation
	 * keeps its id, so a move lands back on this same page.
	 */
	interface Props {
		variation: string;
		figure: string;
		/** The other live figures of this dance. */
		targets: MoveTarget[];
		/** This is the figure's only variation: moving it removes the figure. */
		last: boolean;
		/** `move`'s refusal, if the last post was one; `field` names the field it is about. */
		failed: { message: string; field: 'name' | 'figureName' | null } | null;
		/** The "Name in <figure>" the refused move posted, so it survives the message. */
		typedName: string | null;
		open: boolean;
		onclose: () => void;
	}

	let { variation, figure, targets, last, failed, typedName, open, onclose }: Props = $props();

	/** The figure chosen in the picker; null means "a new figure of its own". */
	let picked = $state<number | null>(null);
	/** `'new'`, or a target figure's id: what `?/move` receives as `target`. */
	const target = $derived(picked === null ? 'new' : String(picked));
	// Kept in state so they survive picking another destination and coming back.
	let newName = $state('');
	let joinName = $state('');

	// Each opening starts fresh. A refused move keeps the sheet open, so what was
	// picked survives the message.
	$effect(() => {
		if (open) {
			untrack(() => {
				picked = null;
				newName = figure.trim().toLowerCase().endsWith(variation.trim().toLowerCase())
					? figure
					: `${figure} ${variation}`;
				joinName = variation;
			});
		}
	});

	// A refusal shows only while the sheet has stayed open since it arrived: a
	// reopened sheet starts clean even though the page still holds the old one.
	let shown = $derived(failed);
	let wasOpen = false;
	$effect(() => {
		const now = open;
		if (wasOpen && !now) shown = null;
		wasOpen = now;
	});

	const chosen = $derived(targets.find((t) => String(t.id) === target) ?? null);
	const mv = $derived(moveState({ last, chosen, joinName }));
	let busy = $state(false);
	/** The server's refusal about a field shows until that field is edited. */
	const nameError = $derived(mv.clash ?? (shown?.field === 'name' ? shown.message : null));
	const figureNameError = $derived(shown?.field === 'figureName' ? shown.message : null);
	const bannerError = $derived(shown && !shown.field ? shown.message : null);
	// A "name taken" refusal is about the figure it was posted to; choosing another one makes it stale.
	let lastTarget = untrack(() => target);
	$effect(() => {
		const now = target;
		if (now !== lastTarget) {
			lastTarget = now;
			untrack(() => {
				if (shown?.field === 'name') shown = null;
			});
		}
	});
	const clearField = (f: 'name' | 'figureName') => {
		if (shown?.field === f) shown = null;
	};

	/** The move redirects to this same URL, so SvelteKit keeps the sheet: close it. */
	const closeOnMove: SubmitFunction = () => {
		busy = true;
		return async ({ update, result }) => {
			await update();
			busy = false;
			if (result.type === 'redirect') onclose();
			else if (result.type === 'failure') {
				// The same message twice in a row changes nothing the effect can see.
				shown = failed;
				// What was posted under "Name in <figure>", kept for another try.
				if (typedName) joinName = typedName;
			}
		};
	};
</script>

<Sheet title="Move “{variation}” to…" {open} {onclose}>
	<form
		id="move-form"
		method="POST"
		action="?/move"
		class="flex flex-col gap-3.5"
		use:guarded={{ label: `Moving ${variation}`, submit: closeOnMove }}
	>
		{#if bannerError}<Banner kind="error" title={bannerError} />{/if}

		<div class="rounded-2xl bg-surface px-4 py-1.5">
			<label
				class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
			>
				<input
					type="radio"
					name="choice"
					checked={picked === null}
					onchange={() => (picked = null)}
					class="sr-only"
				/>
				<input type="hidden" name="target" value={target} />
				<span
					class="size-[22px] shrink-0 rounded-full {target === 'new'
						? 'border-[7px] border-accent'
						: 'border-2 border-field-line'}"
					aria-hidden="true"
				></span>
				<span class="flex min-w-0 flex-1 flex-col py-1.5">
					<span class="text-[16px] font-semibold text-ink">A new move of its own</span>
					<span class="text-[13px] text-muted">{variation} becomes its first figure</span>
				</span>
			</label>
			{#if target === 'new'}
				<div class="pt-1.5 pb-3">
					<label for="move-figure-name" class={LABEL}>New move’s name</label>
					<input
						id="move-figure-name"
						name="figureName"
						required
						maxlength="200"
						bind:value={newName}
						oninput={() => clearField('figureName')}
						class={FIELD}
						aria-invalid={figureNameError ? 'true' : undefined}
						aria-describedby={figureNameError ? 'move-figure-name-error' : undefined}
					/>
					{#if figureNameError}<FieldError
							id="move-figure-name-error"
							message={figureNameError}
						/>{/if}
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			<h3 class={SECTION_LABEL}>Or join a move</h3>
			{#if targets.length === 0}
				<p class="px-4 text-[14px] text-muted">There are no other moves yet.</p>
			{:else}
				<PickerField
					name="targetPick"
					label="Move"
					placeholder="Choose a move…"
					title="Join a move"
					search="Search moves"
					groups={[{ title: 'Moves', entries: figureRows(targets) }]}
					nothingLeft="There are no other moves yet."
					bind:value={picked}
				/>
			{/if}
		</div>

		{#if chosen}
			<div>
				<label for="move-name" class={LABEL}>Name in {chosen.name}</label>
				<input
					id="move-name"
					name="name"
					required
					maxlength="200"
					bind:value={joinName}
					oninput={() => clearField('name')}
					class={FIELD}
					aria-invalid={nameError ? 'true' : undefined}
					aria-describedby={nameError ? 'move-name-error' : undefined}
				/>
				{#if nameError}<FieldError id="move-name-error" message={nameError} />{/if}
			</div>
		{/if}

		{#if last}
			<RemoveWarning {figure} {variation} />
		{/if}
	</form>
	{#snippet footer()}
		<button
			type="submit"
			form="move-form"
			disabled={mv.blocked || busy}
			aria-busy={busy}
			class={button(mv.danger ? 'danger' : 'primary', 'md', true)}
		>
			{#if busy}<Spinner size={18} />{/if}{mv.cta}
		</button>
	{/snippet}
</Sheet>
