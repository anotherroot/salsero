<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import UploadButton from '$lib/components/ui/UploadButton.svelte';
	import { PARTNER_LABEL, STYLE_LABEL } from '$lib/labels';
	import { frequencyLabel } from '$lib/frequency';
	import { dateLabel } from '$lib/format';
	import { localDay } from '$lib/day/day';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	let logged = $state(false);
	/**
	 * Recordings whose player failed, and why. "missing" means the server has no
	 * file; "unplayable" means the file is there but this browser cannot decode
	 * it — typically an iPhone HEVC .mov opened in desktop Chrome — so it is
	 * offered as a download instead of being reported as lost.
	 */
	let broken = $state<Record<number, 'missing' | 'unplayable'>>({});

	async function diagnose(id: number, file: string) {
		const res = await fetch(`/recordings/${file}`, { headers: { range: 'bytes=0-0' } }).catch(
			() => null
		);
		broken = { ...broken, [id]: res?.status === 404 ? 'missing' : 'unplayable' };
	}

	/*
	 * An attachment rather than `onerror`: the player is server-rendered and
	 * starts loading before hydration, so a fast failure can fire its error
	 * event before any handler exists. Checking `el.error` on mount catches it.
	 */
	function watchMedia(id: number, file: string) {
		return (el: HTMLMediaElement) => {
			const fail = () => diagnose(id, file);
			if (el.error) fail();
			el.addEventListener('error', fail);
			return () => el.removeEventListener('error', fail);
		};
	}

	const figure = $derived(data.figure);
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const failure = $derived(form && 'message' in form ? form.message : null);
</script>

<svelte:head><title>{figure.name} · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/figures')}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to figures">‹</a
	>
	<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{figure.name}</h1>
	<button
		type="button"
		class="h-10 rounded-lg px-3 text-[14px] font-medium text-accent"
		onclick={() => (editing = !editing)}>{editing ? 'Done' : 'Edit'}</button
	>
</header>

<main class="space-y-6 px-4 pt-4 pb-4">
	{#if editing}
		<form
			method="POST"
			action="?/update"
			class="space-y-3"
			use:enhance={() =>
				async ({ update, result }) => {
					await update({ reset: false });
					if (result.type === 'success') editing = false;
				}}
		>
			<FigureFields
				name={figure.name}
				partner={figure.partner}
				style={figure.style}
				notes={figure.notes}
				callable={figure.callable}
				callText={figure.callText}
			/>
			{#if failure}
				<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
					{failure}
				</p>
			{/if}
			<button
				type="submit"
				class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
				>Save</button
			>
		</form>
		<form
			method="POST"
			action="?/archive"
			onsubmit={(e) => {
				if (!confirm(`Archive “${figure.name}”? Its practice history and recordings are kept.`)) {
					e.preventDefault();
				}
			}}
		>
			<button type="submit" class="h-11 w-full rounded-xl text-[14px] text-danger"
				>Archive figure</button
			>
		</form>
	{:else}
		<section>
			<p class="text-[13px] text-muted">
				{STYLE_LABEL[figure.style]} · {PARTNER_LABEL[figure.partner]}
			</p>
			{#if figure.notes}
				<p class="mt-2 text-[15px] whitespace-pre-line">{figure.notes}</p>
			{/if}
		</section>

		{#if data.exercise}
			<section class="flex items-center gap-3 rounded-xl border border-line bg-raised p-3">
				<div class="min-w-0 flex-1">
					<p class="text-[14px] font-medium">Practice</p>
					<p class="text-[12px] text-muted">
						{frequencyLabel(data.exercise.everyDays)}{data.exercise.active ? '' : ' · inactive'} ·
						<a href={resolve('/')} class="text-accent">settings on Today</a>
					</p>
				</div>
				<form
					method="POST"
					action="?/log"
					use:enhance={() =>
						async ({ update, result }) => {
							await update();
							if (result.type === 'success') {
								logged = true;
								setTimeout(() => (logged = false), 2000);
							}
						}}
				>
					<button
						type="submit"
						class="h-11 rounded-xl px-4 text-[14px] font-semibold {logged
							? 'bg-done-bg text-done'
							: 'bg-accent text-accent-ink'}">{logged ? 'Logged ✓' : 'Log set'}</button
					>
				</form>
			</section>
		{/if}
	{/if}

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Recordings</h2>
		<ul class="space-y-3">
			{#each data.recordings as rec (rec.id)}
				<li class="overflow-hidden rounded-xl border border-line bg-raised">
					{#if broken[rec.id] === 'missing'}
						<p class="p-4 text-[13px] text-muted">The file for this recording is missing.</p>
					{:else if broken[rec.id] === 'unplayable'}
						<p class="p-4 text-[13px] text-muted">
							This browser can't play this file.
							<a
								href={resolve('/recordings/[file]', { file: rec.file })}
								download
								class="font-medium text-accent">Download it</a
							>
							or open it on your phone.
						</p>
					{:else if rec.kind === 'video'}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							src="/recordings/{rec.file}"
							controls
							playsinline
							preload="metadata"
							class="aspect-video w-full bg-black"
							{@attach watchMedia(rec.id, rec.file)}
						></video>
					{:else}
						<audio
							src="/recordings/{rec.file}"
							controls
							preload="metadata"
							class="w-full p-2"
							{@attach watchMedia(rec.id, rec.file)}
						></audio>
					{/if}
					<div class="flex items-center justify-between px-3 py-2 text-[12px] text-muted">
						<span
							>{dateLabel(localDay(rec.createdAt, timezone))} · {Math.max(
								1,
								Math.round(rec.sizeBytes / 1024 / 1024)
							)} MB</span
						>
						<form
							method="POST"
							action="?/deleteRecording"
							use:enhance
							onsubmit={(e) => {
								if (!confirm('Delete this recording?')) e.preventDefault();
							}}
						>
							<input type="hidden" name="recordingId" value={rec.id} />
							<button type="submit" class="h-9 px-2 text-danger">Delete</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
		<div class="mt-3">
			<UploadButton
				url="/api/figures/{figure.id}/recordings"
				accept="video/*,audio/*"
				label="+ Add video or audio"
			/>
		</div>
	</section>
</main>
