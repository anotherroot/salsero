<script lang="ts">
	/**
	 * "Slot 4 deleted · Undo", for six seconds. Keyed by `toast.id`, so a second
	 * delete with the same wording restarts the clock instead of inheriting the
	 * first one's.
	 */
	interface Props {
		toast: { id: number; message: string } | null;
		onundo: () => void;
		ondismiss: () => void;
	}

	let { toast, onundo, ondismiss }: Props = $props();

	$effect(() => {
		if (toast === null) return;
		// Read the id so the effect re-runs, and the timer restarts, per toast.
		void toast.id;
		const timer = setTimeout(ondismiss, 6000);
		return () => clearTimeout(timer);
	});
</script>

{#if toast}
	<div
		class="fixed inset-x-0 z-40 mx-auto max-w-[560px] px-4"
		style="bottom: calc(5rem + env(safe-area-inset-bottom))"
		role="status"
	>
		<div
			class="flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-[14px] text-surface shadow-lg"
		>
			<span class="min-w-0 flex-1 truncate">{toast.message}</span>
			<button type="button" class="h-8 font-semibold text-accent" onclick={onundo}>Undo</button>
		</div>
	</div>
{/if}
