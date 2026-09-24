<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import UploadButton from '$lib/components/ui/UploadButton.svelte';
	import { clock } from '$lib/format';
	// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
	import { DANCES } from '$lib/dances/dances';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let busy = $state(false);
	let uploadStyle = $state('salsa');

	const STATUS: Record<string, string> = {
		waiting_download: 'Waiting for the home fetcher',
		waiting_analysis: 'Waiting for beat analysis',
		ready: '',
		failed: 'Failed'
	};

	/*
	 * The worker runs at home once a minute, so a waiting song changes state on
	 * its own. Poll only while something is waiting.
	 */
	const waiting = $derived(data.songs.some((s) => s.status.startsWith('waiting')));
	$effect(() => {
		if (!waiting) return;
		const t = setInterval(() => invalidateAll(), 10_000);
		return () => clearInterval(t);
	});

	// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
	const styleLabel = (s: string) => DANCES.salsa.styleLabel[s];
</script>

<svelte:head><title>Songs · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 pb-3 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
>
	<h1 class="text-[17px] font-semibold">Songs</h1>
</header>

<main class="space-y-5 px-4 pt-4 pb-4">
	<form
		method="POST"
		action="?/addUrl"
		class="space-y-2 rounded-xl border border-line bg-raised p-3"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<label for="url" class="block text-[12px] font-medium text-ink-2">Add from YouTube</label>
		<input
			id="url"
			name="url"
			type="url"
			inputmode="url"
			required
			placeholder="https://www.youtube.com/watch?v=…"
			value={form?.url ?? ''}
			class="w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent"
		/>
		<div class="flex gap-2">
			<input
				name="title"
				maxlength="200"
				placeholder="Title (optional)"
				aria-label="Title (optional)"
				class="min-w-0 flex-1 rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent"
			/>
			<select
				name="style"
				aria-label="Style"
				class="rounded-lg border border-rule bg-raised px-2 text-[15px]"
			>
				{#each DANCES.salsa.styles as s (s)}<option value={s}>{DANCES.salsa.styleLabel[s]}</option
					>{/each}
			</select>
		</div>
		{#if form?.message}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{form.message}
			</p>
		{/if}
		<button
			type="submit"
			disabled={busy}
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-60"
			>Add song</button
		>
	</form>

	<div class="flex items-start gap-2">
		<div class="min-w-0 flex-1">
			<UploadButton
				url="/api/songs"
				accept="audio/*"
				label="+ Upload an audio file"
				headers={() => ({ 'x-style': uploadStyle })}
			/>
		</div>
		<select
			bind:value={uploadStyle}
			aria-label="Style of the uploaded song"
			class="h-12 rounded-xl border border-rule bg-raised px-2 text-[15px]"
		>
			{#each DANCES.salsa.styles as s (s)}<option value={s}>{DANCES.salsa.styleLabel[s]}</option
				>{/each}
		</select>
	</div>

	<a
		href={resolve('/player?bpm=180')}
		class="block h-11 w-full rounded-xl border border-rule text-center text-[14px] leading-[2.75rem] font-medium text-ink-2"
		>Count-only drill</a
	>

	{#if data.songs.length === 0}
		<p class="text-center text-[14px] text-muted">No songs yet.</p>
	{/if}
	<ul class="space-y-2">
		{#each data.songs as s (s.id)}
			<li class="rounded-xl border border-line bg-raised">
				<a href={resolve('/songs/[id]', { id: String(s.id) })} class="block px-4 py-3">
					<span class="block truncate text-[15px] font-medium">{s.title || s.sourceUrl}</span>
					<span class="text-[12px] {s.status === 'failed' ? 'text-danger' : 'text-muted'}">
						{styleLabel(s.style)}
						{#if s.status === 'ready'}
							· {s.bpm ? `${Math.round(s.bpm * s.tempoFactor)} BPM` : ''}
							{s.durationS ? `· ${clock(s.durationS)}` : ''}
						{:else}
							· {STATUS[s.status]}{s.error ? `: ${s.error}` : ''}
						{/if}
					</span>
				</a>
				{#if s.status === 'failed'}
					<form method="POST" action="?/retry" use:enhance class="border-t border-line px-4 py-2">
						<input type="hidden" name="id" value={s.id} />
						<button type="submit" class="text-[14px] font-medium text-accent">Retry</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
	{#if waiting}
		<p class="text-center text-[12px] text-muted">
			Downloads and beat analysis run on the laptop at home, about once a minute while it is on.
		</p>
	{/if}
</main>
