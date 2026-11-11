<script lang="ts">
	import { untrack } from 'svelte';
	import { COUNTS_PER_EIGHT, MAX_LENGTH_COUNTS } from '$lib/graph/timing';
	import { lengthError, startsLine } from '$lib/figures/page';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { SHORTCUT, FIELD, LABEL } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';

	/**
	 * Which counts a variation can begin on, how many counts it takes, and
	 * whether a routine sets that length instead (spec 2026-11-11, board 1).
	 * All its own — a variation holds everything it is.
	 *
	 * Posts one `startCount` per count that is on, `lengthCounts`, `lengthFree`
	 * when You choose is on, and `timingSet` so the server knows this form sent
	 * the set (an older page sends one `startCount` alone).
	 *
	 * Seeds its own state once, like `PositionTags`, so key it on the
	 * variation's id wherever it is rendered.
	 */
	let {
		startCounts,
		lengthCounts,
		lengthFree
	}: {
		startCounts: number[];
		lengthCounts: number;
		lengthFree: boolean;
	} = $props();

	const all = Array.from({ length: COUNTS_PER_EIGHT }, (_, i) => i + 1);
	let on = $state(untrack(() => [...startCounts].sort((a, b) => a - b)));
	let length = $state(untrack(() => String(lengthCounts)));
	let free = $state(untrack(() => lengthFree));
	/** The check speaks only once the field has been typed in; it never blocks Save. */
	let touched = $state(false);
	const error = $derived(touched ? lengthError(length) : null);
	const everything = $derived(on.length === COUNTS_PER_EIGHT);

	/** Tap a count on or off. The last one on stays: a figure starts somewhere. */
	function toggle(n: number) {
		if (on.includes(n)) {
			if (on.length > 1) on = on.filter((x) => x !== n);
		} else on = [...on, n].sort((a, b) => a - b);
	}

	const shortcuts = ['4', '8', '16'];
	const uid = $props.id();
</script>

<input type="hidden" name="timingSet" value="1" />
{#each on as n (n)}
	<input type="hidden" name="startCount" value={n} />
{/each}
{#if free}
	<input type="hidden" name="lengthFree" value="1" />
{/if}

<div role="group" aria-labelledby="{uid}-starts">
	<div class="flex items-baseline justify-between gap-3">
		<span id="{uid}-starts" class={LABEL}>{t().figure.length.canStartOn}</span>
		<button
			type="button"
			onclick={() => (on = everything ? [1] : [...all])}
			class="text-[13px] font-bold text-accent-text"
			>{everything ? t().figure.length.onlyOne : t().figure.length.all}</button
		>
	</div>
	<div class="flex gap-1">
		{#each all as n (n)}
			<button
				type="button"
				aria-pressed={on.includes(n)}
				aria-label={t().figure.length.count(n)}
				onclick={() => toggle(n)}
				class="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl bg-surface text-[16px] font-extrabold text-ink shadow-[inset_0_0_0_1px_var(--color-field-line)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-pressed:bg-accent aria-pressed:text-on-accent aria-pressed:shadow-none"
				>{n}</button
			>
		{/each}
	</div>
	<p class="mt-1.5 pl-1 text-[13px] text-muted" aria-live="polite">{startsLine(on)}</p>
</div>

<div>
	<label class={LABEL} for="{uid}-length">{t().figure.length.counts}</label>
	<div class="relative">
		<input
			id="{uid}-length"
			type="text"
			inputmode="numeric"
			name="lengthCounts"
			required
			bind:value={length}
			oninput={() => (touched = true)}
			class="{FIELD} pr-[76px]"
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${uid}-length-error` : `${uid}-length-help`}
		/>
		<span
			class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] font-semibold text-muted"
			aria-hidden="true">{t().figure.length.unit}</span
		>
	</div>
	{#if error}
		<FieldError id="{uid}-length-error" message={error} />
	{:else}
		<p id="{uid}-length-help" class="mt-1.5 pl-1 text-[13px] text-muted">
			{free
				? t().figure.length.youChooseHint(Number(length) || lengthCounts)
				: t().figure.length.help(MAX_LENGTH_COUNTS)}
		</p>
	{/if}
	<div class="mt-1 flex flex-wrap gap-2" role="group" aria-label={t().figure.length.shortcuts}>
		<button type="button" aria-pressed={free} onclick={() => (free = !free)} class={SHORTCUT}
			>{t().figure.length.youChoose}</button
		>
		{#each shortcuts as n (n)}
			<button
				type="button"
				aria-pressed={length.trim() === n}
				aria-label={t().nouns.counts(Number(n))}
				onclick={() => (length = n)}
				class={SHORTCUT}>{n}</button
			>
		{/each}
	</div>
</div>
