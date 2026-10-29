<!-- src/lib/components/video/Toast.svelte -->
<script lang="ts">
	/** A short note after a save or a delete, with up to two actions; the player owns its timer. */
	let { text, actions = [] }: { text: string; actions?: { label: string; run: () => void }[] } =
		$props();
</script>

<div
	role="status"
	class="flex min-h-12 items-center gap-2 rounded-2xl bg-(--pl-ink) py-1 pr-1.5 pl-4 text-[14px] text-(--pl-bg) shadow-[0_8px_24px_rgb(0_0_0/0.5)]"
>
	<span class="flex-1">{text}</span>
	{#each actions as action (action.label)}
		<button
			type="button"
			class="h-10 cursor-pointer rounded-xl px-3 font-bold underline underline-offset-2"
			onclick={action.run}>{action.label}</button
		>
	{/each}
</div>
