<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import MovesScreen from '$lib/components/moves/MovesScreen.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, GROUP, LABEL, SECTION_LABEL, TEXTAREA, button } from '$lib/components/ui/styles';
	import { plural } from '$lib/format';
	import { groupHeading } from '$lib/moves/figures';
	import { routineBadges, type RoutineBadge } from '$lib/moves/routines';
	import { HIDDEN_FROM_MEMBERS, MEMBERS_NOTE, anyHidden } from '$lib/moves/members';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// `?new=1` opens the sheet on arrival, as it does on Figures.
	let creating = $state(page.url.searchParams.get('new') === '1');
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form?.message) creating = true;
	});
	let busy = $state(false);

	const nameError = $derived(form?.field === 'name' ? form.message : null);
	const notesError = $derived(form?.field === 'notes' ? form.message : null);
	// A refusal that is about no one field goes at the top of the sheet.
	const otherError = $derived(form?.message && !form.field ? form.message : null);
</script>

<svelte:head><title>Routines · {data.dance.label}</title></svelte:head>

{#snippet routineRow(
	routine: { id: number; name: string; slots: number; membersSee?: boolean },
	badges: RoutineBadge[]
)}
	<a
		class="flex min-h-[68px] items-center gap-2.5 py-[9px] pr-3.5 pl-4 active:bg-step"
		href={resolve('/[dance]/routines/[id]', {
			dance: data.dance.slug,
			id: String(routine.id)
		})}
	>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="truncate text-[16px] leading-[1.3] font-bold text-ink">{routine.name}</span>
			<span
				class="flex flex-wrap items-center gap-1.5 pt-0.5 text-[13px] leading-[1.35] text-muted"
			>
				<span>{plural(routine.slots, 'slot', 'slots')}</span>
				{#each badges as b (b.text)}
					<Badge tone={b.tone}>{b.text}</Badge>
				{/each}
				{#if routine.membersSee === false}
					<span class="flex items-center gap-1 whitespace-nowrap"
						><Icon name="eye-off" size={16} />{HIDDEN_FROM_MEMBERS}</span
					>
				{/if}
			</span>
		</span>
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
{/snippet}

<MovesScreen segment="routines" dance={data.dance.slug} onnew={() => (creating = true)}>
	{#if data.routines.length === 0 && data.groups.length === 0}
		<div class="h-10 flex-none"></div>
		<EmptyState
			icon="routine"
			title="No routines yet"
			body="String some figures together into one you can call as a single set."
		>
			{#snippet action()}
				<button type="button" class={button('primary')} onclick={() => (creating = true)}>
					<Icon name="plus" size={20} /> New routine
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		{#if data.routines.length > 0}
			{#if anyHidden(data.routines)}
				<p class="rounded-2xl bg-surface px-4 py-3 text-[13px] leading-[1.4] text-muted">
					{MEMBERS_NOTE}
				</p>
			{/if}
			<h2 class="{SECTION_LABEL} pt-1">{plural(data.routines.length, 'routine', 'routines')}</h2>
			<div class={GROUP}>
				{#each data.routines as routine (routine.id)}
					{@render routineRow(routine, routineBadges(routine))}
				{/each}
			</div>
		{/if}

		<!-- Each group's routines from the lessons the person added: opened, not edited, under a slight heading. -->
		{#each data.groups as g (g.team.id)}
			<section aria-label={g.team.name} class="flex flex-col gap-2">
				<h2 class="flex items-center gap-1.5 {SECTION_LABEL} pt-1.5">
					<Icon name="people" size={16} />{groupHeading(g.team.name, g.routines.length)}
				</h2>
				<div class={GROUP}>
					{#each g.routines as routine (routine.id)}
						{@render routineRow(routine, [])}
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</MovesScreen>

<Sheet title="New routine" open={creating} onclose={() => (creating = false)}>
	<form
		id="new-routine"
		method="POST"
		action="?/create"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'New routine',
			submit: ({ cancel }) => {
				// One routine per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}
		}}
	>
		{#if otherError}<Banner kind="error">{otherError}</Banner>{/if}

		<div>
			<label class={LABEL} for="routine-name">Name</label>
			<!-- The sheet exists to type this one thing. -->
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="routine-name"
				name="name"
				required
				autofocus
				maxlength="200"
				value={form?.name ?? ''}
				placeholder="Basic combo"
				class={FIELD}
				aria-invalid={nameError ? 'true' : undefined}
				aria-describedby={nameError ? 'routine-name-error' : undefined}
			/>
			{#if nameError}<FieldError id="routine-name-error" message={nameError} />{/if}
		</div>

		<div>
			<label class={LABEL} for="routine-notes">Notes</label>
			<textarea
				id="routine-notes"
				name="notes"
				rows="4"
				maxlength="2000"
				placeholder="What this is for, when to reach for it…"
				class={TEXTAREA}
				aria-invalid={notesError ? 'true' : undefined}
				aria-describedby={notesError ? 'routine-notes-error' : undefined}
				>{form?.notes ?? ''}</textarea
			>
			{#if notesError}<FieldError id="routine-notes-error" message={notesError} />{/if}
		</div>
	</form>

	{#snippet footer()}
		<button
			type="submit"
			form="new-routine"
			class={button('primary', 'md', true)}
			aria-busy={busy}
			aria-label={busy ? 'Creating routine' : undefined}
		>
			{#if busy}<Spinner />{:else}Create routine{/if}
		</button>
	{/snippet}
</Sheet>
