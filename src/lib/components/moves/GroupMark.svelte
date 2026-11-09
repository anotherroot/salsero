<script lang="ts">
	/**
	 * A group's row in a list of the person's own (Lessons, Figures, Routines,
	 * Positions): the group's icon and name, under the row's title.
	 */
	import Icon from '$lib/components/ui/Icon.svelte';

	let { name }: { name: string } = $props();
</script>

<span class="flex items-center gap-1 text-[13px] font-bold text-accent-text"
	><Icon name="people" size={16} />{name}</span
>
