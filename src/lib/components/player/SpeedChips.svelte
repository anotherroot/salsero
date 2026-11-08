<script lang="ts">
	import { SPEEDS, type Speed } from '$lib/labels';
	import { CHIP } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';

	interface Props {
		value: Speed;
		onchange: (speed: Speed) => void;
		/** The radio group's name, so two sets of chips never share one. */
		name: string;
	}

	let { value, onchange, name }: Props = $props();
</script>

<div
	role="radiogroup"
	aria-label={t().exercise.panel.speedLabel}
	class="flex flex-wrap gap-x-2 gap-y-1"
>
	{#each SPEEDS as s (s)}
		<label class={CHIP}>
			<input
				type="radio"
				{name}
				checked={value === s}
				onchange={() => onchange(s)}
				class="sr-only"
			/>
			{t().exercise.panel.speed(s)}
		</label>
	{/each}
</div>
