<!-- src/lib/components/player/SourcePicker.svelte -->
<!--
	What a practice plays to: count only at a tempo, or one of this dance's
	ready songs at a speed. Shared by the popup's practice panel and the full
	player's setup. It only chooses — loading the song is the owner's
	(`loadSongGrid`), since the owner also mounts the `<audio>`.
-->
<script lang="ts">
	import type { PickerSong } from '$lib/types';
	import { CHIP, FIELD, LABEL } from '$lib/components/ui/styles';
	import { SPEEDS, type Speed } from '$lib/labels';
	import SongPicker from './SongPicker.svelte';

	interface Props {
		/** Prefix for the radio groups' names, so two pickers never share a group. */
		name: string;
		/** This dance's ready songs. Without any, only the tempo is offered. */
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
</script>

{#if songs.length > 0}
	<fieldset>
		<legend class={LABEL}>Source</legend>
		<div class="flex gap-2">
			<label class={CHIP}>
				<input
					type="radio"
					name="{name}-source"
					checked={source === 'count'}
					onchange={() => (source = 'count')}
					class="sr-only"
				/>
				Count only
			</label>
			<label class={CHIP}>
				<input
					type="radio"
					name="{name}-source"
					checked={source === 'song'}
					onchange={() => (source = 'song')}
					class="sr-only"
				/>
				A song
			</label>
		</div>
	</fieldset>
{/if}

{#if source === 'song'}
	<div>
		<span class={LABEL}>Song</span>
		<SongPicker bind:songId {songs} />
	</div>
	{#if error}<p class="text-[13px] text-danger">{error}</p>{/if}
	<fieldset>
		<legend class={LABEL}>Speed</legend>
		<div class="flex gap-2">
			{#each SPEEDS as s (s)}
				<label class={CHIP}>
					<input
						type="radio"
						name="{name}-speed"
						checked={speed === s}
						onchange={() => (speed = s)}
						class="sr-only"
					/>
					{s}×
				</label>
			{/each}
		</div>
	</fieldset>
{:else}
	<label class="block">
		<span class={LABEL}>Tempo (BPM)</span>
		<input type="number" inputmode="numeric" min="60" max="300" bind:value={bpm} class={FIELD} />
	</label>
{/if}
