<script lang="ts">
	import { resolve } from '$app/paths';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { FIELD, GROUP, LABEL, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { figureRowMeta } from '$lib/moves/list';
	import { moveSubtitle } from '$lib/moves/move-page';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const slug = $derived(data.dance.slug);

	/** The ⋯ sheet and the two it leads to share one sheet, so Back closes it once. */
	let view = $state<null | 'menu' | 'rename' | 'new'>(null);
	let busy = $state(false);

	// A refusal keeps its sheet open to show it.
	$effect(() => {
		if (form && 'message' in form && form.message) {
			view = form.action === 'createFigure' ? 'new' : 'rename';
		}
	});
	const error = $derived(form && 'message' in form && form.message ? form : null);
	const fieldError = (action: 'rename' | 'createFigure') =>
		error && error.action === action ? error.message : undefined;

	const submit =
		(close: () => void) =>
		({ cancel }: { cancel: () => void }) => {
			if (busy) return cancel();
			busy = true;
			return async ({
				update,
				result
			}: {
				update: () => Promise<void>;
				result: { type: string };
			}) => {
				await update();
				busy = false;
				if (result.type === 'success') close();
			};
		};

	const figureHref = (id: number) =>
		resolve('/[dance]/figures/[id]', { dance: slug, id: String(id) });
	const usedHref = (u: PageData['usedIn'][number]) =>
		u.kind === 'routine'
			? resolve('/[dance]/routines/[id]', { dance: slug, id: String(u.id) })
			: resolve('/[dance]/lessons/[id]', { dance: slug, id: String(u.id) });
	const title = $derived(
		view === 'rename' ? 'Rename move' : view === 'new' ? 'New figure' : data.move.name
	);
</script>

<svelte:head><title>{data.move.name} · {data.dance.label}</title></svelte:head>

<Screen title={data.move.name} subtitle={moveSubtitle(data.figures.length)}>
	{#snippet left()}
		<BackButton
			fallback={{ href: resolve('/[dance]/figures', { dance: slug }), label: 'Back to Moves' }}
		/>
	{/snippet}
	{#snippet right()}
		{#if data.canEdit}
			<BandButton focusKey="more" icon="more" label="More" onclick={() => (view = 'menu')} />
		{/if}
	{/snippet}

	<div class="flex flex-col gap-2 pb-4">
		<h2 class="{SECTION_LABEL} pt-0.5">Figures</h2>
		<ul class={GROUP}>
			{#each data.figures as f (f.id)}
				<li>
					<a
						class="flex min-h-16 items-center gap-2.5 py-[9px] pr-3.5 pl-4 active:bg-step"
						href={figureHref(f.id)}
					>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[16px] leading-[1.3] font-bold break-words text-ink">{f.name}</span>
							<span class="text-[13px] leading-[1.35] text-muted">{figureRowMeta(f)}</span>
						</span>
						<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
					</a>
				</li>
			{/each}
		</ul>

		{#if data.usedIn.length > 0}
			<h2 class="{SECTION_LABEL} pt-3.5">Used in</h2>
			<ul class={GROUP}>
				{#each data.usedIn as u (u.kind + u.id)}
					<li>
						<a
							class="flex min-h-[60px] items-center gap-2.5 py-2 pr-3.5 pl-4 active:bg-step"
							href={usedHref(u)}
						>
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-[16px] leading-tight font-bold text-ink">{u.name}</span>
								<span class="text-[13px] text-muted">{u.meta}</span>
							</span>
							<span class="flex flex-none text-chevron"
								><Icon name="chevron-right" size={20} /></span
							>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Screen>

{#if view}
	<Sheet {title} open={true} onclose={() => (view = null)}>
		{#if view === 'menu'}
			<div class={GROUP}>
				<button
					type="button"
					class="flex min-h-14 w-full items-center gap-3 py-2 pr-3.5 pl-4 text-left text-[16px] font-bold text-ink"
					onclick={() => (view = 'rename')}><Icon name="pencil" size={22} />Rename</button
				>
				<button
					type="button"
					class="flex min-h-14 w-full items-center gap-3 py-2 pr-3.5 pl-4 text-left text-[16px] font-bold text-ink"
					onclick={() => (view = 'new')}><Icon name="plus" size={22} />New figure</button
				>
			</div>
		{:else if view === 'rename'}
			<form
				id="rename-move"
				method="POST"
				action="?/rename"
				class="flex flex-col gap-3.5"
				use:guarded={{ label: 'Rename move', submit: submit(() => (view = null)) }}
			>
				<input type="hidden" name="seen" value={JSON.stringify(data.seen)} />
				<div>
					<label class={LABEL} for="move-name">Move name</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="move-name"
						name="name"
						required
						autofocus
						maxlength="200"
						value={error && error.action === 'rename' && 'name' in error
							? error.name
							: data.move.name}
						class={FIELD}
						aria-invalid={fieldError('rename') ? 'true' : undefined}
						aria-describedby={fieldError('rename') ? 'move-name-error' : undefined}
					/>
					{#if fieldError('rename')}<FieldError
							id="move-name-error"
							message={fieldError('rename')!}
						/>{/if}
				</div>
			</form>
		{:else}
			<form
				id="new-move-figure"
				method="POST"
				action="?/createFigure"
				class="flex flex-col gap-3.5"
				use:guarded={{ label: 'New figure', submit: submit(() => (view = null)) }}
			>
				<div>
					<label class={LABEL} for="figure-name">Figure name</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="figure-name"
						name="name"
						required
						autofocus
						maxlength="200"
						placeholder="e.g. Doble"
						value={error && error.action === 'createFigure' && 'name' in error ? error.name : ''}
						class={FIELD}
						aria-invalid={fieldError('createFigure') ? 'true' : undefined}
						aria-describedby={fieldError('createFigure') ? 'figure-name-error' : undefined}
					/>
					{#if fieldError('createFigure')}<FieldError
							id="figure-name-error"
							message={fieldError('createFigure')!}
						/>{/if}
				</div>
				<p class="text-[13px] text-muted">
					It starts on 1 and takes 8 counts, in the style of {data.move.name}.
				</p>
			</form>
		{/if}

		{#snippet footer()}
			{#if view !== 'menu'}
				<button
					type="submit"
					form={view === 'rename' ? 'rename-move' : 'new-move-figure'}
					class={button('primary', 'md', true)}
					aria-busy={busy}
				>
					{#if busy}<Spinner />{:else}{view === 'rename' ? 'Save' : 'Add figure'}{/if}
				</button>
			{/if}
		{/snippet}
	</Sheet>
{/if}
