<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { uploadMeta } from '$lib/songs/library';
	import type { DanceSlug } from '$lib/dances/dances';
	import { dismissUpload, upload } from '$lib/songs/upload.svelte';

	/*
	 * The song upload in flight, at the head of Being added: its name, the
	 * percent and a bar while bytes move; the server's reason and Dismiss
	 * when it failed. Only in the Music of the dance it is filed under.
	 */
	let { dance }: { dance: DanceSlug } = $props();
	const u = $derived(upload.current?.dance === dance ? upload.current : null);
	const pct = $derived(u && u.total > 0 ? Math.floor((u.loaded / u.total) * 100) : 0);
</script>

{#if u}
	<li class="pl-4">
		<div class="flex min-h-[76px] items-center gap-3 py-3 pr-4">
			<span class="flex flex-none text-accent-text"><Icon name="upload" size={24} /></span>
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<div class="flex justify-between gap-2">
					<span class="truncate text-[16px] leading-[1.3] font-bold text-ink">{u.name}</span>
					{#if u.error === null}
						<span class="flex-none text-[15px] leading-[1.3] font-extrabold text-ink tabular-nums"
							>{pct}%</span
						>
					{/if}
				</div>
				{#if u.error === null}
					<div
						role="progressbar"
						aria-label="Uploading {u.name}"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={pct}
						class="h-1.5 overflow-hidden rounded-[3px] bg-hairline"
					>
						<div
							class="h-1.5 rounded-[3px] bg-accent transition-[width] motion-reduce:transition-none"
							style:width="{pct}%"
						></div>
					</div>
					<span class="text-[13px] leading-[1.35] text-muted">{uploadMeta(u.loaded, u.total)}</span>
				{:else}
					<span class="text-[13px] leading-[1.35] font-bold text-danger" role="alert"
						>Upload failed: {u.error}</span
					>
				{/if}
			</div>
			{#if u.error !== null}
				<button type="button" class="{button('tertiary', 'sm')} -mr-2" onclick={dismissUpload}>
					Dismiss
				</button>
			{/if}
		</div>
	</li>
{/if}
