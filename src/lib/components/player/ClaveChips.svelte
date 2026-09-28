<script lang="ts">
	import { CLAVE_PATTERNS, type ClavePattern } from '$lib/labels';
	import { CHIP } from '$lib/components/ui/styles';

	interface Props {
		value: ClavePattern | null;
		onchange: (clave: ClavePattern | null) => void;
		name?: string;
	}

	let { value, onchange, name = 'clave' }: Props = $props();
</script>

<div class="flex gap-2">
	<label class={CHIP}>
		<input
			type="radio"
			{name}
			checked={value === null}
			onchange={() => onchange(null)}
			class="sr-only"
		/>
		Off
	</label>
	{#each CLAVE_PATTERNS as c (c)}
		<label class={CHIP}>
			<input
				type="radio"
				{name}
				checked={value === c}
				onchange={() => onchange(c)}
				class="sr-only"
			/>
			{c}
		</label>
	{/each}
</div>
