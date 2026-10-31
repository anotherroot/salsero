<script lang="ts">
	/**
	 * "Slot 4 deleted · Undo", for six seconds. Keyed by `toast.id`, so a second
	 * toast with the same wording restarts the clock instead of inheriting the
	 * first one's.
	 */
	interface Props {
		toast: { id: number; message: string; action?: string } | null;
		onaction?: () => void;
		ondismiss: () => void;
		/** CSS `bottom` of the toast; the default clears the tab bar. */
		bottom?: string;
	}

	let {
		toast,
		onaction,
		ondismiss,
		bottom = 'calc(5rem + env(safe-area-inset-bottom))'
	}: Props = $props();

	$effect(() => {
		if (toast === null) return;
		// Read the id so the effect re-runs, and the timer restarts, per toast.
		void toast.id;
		const timer = setTimeout(ondismiss, 6000);
		return () => clearTimeout(timer);
	});
</script>

{#if toast}
	<div class="fixed inset-x-0 z-40 mx-auto max-w-[560px] px-4" style:bottom role="status">
		<div
			class="flex min-h-[52px] items-center gap-3 rounded-2xl bg-inverse-bg py-1 pl-4 text-inverse-ink shadow-[0_10px_30px_rgb(0_0_0/0.28)] {toast.action
				? 'pr-1'
				: 'pr-4'}"
		>
			<span class="min-w-0 flex-1 text-[15px] leading-[1.35] font-semibold">{toast.message}</span>
			{#if toast.action}
				<button
					type="button"
					class="h-11 flex-none cursor-pointer px-3 text-[15px] font-extrabold text-inverse-accent"
					onclick={onaction}>{toast.action}</button
				>
			{/if}
		</div>
	</div>
{/if}
