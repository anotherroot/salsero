<script lang="ts">
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button, CLIP, TICK } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { SuggestionAction } from '$lib/types';
	import DiffText from './DiffText.svelte';
	import SectionPreview from './SectionPreview.svelte';

	/**
	 * One action of the AI's queue: its number and title (the AI's), then each
	 * change as the app words it, and Drop · Up to here · Run (option A2).
	 */
	let {
		action,
		busy = false,
		onrun,
		onupto,
		ondrop,
		ontoggle,
		onundo
	}: {
		action: SuggestionAction;
		busy?: boolean;
		onrun: () => void;
		onupto: () => void;
		ondrop: () => void;
		ontoggle: (lineId: number) => void;
		onundo: (lineIds: number[]) => void;
	} = $props();

	const w = $derived(t().suggestions);
	const batched = $derived(action.lines.length > 1);
	const runnable = $derived(action.lines.filter((l) => l.status === 'pending').length);
	const undoable = $derived(action.lines.filter((l) => l.canUndo).map((l) => l.id));
	const pending = $derived(action.state === 'pending' || action.state === 'partly');
</script>

<article
	class="{CLIP} rounded-2xl bg-surface"
	class:opacity-60={action.state === 'dropped'}
	data-focus="suggestion-{action.id}"
>
	<header class="flex items-start gap-2.5 px-4 pt-3.5 pb-1.5">
		{#if action.state === 'done'}
			<span class="mt-0.5 flex flex-none text-done"><Icon name="check" size={22} /></span>
		{:else}
			<span
				class="mt-0.5 flex size-[22px] flex-none items-center justify-center rounded-full bg-chip text-[12px] font-extrabold text-chip-ink"
				>{action.n}</span
			>
		{/if}
		<div class="min-w-0 flex-1">
			<h3 class="text-[16px] leading-snug font-bold text-ink">{action.title}</h3>
			{#if action.changed}
				<p class="mt-1 text-[12px] font-bold text-easy">
					{action.changed.line} · {w.earlier}: {action.changed.previousTitle}
				</p>
			{/if}
		</div>
	</header>

	<ul class="flex flex-col gap-2 px-4 pb-3 pl-[48px]">
		{#each action.lines as line (line.id)}
			<li class="flex flex-col gap-1.5" class:opacity-50={line.status === 'left_out'}>
				<div class="flex items-start gap-2.5">
					{#if batched && (line.status === 'pending' || line.status === 'left_out')}
						<input
							type="checkbox"
							class="{TICK} mt-0.5"
							checked={line.status === 'pending'}
							aria-label={w.leaveOut(line.heading)}
							disabled={busy}
							onchange={() => ontoggle(line.id)}
						/>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="text-[14px] font-bold text-ink-2">
							{line.heading}{#if line.status === 'left_out'}<span class="font-normal text-muted">
									· {w.leftOut}</span
								>{/if}
						</p>
						{#if line.where}<p class="text-[12px] font-bold text-muted">{line.where}</p>{/if}
					</div>
				</div>
				{#each line.fields as f (f.label)}
					<p>
						<span class="text-[12px] font-bold text-muted">{f.label}</span><br /><DiffText
							parts={f.parts}
						/>
					</p>
				{/each}
				{#if line.section}
					<SectionPreview
						src={line.section.src}
						startMs={line.section.startMs}
						endMs={line.section.endMs}
					/>
				{/if}
				{#if line.warning}<Banner kind="warning" title={line.warning} />{/if}
				{#if line.refusal}<Banner kind="error" title={line.refusal} />{/if}
			</li>
		{/each}
	</ul>

	{#if pending}
		<footer class="flex flex-wrap items-center gap-2 border-t border-hairline px-3 py-2.5">
			<button type="button" class={button('tertiary', 'sm')} disabled={busy} onclick={ondrop}>
				{w.drop}
			</button>
			{#if action.waitsFor.length}
				<span class="ml-auto flex items-center gap-1 text-[13px] font-bold text-muted">
					<Icon name="clock" size={16} />{w.waitsFor(action.waitsFor[0])}
				</span>
			{:else}
				<button type="button" class={button('secondary', 'sm')} disabled={busy} onclick={onupto}>
					{w.upToHere}
				</button>
				<span class="flex-1"></span>
				<button
					type="button"
					class={button('primary', 'sm')}
					disabled={busy || !runnable}
					onclick={onrun}
				>
					{batched ? w.runN(runnable) : w.run}
				</button>
			{/if}
		</footer>
	{:else if undoable.length}
		<footer class="flex items-center border-t border-hairline px-3 py-2 pl-4">
			<span class="flex-1 text-[13px] text-muted">{w.ran(undoable.length)}</span>
			<button
				type="button"
				class={button('tertiary', 'sm')}
				disabled={busy}
				onclick={() => onundo(undoable)}
			>
				{w.undo}
			</button>
		</footer>
	{/if}
</article>
