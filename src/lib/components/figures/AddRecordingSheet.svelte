<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP } from '$lib/components/ui/styles';
	import { addVideoRow } from '$lib/figures/page';
	import { t } from '$lib/i18n/catalog';

	/**
	 * What Recordings' `+ Add` offers (figure page rework): a section of a lesson
	 * video, a video from the phone, or a link (slot 5's "Add a link"). The upload itself stays the page's
	 * (`UploadButton` with `bare`): this sheet only starts it, in the same tap that
	 * closes it, since a file chooser opens only from a user's gesture. In the
	 * Android app the video row hands over to the app's compress-and-upload.
	 */
	let {
		open,
		onclose,
		figureLabel,
		video = true,
		app = false,
		appHref = '',
		onsection,
		onvideo = () => {},
		onlink,
		uploading = false
	}: {
		open: boolean;
		onclose: () => void;
		figureLabel: string;
		/** The video-from-the-phone row. A drill holds no video of its own: false leaves it out, and the props below with it. */
		video?: boolean;
		/** Inside the Android app: the video row is the app's upload link. */
		app?: boolean;
		appHref?: string;
		onsection: () => void;
		onvideo?: () => void;
		/** Opens slot 5's "Add a link" popup. */
		onlink: () => void;
		/** A video is going up: one at a time, so the video row waits. */
		uploading?: boolean;
	} = $props();

	const videoRow = $derived(addVideoRow(uploading));
	const ROW =
		'flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-step';
</script>

{#snippet words(title: string, meta?: string)}
	<span class="flex min-w-0 flex-col gap-0.5">
		<span class="text-[16px] font-bold text-ink">{title}</span>
		{#if meta}<span class="text-[13px] text-muted">{meta}</span>{/if}
	</span>
{/snippet}

<Sheet title={t().figure.add.title(figureLabel)} size="small" {open} {onclose}>
	<div class={GROUP}>
		<button
			type="button"
			class={ROW}
			aria-haspopup="dialog"
			onclick={() => {
				onclose();
				onsection();
			}}
		>
			<span class="flex-none text-accent-text"><Icon name="scissors" size={22} /></span>
			{@render words(t().figure.add.section, t().figure.add.sectionMeta)}
		</button>
		{#if !video}
			<!-- a drill: no video row -->
		{:else if app}
			<a href={appHref} class={ROW}>
				<span class="flex-none text-accent-text"><Icon name="video" size={22} /></span>
				{@render words(t().figure.add.video, t().shell.upload.inBackground)}
			</a>
		{:else}
			<button
				type="button"
				class="{ROW} disabled:cursor-default disabled:opacity-60"
				disabled={videoRow.disabled}
				onclick={() => {
					// The chooser first, inside this tap's user activation; then the sheet goes.
					onvideo();
					onclose();
				}}
			>
				<span class="flex-none text-accent-text"><Icon name="video" size={22} /></span>
				{@render words(t().figure.add.video, videoRow.meta ?? undefined)}
			</button>
		{/if}
		<button
			type="button"
			class={ROW}
			aria-haspopup="dialog"
			onclick={() => {
				onclose();
				onlink();
			}}
		>
			<span class="flex-none text-accent-text"><Icon name="link" size={22} /></span>
			{@render words(t().figure.add.link, t().figure.add.linkMeta)}
		</button>
	</div>
</Sheet>
