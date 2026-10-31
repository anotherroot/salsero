<script lang="ts">
	let {
		checked = $bindable(false),
		label,
		name,
		disabled = false
	}: { checked?: boolean; label: string; name?: string; disabled?: boolean } = $props();
</script>

<label
	class="relative inline-flex h-11 w-14 flex-none cursor-pointer items-center justify-center has-disabled:cursor-default"
>
	<input
		type="checkbox"
		role="switch"
		class="peer sr-only"
		{name}
		{disabled}
		aria-label={label}
		bind:checked
	/>
	<span
		aria-hidden="true"
		class="relative block h-8 w-[52px] rounded-full bg-field-line transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50 peer-checked:[&>span]:translate-x-5"
	>
		<span
			class="absolute top-[3px] left-[3px] h-[26px] w-[26px] rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none"
		></span>
	</span>
</label>
