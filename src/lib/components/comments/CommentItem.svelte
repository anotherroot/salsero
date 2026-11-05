<script lang="ts">
	import { tick } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { textPieces } from '$lib/links';
	import {
		atReply,
		commentKey,
		DELETED_WORDS,
		initialOf,
		shortAgo,
		TEACHER_TAG
	} from '$lib/comments/view';
	import type { CommentRow } from '$lib/types';

	/**
	 * One comment in the sheet: the avatar in the group's colour, "Maja ·
	 * Teacher · 2 d", the text (links built as elements, never `{@html}`), and
	 * the heart, Reply and "⋯ → Delete". A deleted top comment kept for its
	 * replies shows only "Comment deleted".
	 */
	interface Props {
		row: CommentRow;
		/** The dance, so the avatar can take the group's colours (`[data-dance][data-group]`). */
		dance: string;
		now: number;
		/** Posting is open: Reply and the heart act (false in a deleted group). */
		open: boolean;
		onheart: () => void;
		onreply: () => void;
		ondelete: () => void;
	}

	let { row, dance, now, open, onheart, onreply, ondelete }: Props = $props();

	const deleted = $derived(row.body === null);
	const at = $derived(atReply(row));
	let menu = $state(false);
	let menuWrap: HTMLElement | undefined = $state();
	let menuItem: HTMLButtonElement | undefined = $state();
	let more: HTMLButtonElement | undefined = $state();

	async function openMenu() {
		menu = true;
		await tick();
		menuItem?.focus();
	}

	function closeMenu(refocus: boolean) {
		menu = false;
		if (refocus) more?.focus();
	}

	const ACTION =
		'flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-2 text-[13px] font-bold active:bg-step';
</script>

<article
	tabindex="-1"
	data-focus={commentKey(row.id)}
	class="flex scroll-my-3 gap-3 rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
>
	<span
		data-dance={dance}
		data-group=""
		class="mt-0.5 flex size-9 flex-none items-center justify-center rounded-full font-display text-[16px] font-extrabold {deleted
			? 'bg-chip text-muted'
			: 'bg-accent-soft text-accent-text'}"
		aria-hidden="true">{initialOf(row.authorName)}</span
	>
	<div class="flex min-w-0 flex-1 flex-col">
		{#if deleted}
			<p class="py-2 text-[15px] text-muted italic">{DELETED_WORDS}</p>
		{:else}
			<p class="text-[13px] leading-snug">
				<span class="font-bold text-ink">{row.authorName}</span>
				{#if row.teacher}<span class="text-muted">·</span>
					<span class="font-extrabold text-accent-text">{TEACHER_TAG}</span>{/if}
				<span class="text-muted">· {shortAgo(row.at, now)}</span>
			</p>
			<!-- The space after "@Maja" is in the span: a bare one between tags is trimmed. -->
			<p class="mt-0.5 text-[15px] leading-[1.4] break-words whitespace-pre-wrap text-ink">
				{#if at}<span class="font-bold text-accent-text">{`${at} `}</span
					>{/if}{#each textPieces(row.body ?? '') as piece, i (i)}{#if 'url' in piece}<a
							href={piece.url}
							target="_blank"
							rel="external noopener noreferrer"
							class="break-all text-accent-text underline">{piece.url}</a
						>{:else}{piece.text}{/if}{/each}
			</p>
			<div class="-ml-2 flex items-center">
				{#if open}
					<button
						type="button"
						class="{ACTION} {row.hearted ? 'text-danger' : 'text-muted'}"
						aria-pressed={row.hearted}
						aria-label={row.hearts > 0 ? `Heart, ${row.hearts}` : 'Heart'}
						onclick={onheart}
					>
						<Icon name="heart" size={20} filled={row.hearted} />
						{#if row.hearts > 0}<span aria-hidden="true">{row.hearts}</span>{/if}
					</button>
					<button type="button" class="{ACTION} text-ink-2" onclick={onreply}>Reply</button>
				{:else if row.hearts > 0}
					<span class="flex min-h-11 items-center gap-1 px-2 text-[13px] font-bold text-muted">
						<Icon name="heart" size={20} filled={row.hearted} />{row.hearts}
					</span>
				{/if}
				{#if row.canDelete}
					<div
						class="relative ml-auto"
						bind:this={menuWrap}
						onfocusout={(e) => {
							const to = e.relatedTarget;
							if (menu && !(to instanceof Node && menuWrap?.contains(to))) closeMenu(false);
						}}
					>
						<button
							bind:this={more}
							type="button"
							class="{ACTION} text-muted"
							aria-label="More about this comment"
							aria-expanded={menu}
							onclick={() => (menu ? closeMenu(true) : void openMenu())}
						>
							<Icon name="more" size={20} />
						</button>
						{#if menu}
							<div
								class="absolute top-full right-0 z-10 rounded-2xl bg-raised p-1 shadow-[0_8px_24px_rgb(0_0_0/0.2)]"
							>
								<button
									bind:this={menuItem}
									type="button"
									class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-[15px] font-bold whitespace-nowrap text-danger active:bg-step"
									onkeydown={(e) => {
										if (e.key === 'Escape') {
											// Only the menu: not the sheet around it.
											e.preventDefault();
											e.stopPropagation();
											closeMenu(true);
										}
									}}
									onclick={() => {
										menu = false;
										ondelete();
									}}><Icon name="trash" size={20} />Delete</button
								>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</article>
