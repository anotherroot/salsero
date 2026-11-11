<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { FIELD, LABEL, button } from '$lib/components/ui/styles';
	import { fitsLength, lengthChoices } from '$lib/routines/fit';
	import { isLengthCounts, MAX_LENGTH_COUNTS } from '$lib/graph/timing';
	import { t } from '$lib/i18n/catalog';

	/**
	 * How long? — a figure whose length the routine sets (spec 2026-11-11, board
	 * C). Eight big buttons; one tap picks. A length that would leave the next
	 * slot on another count than `want` (the slot's other options) is greyed,
	 * with one line saying why. `current` shows pressed (changing it from the
	 * slot's chip), else `pre` (the shortest that lands where the slot below
	 * starts).
	 */
	let {
		open,
		figure,
		start,
		want = null,
		current = null,
		pre = null,
		onpick,
		onclose
	}: {
		open: boolean;
		figure: string;
		start: number;
		want?: number | null;
		current?: number | null;
		pre?: number | null;
		onpick: (n: number) => void;
		onclose: () => void;
	} = $props();

	const choices = $derived(lengthChoices(start, want));
	const lit = $derived(current ?? pre);
	let other = $state(false);
	let typed = $state('');
	const typedN = $derived(Number(typed.trim()));
	const typedOk = $derived(
		typed.trim() !== '' && isLengthCounts(typedN) && fitsLength(start, typedN, want)
	);
	const uid = $props.id();

	$effect(() => {
		if (!open) {
			other = false;
			typed = '';
		}
	});
</script>

<Sheet
	{open}
	{onclose}
	title={t().routine.length.title}
	sub={t().routine.length.from(figure, start)}
	size="small"
>
	<div class="grid grid-cols-4 gap-2">
		{#each choices as c (c.n)}
			<button
				type="button"
				disabled={!c.ok}
				aria-pressed={lit === c.n}
				onclick={() => onpick(c.n)}
				class="flex h-16 cursor-pointer flex-col items-center justify-center rounded-[14px] bg-surface text-[22px] leading-none font-extrabold text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:bg-disabled-bg disabled:text-disabled-ink aria-pressed:bg-accent aria-pressed:text-on-accent"
				>{c.n}<span class="mt-1 text-[11px] font-semibold opacity-80"
					>{t().routine.length.unit(c.n)}</span
				></button
			>
		{/each}
		<button
			type="button"
			aria-expanded={other}
			onclick={() => (other = !other)}
			class="flex h-16 cursor-pointer items-center justify-center rounded-[14px] bg-surface text-[16px] font-extrabold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-expanded:bg-accent-soft"
			>{t().routine.length.other}</button
		>
	</div>
	{#if want !== null && choices.some((c) => !c.ok)}
		<p class="mt-3 text-[13px] text-muted">{t().routine.length.why(want)}</p>
	{/if}
	{#if other}
		<div class="mt-4 flex items-end gap-2">
			<div class="min-w-0 flex-1">
				<label class={LABEL} for="{uid}-other">{t().routine.length.otherLabel}</label>
				<input
					id="{uid}-other"
					type="text"
					inputmode="numeric"
					bind:value={typed}
					onkeydown={(e) => {
						if (e.key === 'Enter' && typedOk) onpick(typedN);
					}}
					class={FIELD}
					aria-describedby="{uid}-other-help"
				/>
				<p id="{uid}-other-help" class="mt-1.5 pl-1 text-[13px] text-muted">
					{t().figure.length.help(MAX_LENGTH_COUNTS)}
				</p>
			</div>
			<div class="mb-[26px]">
				<button
					type="button"
					disabled={!typedOk}
					class={button('primary')}
					onclick={() => onpick(typedN)}>{t().routine.length.done}</button
				>
			</div>
		</div>
	{/if}
</Sheet>
