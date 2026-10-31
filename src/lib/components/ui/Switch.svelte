<script lang="ts">
	import { SWITCH_TRACK } from '$lib/components/ui/styles';

	let {
		checked = $bindable(false),
		label,
		name,
		disabled = false,
		onchange
	}: {
		checked?: boolean;
		label: string;
		name?: string;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	} = $props();
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
		onchange={(e) => onchange?.(e.currentTarget.checked)}
	/>
	<span aria-hidden="true" class={SWITCH_TRACK}>
		<span
			class="absolute top-[3px] left-[3px] h-[26px] w-[26px] rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none"
		></span>
	</span>
</label>
