<script lang="ts">
	import { enhance } from '$app/forms';

	/**
	 * Pick one of a list and post it to a form action. Used for both of a
	 * lesson's link lists, which differ only in what they are called.
	 */
	interface Props {
		action: string;
		/** The form field the chosen id is posted as. */
		name: string;
		items: { id: number; name: string }[];
		label: string;
		/** What to say when there is nothing left to pick. */
		empty: string;
	}

	let { action, name, items, label, empty }: Props = $props();
	let chosen = $state('');

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
</script>

{#if items.length === 0}
	<p class="mt-3 text-[13px] text-muted">{empty}</p>
{:else}
	<form
		method="POST"
		{action}
		class="mt-3 flex gap-2"
		use:enhance={() =>
			async ({ update }) => {
				await update();
				chosen = '';
			}}
	>
		<select {name} bind:value={chosen} aria-label={label} class="{field} flex-1">
			<option value="" disabled>{label}</option>
			{#each items as item (item.id)}
				<option value={item.id}>{item.name}</option>
			{/each}
		</select>
		<button
			type="submit"
			disabled={chosen === ''}
			class="h-11 shrink-0 rounded-xl border border-rule px-4 text-[14px] font-medium disabled:opacity-40"
			>Link</button
		>
	</form>
{/if}
