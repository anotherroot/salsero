<!-- src/lib/components/video/Toast.svelte -->
<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import SwipeAway from '$lib/components/ui/SwipeAway.svelte';
	import { TOAST_ICON, type ToastTone } from '$lib/video/chrome';

	/**
	 * A short note after a save or a delete, with up to two actions; the player owns its timer.
	 * A swipe left or right takes it away (`SwipeAway`); `onhold` tells the player when a finger
	 * is on it, so its timer can wait.
	 */
	let {
		id,
		text,
		tone,
		actions = [],
		ondismiss,
		onhold
	}: {
		id: number;
		text: string;
		tone: ToastTone;
		actions?: { label: string; run: () => void }[];
		ondismiss: () => void;
		onhold?: (held: boolean) => void;
	} = $props();
	const icon = $derived(TOAST_ICON[tone]);
</script>

<SwipeAway key={id} {ondismiss} {onhold}>
	<div
		role="status"
		class="motion-rise flex min-h-[52px] items-center gap-2.5 rounded-2xl bg-inverse-bg py-1 pl-4 text-inverse-ink shadow-[0_10px_30px_rgb(0_0_0/0.5)] {actions.length
			? 'pr-1'
			: 'pr-4'}"
	>
		{#if icon}<Icon name={icon} size={22} />{/if}
		<span class="flex-1 text-[15px] leading-[1.35] font-bold tabular-nums">{text}</span>
		{#each actions as action (action.label)}
			<button
				type="button"
				class="h-11 flex-none cursor-pointer px-3 text-[15px] font-extrabold text-inverse-accent"
				onclick={action.run}>{action.label}</button
			>
		{/each}
	</div>
</SwipeAway>
