<script lang="ts">
	import Icon from './Icon.svelte';

	/**
	 * The pill search field: a magnifier, the input, and a Clear button while
	 * there is something to clear. The pill draws the focus ring, not the input.
	 * Put it in a `<form role="search">`; submitting is the form's business.
	 */
	let {
		name,
		value = $bindable(''),
		placeholder,
		label,
		onclear
	}: {
		name: string;
		value?: string;
		placeholder: string;
		label?: string;
		onclear: () => void;
	} = $props();

	const id = $props.id();
	let input = $state<HTMLInputElement>();

	function clear() {
		value = '';
		input?.focus();
		onclear();
	}
</script>

<div
	class="flex h-11 flex-none items-center gap-2.5 rounded-full bg-surface pl-4 text-muted shadow-[inset_0_0_0_1px_var(--color-hairline)] focus-within:shadow-[0_0_0_2px_var(--color-accent),0_0_0_6px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]"
	class:pr-4={!value}
>
	<Icon name="search" size={20} />
	<label class="sr-only" for={id}>{label ?? placeholder}</label>
	<input
		{id}
		{name}
		type="search"
		bind:value
		bind:this={input}
		{placeholder}
		autocomplete="off"
		class="h-10 min-w-0 flex-1 bg-transparent p-0 font-sans text-[16px] font-medium text-ink outline-none placeholder:text-muted focus-visible:shadow-none! focus-visible:outline-none! [&::-webkit-search-cancel-button]:appearance-none"
	/>
	{#if value}
		<!-- The 44 px square is the hit area; the 36 px disc is what presses. -->
		<button
			type="button"
			aria-label="Clear search"
			class="group flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full"
			onclick={clear}
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full group-active:bg-step"
				aria-hidden="true"><Icon name="close" size={18} /></span
			>
		</button>
	{/if}
</div>
