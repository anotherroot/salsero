<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';

	/**
	 * "Can you find the 1?" on a song's page (hearing drills, phase 1). Only a
	 * song a person counted opens the listening player; any other says to set
	 * the count first, since a round graded on the computer's guess would mark
	 * the person wrong for its mistake.
	 */
	interface Props {
		href: string;
		counted: boolean;
	}

	let { href, counted }: Props = $props();
	const w = $derived(t().hearing.card);
</script>

<div class="{GROUP} flex items-center gap-3 py-3 pr-3 pl-4">
	<span
		class="flex size-11 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
	>
		<Icon name="ear" size={24} />
	</span>
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="font-display text-[18px] leading-tight font-extrabold text-ink">{w.title}</span>
		<span class="text-[13px] leading-[1.35] text-muted">{counted ? w.sub : w.countFirst}</span>
	</span>
	{#if counted}
		<a {href} class={button('primary', 'md')}>{w.try}</a>
	{/if}
</div>
