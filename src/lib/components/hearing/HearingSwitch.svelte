<script lang="ts">
	import { CHIP } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { Dance } from '$lib/dances/dances';
	import type { PickerSong } from '$lib/types';
	import HearingFields from './HearingFields.svelte';

	/**
	 * A new drill's kind (phase 2, board 4): Vaja or Sluh, as the form's `type`.
	 * Sluh shows a hearing drill's fields under it: its songs, picked by hand,
	 * and the kind, target and length of its rounds.
	 */
	interface Props {
		dance: Dance;
		choices: PickerSong[];
		/** Songs picked from the start (a song page's Naredi vajo). */
		picked?: number[];
		hearing?: boolean;
		/** Which half to draw: the switch, the fields under it, or both (the default). */
		part?: 'switch' | 'fields' | 'both';
	}

	let { dance, choices, picked = [], hearing = $bindable(false), part = 'both' }: Props = $props();
	const w = $derived(t().exercise.types);
</script>

{#if part !== 'fields'}
	<div
		role="radiogroup"
		aria-label={t().hearing.drill.kindOf}
		class="flex flex-wrap gap-x-2 gap-y-1"
	>
		<label class={CHIP}>
			<input
				type="radio"
				name="type"
				value="drill"
				class="sr-only"
				checked={!hearing}
				onchange={() => (hearing = false)}
			/>
			{w.drill}
		</label>
		<label class={CHIP}>
			<input
				type="radio"
				name="type"
				value="hearing"
				class="sr-only"
				checked={hearing}
				onchange={() => (hearing = true)}
			/>
			{w.hearing}
		</label>
	</div>
{/if}

{#if hearing && part !== 'switch'}
	<HearingFields {dance} songs={{ choices, picked }} />
{/if}
