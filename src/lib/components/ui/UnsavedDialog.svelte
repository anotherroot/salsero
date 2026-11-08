<script lang="ts">
	import { tick } from 'svelte';
	import { prompt } from '$lib/unsaved/guard.svelte';
	import { t } from '$lib/i18n/catalog';
	import Icon from './Icon.svelte';
	import { button } from './styles';

	/*
	 * The one "you have unsaved changes" question, for a navigation and for a
	 * sheet closing alike. Save sends the real form(s) and waits for the
	 * server's answer before offering the way out; it never leaves on its own.
	 * Mounted once, in the root layout. A modal opened after a sheet stacks
	 * above it, so this sits on top of whatever asked.
	 */

	let dialog: HTMLDialogElement | undefined = $state();
	let phase = $state<'ask' | 'saving' | 'saved' | 'failed'>('ask');
	let messages = $state<string[]>([]);

	const ask = $derived(prompt.ask);
	/** "Position name (2)": several rows of one kind read as one line, with a count. */
	const labels = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const e of ask?.entries ?? []) counts[e.label] = (counts[e.label] ?? 0) + 1;
		return Object.entries(counts).map(([label, n]) => (n > 1 ? `${label} (${n})` : label));
	});
	const plural = $derived((ask?.entries.length ?? 0) > 1);
	const savable = $derived(ask?.entries.some((e) => e.save) ?? false);
	/** Why Save cannot run yet (the count is still playing); it clears when that stops. */
	const blocked = $derived(ask?.entries.map((e) => e.blocked?.()).find((b) => b) ?? null);

	$effect(() => {
		if (!dialog) return;
		if (ask && !dialog.open) {
			phase = 'ask';
			messages = [];
			dialog.showModal();
		}
		if (!ask && dialog.open) dialog.close();
	});

	function stay() {
		prompt.ask = null;
	}

	function leave() {
		const a = prompt.ask;
		prompt.ask = null;
		a?.onleave();
	}

	async function save() {
		const a = prompt.ask;
		if (!a) return;
		phase = 'saving';
		const failed: string[] = [];
		let moved = false;
		for (const e of a.entries) {
			if (!e.save || !e.dirty()) continue;
			const o = await e.save();
			if (o.ok) {
				moved ||= o.moved === true;
				continue;
			}
			if ('invalid' in o) {
				// The form's own checks (an empty required name) stopped it before
				// it was sent. Back to the form, and let the browser point.
				prompt.ask = null;
				await tick();
				o.invalid.reportValidity();
				return;
			}
			failed.push(o.message);
		}
		if (prompt.ask !== a) return;
		// A sheet whose save redirected is already gone with its page: there is
		// nothing left to stay on or close.
		if (moved && a.scoped && failed.length === 0) {
			prompt.ask = null;
			return;
		}
		messages = failed;
		phase = failed.length > 0 ? 'failed' : 'saved';
	}

	const primary = button('primary', 'md', true);
	const secondary = button('secondary', 'sm', true);
	const danger = button('danger-text', 'sm', true);
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="unsaved-title"
	onclose={() => {
		// Escape, or `stay()` closing it: either way the question is over.
		if (prompt.ask) prompt.ask = null;
	}}
	oncancel={(e) => {
		if (phase === 'saving') e.preventDefault();
	}}
	onclick={(e) => {
		if (e.target === dialog && phase !== 'saving') stay();
	}}
>
	{#if ask}
		<div class="p-6">
			{#if phase === 'saved'}
				<span
					class="mb-3 flex size-10 items-center justify-center rounded-xl bg-done-soft text-done"
					aria-hidden="true"><Icon name="check" size={22} /></span
				>
				<h2
					id="unsaved-title"
					class="font-display text-[22px] leading-tight font-extrabold text-ink"
				>
					{t().shell.unsaved.saved}
				</h2>
				<p class="mt-2 text-[15px] leading-[1.45] text-ink-2">{labels.join(', ')}.</p>
				<div class="mt-5 space-y-2">
					<button type="button" class={primary} onclick={leave}>{ask.verb}</button>
					<button type="button" class={secondary} onclick={stay}>{t().shell.unsaved.stay}</button>
				</div>
			{:else if phase === 'failed'}
				<span
					class="mb-3 flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger"
					aria-hidden="true"><Icon name="warning" size={22} /></span
				>
				<h2
					id="unsaved-title"
					class="font-display text-[22px] leading-tight font-extrabold text-ink"
				>
					{t().shell.unsaved.notSaved}
				</h2>
				<p class="mt-2 text-[15px] leading-[1.45] text-ink-2">{labels.join(', ')}.</p>
				<div class="mt-2 space-y-1" role="alert">
					{#each messages as m, i (i)}
						<div
							class="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[14px] font-bold text-danger"
						>
							<span class="mt-px flex-none"><Icon name="warning" size={18} /></span><span>{m}</span>
						</div>
					{/each}
				</div>
				<div class="mt-5 space-y-2">
					<button type="button" class={primary} onclick={stay}
						>{t().shell.unsaved.stayAndFix}</button
					>
					<button type="button" class={danger} onclick={leave}
						>{t().shell.unsaved.without(ask.verb)}</button
					>
				</div>
			{:else}
				<span
					class="mb-3 flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text"
					aria-hidden="true"><Icon name="edit" size={22} /></span
				>
				<h2
					id="unsaved-title"
					class="font-display text-[22px] leading-tight font-extrabold text-ink"
				>
					{t().shell.unsaved.title}
				</h2>
				<p class="mt-2 text-[15px] leading-[1.45] text-ink-2">
					{t().shell.unsaved.line(labels.join(', '), plural)}
				</p>
				{#if blocked}
					<p class="mt-2 text-[13px] text-muted">{blocked}</p>
				{/if}
				<div class="mt-5 space-y-2">
					{#if savable}
						<button
							type="button"
							class={primary}
							disabled={phase === 'saving' || blocked !== null}
							onclick={save}
							>{phase === 'saving' ? t().shell.unsaved.saving : t().common.save}</button
						>
					{/if}
					<button type="button" class={secondary} disabled={phase === 'saving'} onclick={stay}
						>{t().shell.unsaved.stay}</button
					>
					<button type="button" class={danger} disabled={phase === 'saving'} onclick={leave}
						>{t().shell.unsaved.without(ask.verb)}</button
					>
				</div>
			{/if}
		</div>
	{/if}
</dialog>

<style>
	dialog {
		margin: auto;
		width: calc(100% - 32px);
		max-width: 380px;
		padding: 0;
		border: none;
		border-radius: 22px;
		background: var(--color-raised);
		color: var(--color-ink);
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.3);
	}
</style>
