<script lang="ts">
	import { page } from '$app/state';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { cardWords, TEACHER_TAG } from '$lib/comments/view';
	import { agoText } from '$lib/format';
	import type { CommentsOn } from '$lib/types';
	import CommentsSheet from './CommentsSheet.svelte';

	/**
	 * The card at the end of a group lesson's page (and, titled "Comments on the
	 * class", an exercise page's): the count, "N new", the newest comment. The
	 * whole card is one button that opens the sheet; closing it refreshes the
	 * page, so the card shows what was posted and loses its "N new".
	 */
	interface Props {
		comments: CommentsOn;
		/** "Comments" on a lesson; "Comments on the class" on an exercise page. */
		title?: string;
	}

	let { comments, title = 'Comments' }: Props = $props();

	const words = $derived(cardWords(comments.card, title));
	const newest = $derived(comments.card.newest);
	let open = $state(false);
</script>

<button
	type="button"
	class="flex w-full cursor-pointer flex-col gap-1.5 rounded-2xl bg-surface px-4 py-3.5 text-left active:brightness-95"
	aria-haspopup="dialog"
	onclick={() => (open = true)}
>
	<span class="flex w-full items-center gap-2">
		<span class="font-display text-[18px] font-extrabold text-ink">{words.title}</span>
		{#if words.count}<span class="text-[16px] font-bold text-muted">{words.count}</span>{/if}
		{#if words.newPill}<Badge tone="accent" solid>{words.newPill}</Badge>{/if}
		<span class="ml-auto text-muted"><Icon name="chevron-right" size={20} /></span>
	</span>
	{#if newest}
		<span class="text-[13px] leading-snug">
			<span class="font-bold text-ink">{newest.name}</span>
			{#if newest.teacher}<span class="text-muted">·</span>
				<span class="font-extrabold text-accent-text">{TEACHER_TAG}</span>{/if}
		</span>
		<span class="line-clamp-2 text-[15px] leading-[1.4] break-words text-ink-2">{newest.text}</span>
		<span class="text-[13px] text-muted">{agoText(newest.at, comments.now)}</span>
	{:else}
		<span class="text-[15px] text-muted">{words.empty}</span>
	{/if}
</button>

<CommentsSheet
	{open}
	onclose={() => {
		open = false;
		void refreshWhenSettled();
	}}
	lessonId={comments.lessonId}
	lessonTitle={comments.lessonTitle}
	groupName={comments.groupName}
	dance={page.params.dance ?? ''}
/>
