<script lang="ts">
	/**
	 * Where is this video (offline phase 4c, look 1B): this phone (the
	 * original, its size, plays from here) and the server (not uploaded, with
	 * Upload; or the copy and its size, with Remove). Remove is only for the
	 * device holding the original; a missing original offers neither.
	 */
	import Sheet from './Sheet.svelte';
	import Icon from './Icon.svelte';
	import { GROUP, ROW, button } from './styles';
	import { byteSize } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import { messageFromBody } from '$lib/upload-error';
	import { kept, syncNow } from '$lib/offline/device.svelte';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { uploadOriginal } from '$lib/offline/upload-original';
	import type { Place } from '$lib/offline/where';
	import { appOriginals, type PhoneVideo } from '$lib/offline/places.svelte';
	import { uploadNote } from '$lib/offline/where-view';

	let {
		open,
		onclose,
		place,
		video,
		onsay
	}: {
		open: boolean;
		onclose: () => void;
		place: Place;
		video: PhoneVideo;
		/** A toast's words (the button owns the toast): done or failed. */
		onsay: (message: string, done?: boolean) => void;
	} = $props();

	const w = $derived(t().video.place);
	const originalSize = $derived(byteSize(video.originBytes ?? video.sizeBytes));
	let busy = $state(false);

	function upload() {
		onclose();
		void uploadOriginal({ table: video.table, id: video.id, file: video.file }).then((out) => {
			if (out.ok) void refreshWhenSettled();
			else onsay(out.reason ?? w.uploadFailed);
		});
	}

	async function remove() {
		busy = true;
		try {
			const base = video.table === 'recordings' ? 'recordings' : 'lesson-videos';
			const res = await fetch(`/api/${base}/${video.id}/server-copy`, {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ slot: kept.status?.slot ?? null })
			});
			if (res.ok) {
				onclose();
				onsay(w.removeDone, true);
				void syncNow();
				void refreshWhenSettled();
			} else onsay(messageFromBody(await res.text()) || w.uploadFailed);
		} catch {
			onsay(t().shell.offline.needsConnection);
		} finally {
			busy = false;
		}
	}
</script>

{#snippet words(title: string, meta: string, tone = 'text-muted')}
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="text-[16px] font-bold text-ink">{title}</span>
		<span class="text-[13px] {tone}">{meta}</span>
	</span>
{/snippet}

<Sheet title={w.sheetTitle} size="small" {open} {onclose}>
	<div class={GROUP} data-where-sheet>
		<div class={ROW}>
			<span
				class="flex size-10 flex-none items-center justify-center rounded-xl {place.state ===
				'missing'
					? 'bg-danger-soft text-danger'
					: 'bg-done-soft text-done'}"
				><Icon name={place.state === 'missing' ? 'phone' : 'phone-check'} size={20} /></span
			>
			{#if place.state === 'missing'}
				{@render words(
					w.thisPhone,
					place.gallery ? w.missingGallery : w.missingHere,
					'font-bold text-danger'
				)}
			{:else}
				{@render words(w.thisPhone, w.original(originalSize))}
				<span class="flex flex-none text-done"><Icon name="check" size={22} /></span>
			{/if}
		</div>
		<div class={ROW}>
			<span
				class="flex size-10 flex-none items-center justify-center rounded-xl {video.serverCopy
					? 'bg-done-soft text-done'
					: 'bg-accent-soft text-accent-text'}"
				><Icon name={video.serverCopy ? 'cloud-check' : 'cloud'} size={20} /></span
			>
			{#if video.serverCopy}
				{@render words(w.server, w.copy(byteSize(video.sizeBytes)))}
				{#if place.state === 'both'}
					<button
						type="button"
						class={button('secondary', 'sm')}
						disabled={busy}
						onclick={() => void remove()}>{w.remove}</button
					>
				{/if}
			{:else}
				{@render words(w.server, w.notUploaded)}
				{#if place.state === 'only'}
					<button type="button" class={button('primary', 'sm')} onclick={upload}>{w.upload}</button>
				{/if}
			{/if}
		</div>
	</div>
	{#if place.state !== 'missing'}
		<p class="mt-3 px-1 text-[13px] font-medium text-muted">
			{uploadNote(appOriginals.android)}
		</p>
	{/if}
</Sheet>
