<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP } from '$lib/components/ui/styles';

	/**
	 * What Recordings' `+ Add` offers (figure page rework): a section of a lesson
	 * video, or a video from the phone. The upload itself stays the page's
	 * (`UploadButton` with `bare`): this sheet only starts it, in the same tap that
	 * closes it, since a file chooser opens only from a user's gesture. In the
	 * Android app the video row hands over to the app's compress-and-upload.
	 */
	let {
		open,
		onclose,
		figureLabel,
		app,
		appHref,
		onsection,
		onvideo
	}: {
		open: boolean;
		onclose: () => void;
		figureLabel: string;
		/** Inside the Android app: the video row is the app's upload link. */
		app: boolean;
		appHref: string;
		onsection: () => void;
		onvideo: () => void;
	} = $props();

	const ROW =
		'flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-step';
</script>

{#snippet words(title: string, meta?: string)}
	<span class="flex min-w-0 flex-col gap-0.5">
		<span class="text-[16px] font-bold text-ink">{title}</span>
		{#if meta}<span class="text-[13px] text-muted">{meta}</span>{/if}
	</span>
{/snippet}

<Sheet title="Add to {figureLabel}" size="small" {open} {onclose}>
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
			{@render words('Link a section', 'A part of a lesson video')}
		</button>
		{#if app}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- an app link, not a route -->
			<a href={appHref} class={ROW}>
				<span class="flex-none text-accent-text"><Icon name="video" size={22} /></span>
				{@render words('Video from the phone', 'Compressed and uploaded in the background')}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<button
				type="button"
				class={ROW}
				onclick={() => {
					// The chooser first, inside this tap's user activation; then the sheet goes.
					onvideo();
					onclose();
				}}
			>
				<span class="flex-none text-accent-text"><Icon name="video" size={22} /></span>
				{@render words('Video from the phone')}
			</button>
		{/if}
	</div>
</Sheet>
