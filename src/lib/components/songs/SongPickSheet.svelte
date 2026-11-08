<!--
	"Pick a song": a search, then (with `first`) a row's own Music, Recent, the
	person's own A to Z and a heading per group with its shared songs, every row
	with its own ▶. Sampling never picks; tapping a row calls `onpick`. Every way
	of closing stops the sample. The song field's (`SongPicker`) and Music's
	"+ Add" (`MusicSection`).
-->
<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { desk } from '$lib/nav/desk.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { CLIP, SECTION_LABEL } from '$lib/components/ui/styles';
	import { getDance, isDanceSlug } from '$lib/dances/dances';
	import { pickerCount, searchSongs, songMeta, songSections } from '$lib/songs/search';
	import { segments } from '$lib/picker/model';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import { clock } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import type { PickerSong } from '$lib/types';

	interface Props {
		open: boolean;
		onclose: () => void;
		songs: PickerSong[];
		onpick: (song: PickerSong) => void;
		/** The song now picked: its row is marked. */
		picked?: number | null;
		/** A row's own Music, listed first under its name. */
		first?: { label: string; ids: number[] } | null;
		title?: string;
	}

	let { open, onclose, songs, onpick, picked = null, first = null, title }: Props = $props();

	let query = $state('');
	let search: HTMLInputElement | undefined = $state();

	const slug = $derived(page.params.dance ?? 'salsa');
	const styleLabels = $derived(isDanceSlug(slug) ? getDance(slug).styleLabel : {});
	const searching = $derived(query.trim() !== '');
	const hits = $derived(searchSongs(songs, query));
	const sections = $derived(songSections(songs, first));
	const countText = $derived(pickerCount(searching ? hits.length : songs.length, searching));

	// Focus the search on the desktop or with a mouse, never on a touch phone:
	// there the keyboard would cover the list, which is what the popup was
	// opened to see and sample.
	$effect(() => {
		if (open && search && (desk.current || matchMedia('(pointer: fine)').matches)) search.focus();
	});

	// A sample keeps playing while typing only while its row is still listed:
	// a sample with no ■ in sight could not be stopped.
	$effect(() => {
		const id = sampling.id;
		if (open && searching && id !== null && !hits.some((s) => s.id === id)) stopSample();
	});

	// However it closes (a pick, ✕, the backdrop, Escape, Back): the search
	// empties and the sample stops.
	let wasOpen = false;
	$effect(() => {
		if (wasOpen && !open) {
			query = '';
			stopSample();
		}
		wasOpen = open;
	});

	function close() {
		onclose();
	}
</script>

{#snippet row(s: PickerSong, last: boolean, named: boolean)}
	{@const on = s.id === picked}
	{@const segs = searching ? segments(s.title, query) : [{ text: s.title, hit: false }]}
	<li class="pl-4 {on ? 'bg-accent-soft' : ''}">
		<div
			class="flex min-h-16 items-center gap-1 pr-1 {last
				? ''
				: 'shadow-[inset_0_-1px_0_var(--color-hairline)]'}"
		>
			<button
				type="button"
				aria-current={on ? 'true' : undefined}
				onclick={() => onpick(s)}
				class="flex min-w-0 flex-1 items-center gap-3 py-[9px] text-left"
			>
				<span
					class="grid size-[22px] flex-none place-items-center rounded-full border-2 {on
						? 'border-accent'
						: 'border-field-line'}"
					aria-hidden="true"
				>
					{#if on}<span class="size-2.5 rounded-full bg-accent"></span>{/if}
				</span>
				<span class="min-w-0">
					<span class="block truncate text-[16px] leading-[1.3] font-bold text-ink">
						{#each segs as seg, i (i)}{#if seg.hit}<mark
									class="rounded-[4px] bg-accent-soft px-px font-extrabold text-accent-text"
									>{seg.text}</mark
								>{:else}{seg.text}{/if}{/each}
					</span>
					{#if sampling.id === s.id}
						<span class="block truncate text-[13px] leading-[1.35] font-bold text-accent-text"
							>{t().songs.sample.from(clock(s.sample.startS))}</span
						>
					{:else}
						<span
							class="block truncate text-[13px] leading-[1.35] {on ? 'text-ink-2' : 'text-muted'}"
							>{songMeta(s, styleLabels, named)}</span
						>
					{/if}
				</span>
			</button>
			<SampleButton song={s.sample} name={s.title} tinted={on} />
		</div>
	</li>
{/snippet}

{#snippet card(list: PickerSong[], named = false)}
	<ul class="{CLIP} rounded-2xl bg-surface">
		{#each list as s, i (s.id)}{@render row(s, i === list.length - 1, named)}{/each}
	</ul>
{/snippet}

<Sheet title={title ?? t().songs.picker.title} {open} onclose={close} tall={songs.length > 0}>
	<div class="flex h-full min-h-0 flex-col gap-2">
		<SearchField placeholder={t().songs.picker.search} bind:value={query} bind:input={search} />
		<p class="flex justify-between gap-2 px-1 text-[13px] text-muted">
			<span class="font-bold">{countText}</span>
			<span class="flex items-center gap-1 text-right"
				><Icon name="play" size={12} filled />{t().songs.picker.hint}</span
			>
		</p>

		<div class="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
			<div class="flex flex-col gap-2">
				{#if searching}
					{#if hits.length > 0}
						{@render card(hits)}
					{:else}
						<EmptyState
							icon="search"
							title={t().songs.picker.noMatch(query.trim())}
							body={t().songs.picker.noMatchBody}
						>
							{#snippet action()}
								<a
									href={resolve(`/${slug}/songs?add=1`)}
									onclick={close}
									class="inline-flex min-h-11 items-center text-[15px] font-extrabold text-accent-text"
									>{t().songs.picker.addInMusic}</a
								>
							{/snippet}
						</EmptyState>
					{/if}
				{:else}
					{#each sections as section, i (i)}
						{#if section.label}
							<h3 class="{SECTION_LABEL} {i > 0 ? 'mt-2' : ''}">{section.label}</h3>
						{/if}
						<!-- Under a group's own heading its rows need not name it again. -->
						{@render card(section.songs, section.kind === 'group')}
					{/each}
				{/if}
			</div>
		</div>
	</div>
</Sheet>
