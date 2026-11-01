<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/icons/icons';
	/**
	 * "Slot 4 deleted · Undo", for six seconds. Keyed by `toast.id`, so a second
	 * toast with the same wording restarts the clock instead of inheriting the
	 * first one's.
	 *
	 * The `role="status"` region is always mounted and the message renders
	 * inside it, so a screen reader announces each new toast (a region that
	 * appears together with its text is often not announced).
	 *
	 * Inside a Sheet or Dialog pass `contained` and render it from their `toast`
	 * snippet: a modal dialog makes the page inert and draws over a toast on the
	 * page.
	 */
	interface Props {
		toast: {
			id: number;
			message: string;
			action?: string;
			/** A 22 px leading icon; `tone: 'done'` colours it the check green. */
			icon?: IconName;
			tone?: 'done';
		} | null;
		onaction?: () => void;
		ondismiss: () => void;
		/** CSS `bottom` of the toast; the default clears the tab bar when one shows (or sits 16 px up when contained). */
		bottom?: string;
		/** Absolute within its container (a dialog) instead of fixed to the viewport. */
		contained?: boolean;
	}

	let { toast, onaction, ondismiss, bottom, contained = false }: Props = $props();

	const offset = $derived(
		bottom ??
			(contained
				? '1rem'
				: 'calc(1rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)))')
	);

	$effect(() => {
		if (toast === null) return;
		// Read the id so the effect re-runs, and the timer restarts, per toast.
		void toast.id;
		const timer = setTimeout(ondismiss, 6000);
		return () => clearTimeout(timer);
	});
</script>

<div
	class="inset-x-0 z-40 mx-auto max-w-[560px] px-4 {contained ? 'absolute' : 'fixed'} {toast
		? ''
		: 'pointer-events-none'}"
	style:bottom={offset}
	role="status"
>
	{#if toast}
		<div
			class="flex min-h-[52px] items-center gap-3 rounded-2xl bg-inverse-bg py-1 pl-4 text-inverse-ink shadow-[0_10px_30px_rgb(0_0_0/0.28)] {toast.action
				? 'pr-1'
				: 'pr-4'}"
		>
			{#if toast.icon}
				<span class="flex-none {toast.tone === 'done' ? 'text-inverse-done' : 'text-inverse-ink'}"
					><Icon name={toast.icon} size={22} /></span
				>
			{/if}
			<span class="min-w-0 flex-1 text-[15px] leading-[1.35] font-semibold">{toast.message}</span>
			{#if toast.action}
				<button
					type="button"
					class="h-11 flex-none cursor-pointer px-3 text-[15px] font-extrabold text-inverse-accent"
					onclick={onaction}>{toast.action}</button
				>
			{/if}
		</div>
	{/if}
</div>
