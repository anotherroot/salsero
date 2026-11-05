<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	let {
		icon,
		tone,
		title,
		body,
		code,
		actions,
		class: extra = ''
	}: {
		icon: IconName;
		tone: 'accent' | 'warn' | 'danger' | 'done';
		title: string;
		body: string;
		code?: string;
		actions?: Snippet;
		/** Extra classes for the block (desktop placement only; its look is its own). */
		class?: string;
	} = $props();

	// Written out, since Tailwind only generates classes it can see literally.
	const LOOK = {
		accent: 'bg-accent-soft text-accent-text',
		warn: 'bg-warn-soft text-warn',
		danger: 'bg-danger-soft text-danger',
		done: 'bg-done-soft text-done'
	};
</script>

<!-- A centred full-page message: an icon in a soft circle, a title, a body, actions. -->
<div class="flex flex-none flex-col items-center gap-2.5 px-5 pt-10 text-center {extra}">
	<span class="mb-1.5 flex size-20 items-center justify-center rounded-full {LOOK[tone]}">
		<Icon name={icon} size={36} />
	</span>
	{#if code}<span class="text-[12px] font-extrabold tracking-[0.08em] text-muted">{code}</span>{/if}
	<h2 class="font-display text-[22px] leading-[1.15] font-extrabold text-ink">{title}</h2>
	<p class="max-w-[290px] text-[15px] leading-[1.5] text-muted">{body}</p>
	{#if actions}<div class="mt-3.5 flex w-full flex-col items-center gap-2">
			{@render actions()}
		</div>{/if}
</div>
