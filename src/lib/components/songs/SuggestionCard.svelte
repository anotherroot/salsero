<script lang="ts">
	import { button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import { suggestionLine } from '$lib/songs/song-edit';
	import type { Suggestion } from '$lib/songs/suggest';

	/** Where the downbeats say the 1 moves: a card under its row. Never applied by itself. */
	let {
		suggestion,
		onuse,
		onskip
	}: { suggestion: Suggestion; onuse: () => void; onskip: () => void } = $props();
</script>

<div class="mx-1 my-1 flex flex-col gap-2 rounded-2xl border border-dashed border-accent-text p-3">
	<p class="text-[14px] leading-[1.4] text-ink-2">
		{suggestionLine(suggestion.t, suggestion.shift)}
	</p>
	<div class="flex justify-end gap-2">
		<button type="button" class={button('tertiary', 'sm')} onclick={onskip}
			>{t().songs.page.suggest.notNow}</button
		>
		<button type="button" class={button('primary', 'sm')} onclick={onuse}
			>{t().songs.page.suggest.use}</button
		>
	</div>
</div>
