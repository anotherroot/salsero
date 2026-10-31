<script lang="ts">
	/**
	 * What opens a picker from a page: a full-width tonal button with a search
	 * icon ("Link an existing figure…"). One look for every opener.
	 */
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';

	let {
		label,
		onclick,
		disabled = false,
		...rest
	}: {
		label: string;
		onclick: () => void;
		disabled?: boolean;
		'aria-describedby'?: string;
		id?: string;
		'data-focus'?: string;
	} = $props();
</script>

<button
	type="button"
	class={button('secondary', 'md', true)}
	aria-haspopup="dialog"
	{disabled}
	{...rest}
	{onclick}><Icon name="search" size={20} />{label}</button
>
