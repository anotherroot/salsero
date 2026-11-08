<!-- src/lib/components/songs/MusicSection.svelte -->
<script lang="ts">
	/**
	 * A lesson's, drill's or routine's Music (spec B, options 6C and 7A): the
	 * heading with "+ Add" for an editor, then one compact row per song (its
	 * title, the note's first line, ▶ its sample). A row opens its sheet: the
	 * whole note and "Practise to this" (and, for an editor, Edit note and
	 * Remove). "+ Add" opens the song popup; a pick asks for its note, then adds.
	 * Posts the page's `addSong`, `noteSong` and `removeSong`. Not drawn for a
	 * reader when there is nothing in it.
	 */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { focusAfterRemoval } from '$lib/focus';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import SongPickSheet from '$lib/components/songs/SongPickSheet.svelte';
	import {
		FIELD_ERROR,
		GROUP,
		LABEL,
		SECTION_LABEL,
		TEXTAREA,
		button
	} from '$lib/components/ui/styles';
	import { sectionHeading } from '$lib/lessons/page';
	import { music } from '$lib/songs/music';
	import { t } from '$lib/i18n/catalog';
	import type { MusicRow, PickerSong } from '$lib/types';

	interface Props {
		rows: MusicRow[];
		canEdit: boolean;
		/** What "+ Add" offers (the page's `musicChoices`). */
		choices: PickerSong[];
		/** Where "Practise to this" goes for a song, or null when it cannot. */
		practise: (songId: number) => string | null;
	}

	let { rows, canEdit, choices, practise }: Props = $props();
	const uid = $props.id();
	const w = $derived(music());

	/** The row whose sheet is open, by its link id. */
	let openId = $state<number | null>(null);
	const open = $derived(rows.find((r) => r.id === openId) ?? null);
	let picking = $state(false);
	/** The note sheet: adding a picked song, or editing a row's note. */
	let noting = $state<
		{ kind: 'add'; songId: number; title: string } | { kind: 'edit'; row: MusicRow } | null
	>(null);
	let busy = $state(false);
	let message = $state<string | null>(null);

	const already = $derived(new Set(rows.map((r) => r.songId)));
	const offered = $derived(choices.filter((s) => !already.has(s.id)));

	function startAdd() {
		message = null;
		picking = true;
	}

	const saveNote: SubmitFunction = ({ cancel }) => {
		if (busy) return cancel();
		busy = true;
		message = null;
		return async ({ update, result }) => {
			try {
				if (result.type === 'failure') {
					const m = (result.data as { message?: unknown } | undefined)?.message;
					message = typeof m === 'string' ? m : w.saveFailed;
					return;
				}
				await update({ reset: result.type === 'success' });
			} finally {
				busy = false;
			}
			if (result.type === 'success') {
				noting = null;
				picking = false;
				openId = null;
			}
		};
	};

	const remove =
		(id: number): SubmitFunction =>
		() => {
			const keys = rows.map((r) => `music-${r.id}`);
			return async ({ update, result }) => {
				openId = null;
				await update();
				if (result.type === 'success') await focusAfterRemoval(keys, `music-${id}`, 'music-add');
			};
		};
</script>

