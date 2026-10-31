<script lang="ts">
	import Icon from './Icon.svelte';

	/**
	 * The pill search field: a magnifier, the input, and a Clear button while
	 * there is something to clear. The pill draws the focus ring, not the input.
	 * Put it in a `<form role="search">`; submitting is the form's business.
	 * Without a `name` it posts nothing (the shared picker's filter).
	 */
	let {
		name,
		value = $bindable(''),
		placeholder,
		label,
		onclear,
		disabled = false,
		input = $bindable(),
		onkeydown
	}: {
		name?: string;
		value?: string;
		placeholder: string;
		label?: string;
		onclear?: () => void;
		/** Drawn as the disabled field: no ring, no Clear. */
		disabled?: boolean;
		/** The input element, for a caller that focuses it. */
		input?: HTMLInputElement;
		onkeydown?: (e: KeyboardEvent) => void;
	} = $props();

	const id = $props.id();

	function clear() {
		value = '';
		input?.focus();
		onclear?.();
	}
</script>

<div
	class="flex h-11 flex-none items-center gap-2.5 rounded-full pl-4 {disabled
		? 'bg-disabled-bg text-disabled-ink'
		: 'bg-surface text-muted shadow-[inset_0_0_0_1px_var(--color-hairline)] focus-within:shadow-[0_0_0_2px_var(--color-accent),0_0_0_6px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]'}"
	class:pr-4={!value || disabled}
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
		{disabled}
		{onkeydown}
		autocomplete="off"
		class="h-10 min-w-0 flex-1 bg-transparent p-0 font-sans text-[16px] font-medium outline-none focus-visible:shadow-none! focus-visible:outline-none! disabled:cursor-default disabled:text-disabled-ink disabled:placeholder:text-disabled-ink [&::-webkit-search-cancel-button]:appearance-none {disabled
			? ''
			: 'text-ink placeholder:text-muted'}"
	/>
	{#if value && !disabled}
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
