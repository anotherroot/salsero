<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	/** A video that is missing or will not play: what happened, what it was, and what can be done. */
	interface Props {
		title: string;
		body: string;
		/** Which one it was, e.g. "Sunday 4 October · 12 MB". */
		meta: string;
		/** At the right of the meta row, e.g. a Download button. */
		action?: Snippet;
	}

	let { title, body, meta, action }: Props = $props();
</script>

<div class="flex flex-col gap-1.5 px-4 pt-3.5 pb-2">
	<div class="flex items-start gap-3">
		<span
			class="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-chip text-muted"
			><Icon name="video" size={22} /></span
		>
		<div class="flex min-w-0 flex-1 flex-col gap-[3px] pt-px">
			<span class="text-[16px] font-bold">{title}</span>
			<span class="text-[14px] leading-[1.4] text-ink-2">{body}</span>
		</div>
	</div>
	<div class="flex min-h-11 items-center justify-between pl-[52px]">
		<span class="text-[13px] text-muted">{meta}</span>
		{#if action}{@render action()}{/if}
	</div>
</div>