{#if canEdit || rows.length > 0}
	<section class="flex flex-col gap-2">
		<div class="flex items-center justify-between pr-1">
			<h2 class={SECTION_LABEL}>{sectionHeading(w.heading, rows.length)}</h2>
			{#if canEdit}
				<button
					type="button"
					data-focus="music-add"
					class={button('tertiary', 'sm')}
					aria-label={w.add}
					aria-haspopup="dialog"
					onclick={startAdd}><Icon name="plus" size={18} />{t().common.add}</button
				>
			{/if}
		</div>
		{#if rows.length > 0}
			<ul class={GROUP}>
				{#each rows as row (row.id)}
					<li class="flex min-h-16 items-center gap-1 pr-1.5 pl-4">
						<button
							type="button"
							data-focus="music-{row.id}"
							aria-haspopup="dialog"
							onclick={() => (openId = row.id)}
							class="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-1 text-left"
						>
							<span class="truncate text-[16px] leading-[1.3] font-bold text-ink">{row.title}</span>
							{#if !row.shared}
								<span class="text-[13px] leading-[1.35] font-bold text-warn">{w.notShared}</span>
							{:else if row.note}
								<span class="flex min-w-0 items-center gap-1 text-[13px] leading-[1.35] text-muted">
									<Icon name="note" size={16} /><span class="truncate">{row.note}</span>
								</span>
							{/if}
						</button>
						<SampleButton song={row.sample} name={row.title} />
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<Sheet title={open?.title ?? ''} size="small" open={open !== null} onclose={() => (openId = null)}>
	{#if open}
		<div class="flex flex-col gap-3">
			{#if open.note}
				<LinkedText
					text={open.note}
					class="text-[16px] leading-[1.45] font-medium whitespace-pre-line text-ink"
				/>
			{/if}
			{#if open.shared && practise(open.songId)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- practiseHref builds it -->
				<a href={practise(open.songId)} class={button('primary', 'md', true)}
					><Icon name="play" size={20} filled />{w.practise}</a
				>
			{:else if !open.shared}
				<p class="text-[15px] text-muted">
					{w.notSharedLine}
				</p>
			{/if}
			{#if canEdit}
				<div class="flex items-center justify-between">
					<button
						type="button"
						class={button('tertiary', 'sm')}
						aria-haspopup="dialog"
						onclick={() => {
							message = null;
							if (open) noting = { kind: 'edit', row: open };
						}}><Icon name="edit" size={18} />{w.edit}</button
					>
					<form method="POST" action="?/removeSong" use:enhance={remove(open.id)}>
						<input type="hidden" name="linkId" value={open.id} />
						<button type="submit" class={button('danger-text', 'sm')}
							><Icon name="trash" size={18} />{w.remove}</button
						>
					</form>
				</div>
			{/if}
		</div>
	{/if}
</Sheet>

{#if canEdit}
	<SongPickSheet
		open={picking}
		onclose={() => (picking = false)}
		songs={offered}
		title={w.pick}
		onpick={(s) => {
			message = null;
			noting = { kind: 'add', songId: s.id, title: s.title };
		}}
	/>

	<Sheet
		title={noting?.kind === 'edit' ? noting.row.title : (noting?.title ?? '')}
		open={noting !== null}
		onclose={() => (noting = null)}
	>
		{#if noting}
			<form
				id="{uid}-note"
				method="POST"
				action={noting.kind === 'add' ? '?/addSong' : '?/noteSong'}
				novalidate
				use:guarded={{ label: w.unsavedLabel, submit: saveNote }}
			>
				{#if noting.kind === 'add'}
					<input type="hidden" name="songId" value={noting.songId} />
				{:else}
					<input type="hidden" name="linkId" value={noting.row.id} />
					<input type="hidden" name="seen" value={noting.row.seen} />
				{/if}
				<label class={LABEL} for="{uid}-note-text"
					>{w.noteLabel}<span class="font-medium text-muted">&nbsp;{w.optional}</span></label
				>
				<textarea
					id="{uid}-note-text"
					name="note"
					rows="3"
					maxlength="500"
					placeholder={w.notePlaceholder}
					class={TEXTAREA}
					aria-invalid={message ? 'true' : undefined}
					aria-describedby="{uid}-note-help"
					>{noting.kind === 'edit' ? (noting.row.note ?? '') : ''}</textarea
				>
				{#if message}
					<p class={FIELD_ERROR} role="alert"><Icon name="warning" size={16} filled />{message}</p>
				{/if}
				<p id="{uid}-note-help" class="mt-1.5 pl-1 text-[13px] text-muted">{w.noteHelp}</p>
			</form>
		{/if}
		{#snippet footer()}
			<button
				type="submit"
				form="{uid}-note"
				class={button('primary', 'md', true)}
				aria-busy={busy}
				disabled={busy}
			>
				{#if busy}<Spinner />{:else}{noting?.kind === 'edit' ? w.save : w.addButton}{/if}
			</button>
		{/snippet}
	</Sheet>
{/if}
