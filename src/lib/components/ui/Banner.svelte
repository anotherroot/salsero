<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	let {
		kind = 'info',
		title,
		children,
		action,
		ondismiss
	}: {
		kind?: 'info' | 'warning' | 'error' | 'success';
		title?: string;
		children?: Snippet;
		action?: Snippet;
		/** Draws a bare × "Dismiss" at the right; the caller hides the banner. */
		ondismiss?: () => void;
	} = $props();

	const look: Record<string, { box: string; ink: string; icon: IconName }> = {
		info: { box: 'bg-accent-soft', ink: 'text-accent-text', icon: 'info' },
		warning: { box: 'bg-warn-soft', ink: 'text-warn', icon: 'warning' },
		error: { box: 'bg-danger-soft', ink: 'text-danger', icon: 'warning' },
		success: { box: 'bg-done-soft', ink: 'text-done', icon: 'check-circle' }
	};
	const l = $derived(look[kind]);
</script>

<div
	role={kind === 'error' ? 'alert' : 'status'}
	class="flex items-start gap-3 rounded-2xl p-3.5 {l.box}"
	class:pr-1.5={!!ondismiss}
>
	<span class="mt-px flex-none {l.ink}"><Icon name={l.icon} size={22} /></span>
	<div class="flex min-w-0 flex-1 flex-col gap-0.5 pt-px">
		{#if title}<span class="text-[15px] leading-[1.35] font-extrabold text-ink">{title}</span>{/if}
		{#if children}<div class="text-[14px] leading-[1.4] text-ink-2">{@render children()}</div>{/if}
		{#if action}<div class="mt-1 -ml-2.5 font-extrabold {l.ink}">{@render action()}</div>{/if}
	</div>
	{#if ondismiss}
		<button
			type="button"
			class="-my-2 flex size-10 flex-none cursor-pointer items-center justify-center rounded-full text-muted active:bg-step"
			aria-label="Dismiss"
			onclick={ondismiss}><Icon name="close" size={20} /></button
		>
	{/if}
</div>
