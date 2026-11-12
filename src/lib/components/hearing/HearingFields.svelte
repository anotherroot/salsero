<script lang="ts">
	import { untrack } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SongPickSheet from '$lib/components/songs/SongPickSheet.svelte';
	import { CHIP, GROUP, ROW, SECTION_LABEL } from '$lib/components/ui/styles';
	import { HEARING_DEFAULT, HEARING_LENGTHS, type HearingSettings } from '$lib/hearing/drill';
	import { targetsFor } from '$lib/hearing/targets';
	import { t } from '$lib/i18n/catalog';
	import type { Dance } from '$lib/dances/dances';
	import type { PickerSong } from '$lib/types';
	import ListenSetup from './ListenSetup.svelte';

	/**
	 * A hearing drill's fields (phase 2), inside a form: the kind, target and
	 * length as `readHearingForm` reads them, and, when making one, its songs
	 * (picked by hand, only counted ones; one `songId` field each, in order).
	 */
	interface Props {
		dance: Dance;
		settings?: HearingSettings;
		/** Making a drill: the songs to pick from and the ones picked. Absent: settings only. */
		songs?: { choices: PickerSong[]; picked: number[] } | null;
		/** Hear the clave (the listening page's; none here: the card says what it is). */
		onhearclave?: () => void;
	}

	let { dance, settings = HEARING_DEFAULT, songs = null, onhearclave = () => {} }: Props = $props();
	const w = $derived(t().hearing.drill);

	const start = untrack(() => settings);
	let kind = $state(start.kind);
	let target = $state(start.target);
	let clave = $state(start.clave ?? '2-3');
	let own = $state(start.positions ?? [3]);
	let part = $state<number | null>(null);
	let drops = $state<number>(start.drops);

	let picked = $state<number[]>(untrack(() => songs?.picked ?? []));
	let picking = $state(false);
	const counted = $derived((songs?.choices ?? []).filter((s) => s.counted));
	const uncounted = $derived((songs?.choices ?? []).length - counted.length);
	const titleOf = (id: number) => songs?.choices.find((s) => s.id === id)?.title ?? '';
</script>

<ListenSetup
	bind:kind
	bind:target
	bind:clave
	bind:own
	bind:part
	targets={targetsFor(dance)}
	parts={[]}
	tapDelayMs={null}
	check={false}
	oncheck={() => {}}
	{onhearclave}
/>

{#if kind === 'dropped'}
	<div class="flex flex-col gap-1.5">
		<h2 class={SECTION_LABEL}>{w.length}</h2>
		<div role="radiogroup" aria-label={w.length} class="flex flex-wrap gap-x-2 gap-y-1">
			{#each HEARING_LENGTHS as n (n)}
				<label class={CHIP}>
					<input
						type="radio"
						name="drops"
						value={n}
						class="sr-only"
						checked={drops === n}
						onchange={() => (drops = n)}
					/>
					{w.spots(n)}
				</label>
			{/each}
		</div>
	</div>
{:else}
	<input type="hidden" name="drops" value={drops} />
{/if}

{#if songs}
	<div class="flex flex-col gap-1.5">
		<h2 class={SECTION_LABEL}>{w.songs}</h2>
		<ul class={GROUP}>
			{#each picked as id (id)}
				<li class={ROW}>
					<input type="hidden" name="songId" value={id} />
					<span class="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{titleOf(id)}</span>
					<button
						type="button"
						class="flex size-11 items-center justify-center text-chevron"
						aria-label={w.removeSong(titleOf(id))}
						onclick={() => (picked = picked.filter((x) => x !== id))}
					>
						<Icon name="x" size={18} />
					</button>
				</li>
			{/each}
			<li>
				<button
					type="button"
					class="{ROW} focus-inset w-full cursor-pointer text-left font-bold text-accent-text active:bg-step"
					onclick={() => (picking = true)}
				>
					<Icon name="plus" size={20} />{w.addSong}
				</button>
			</li>
		</ul>
		<p class="px-4 text-[13px] leading-snug text-muted">
			{w.songsHint}
			{#if uncounted > 0}{w.hiddenUncounted(uncounted)}{/if}
		</p>
	</div>
	<SongPickSheet
		open={picking}
		onclose={() => (picking = false)}
		songs={counted.filter((s) => !picked.includes(s.id))}
		title={w.addSong}
		onpick={(s) => {
			picked = [...picked, s.id];
			picking = false;
		}}
	/>
{/if}
