<!-- src/lib/components/player/SourcePicker.svelte -->
<!--
	What a practice plays to: count only at a tempo, or one of this dance's
	ready songs at a speed. Shared by the popup's practice panel and the full
	player's setup. It only chooses — loading the song is the owner's
	(`loadSongGrid`), since the owner also mounts the `<audio>`.
-->
<script lang="ts">
	import { RUN_SOURCES } from '$lib/player/view';
	import type { PickerSong } from '$lib/types';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Stepper from '$lib/components/ui/Stepper.svelte';
	import { FIELD_ERROR } from '$lib/components/ui/styles';
	import type { Speed } from '$lib/labels';
	import SongPicker from './SongPicker.svelte';
	import SpeedChips from './SpeedChips.svelte';

	interface Props {
		/** Prefix for the radio groups' names, so two pickers never share a group. */
		name: string;
		/** This dance's ready songs (own and the groups' shared). Without any, only the tempo is offered. */
		songs: PickerSong[];
		source: 'count' | 'song';
		songId: number | null;
		speed: Speed;
		bpm: number;
		/** Why the picked song could not be loaded, if it could not. */
		error?: string | null;
	}

	let {
		name,
		songs,
		source = $bindable(),
		songId = $bindable(),
		speed = $bindable(),
		bpm = $bindable(),
		error = null
	}: Props = $props();

	const uid = $props.id();
	/** A group's label: 13/700 muted, 4 px over its control. */
	const GROUP_LABEL = 'mb-1 block text-[13px] font-bold text-muted';
</script>

{#if songs.length > 0}
	<div>
		<!-- The radiogroup carries the same name for a screen reader. -->
		<span class={GROUP_LABEL} aria-hidden="true">Source</span>
		<Segmented
			label="Source"
			name="{name}-source"
			items={RUN_SOURCES}
			bind:value={() => source, (v) => (source = v === 'song' ? 'song' : 'count')}
		/>
	</div>
{/if}

{#if source === 'song'}
	<div>
		<span class={GROUP_LABEL} id="{uid}-song">Song</span>
		<SongPicker bind:songId {songs} labelId="{uid}-song" />
		{#if error}
			<p class={FIELD_ERROR}><Icon name="warning" size={16} />{error}</p>
		{/if}
	</div>
	<div>
		<span class={GROUP_LABEL} aria-hidden="true">Speed</span>
		<SpeedChips name="{name}-speed" value={speed} onchange={(s) => (speed = s)} />
	</div>
{:else}
	<div class="py-0.5">
		<Stepper label="Tempo" unit="BPM" min={60} max={300} step={5} bind:value={bpm} />
	</div>
{/if}
