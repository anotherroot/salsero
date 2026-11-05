<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import CommentItem from './CommentItem.svelte';
	import Composer from './Composer.svelte';
	import { focusAfterRemoval } from '$lib/focus';
	import { undoToast, type ToastState } from '$lib/act-toast';
	import { reportOpen } from '$lib/teams/opens-api';
	import {
		deleteComment,
		heartComment,
		isRefused,
		loadComments,
		restoreComment,
		sendComment
	} from '$lib/comments/api';
	import {
		commentKey,
		DELETED_WORDS,
		HIDE_REPLIES,
		heartToggled,
		repliesLabel,
		shownIds,
		whoSees,
		withHearts,
		withoutComment,
		withPosted
	} from '$lib/comments/view';
	import type { CommentList, CommentRow } from '$lib/types';

	/**
	 * A group lesson's comments: newest top comment first, each thread's
	 * replies (oldest first) behind "N replies", the composer as the footer,
	 * Undo in the toast. Opening it records a 'comments' open, so the card's
	 * "N new" clears; the caller refreshes the page on close.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		lessonId: number;
		/** The subtitle. */
		lessonTitle: string;
		/** "Everyone in … sees it" until the list says it itself. */
		groupName: string;
		dance: string;
	}

	let { open, onclose, lessonId, lessonTitle, groupName, dance }: Props = $props();

	let list = $state<CommentList | null>(null);
	let loadError = $state<string | null>(null);
	const openThreads = new SvelteSet<number>();
	const hearting = new SvelteSet<number>();
	let replyTo = $state<{ id: number; name: string } | null>(null);
	let notice = $state<ToastState | null>(null);
	let toastSeq = 0;
	let composer: ReturnType<typeof Composer> | undefined = $state();
	/** The clock the name lines read, from the last load. */
	let now = $state(Date.now());

	async function load() {
		loadError = null;
		const got = await loadComments(lessonId);
		if (isRefused(got)) {
			loadError = got.message;
			return;
		}
		now = Date.now();
		list = got;
	}

	$effect(() => {
		if (!open) return;
		untrack(() => {
			list = null;
			notice = null;
			replyTo = null;
			openThreads.clear();
			reportOpen('comments', lessonId);
			void load();
		});
	});

	function say(message: string) {
		notice = { id: ++toastSeq, message };
	}

	async function heart(row: CommentRow) {
		if (!list || hearting.has(row.id)) return;
		hearting.add(row.id);
		list = withHearts(list, row.id, heartToggled(row));
		const got = await heartComment(row.id);
		hearting.delete(row.id);
		if (!list) return;
		if (isRefused(got)) {
			list = withHearts(list, row.id, { hearted: row.hearted, hearts: row.hearts });
			say(got.message);
			return;
		}
		list = withHearts(list, row.id, { hearted: got.hearted, hearts: got.count });
	}

	async function reply(row: CommentRow) {
		if (!row.authorName) return;
		replyTo = { id: row.id, name: row.authorName };
		openThreads.add(row.threadId ?? row.id);
		await tick();
		composer?.focus();
	}

	async function remove(row: CommentRow) {
		if (!list) return;
		const keys = shownIds(list, openThreads).map(commentKey);
		const got = await deleteComment(row.id);
		if (isRefused(got)) {
			say(got.message);
			return;
		}
		if (!list) return;
		list = withoutComment(list, row.id);
		if (replyTo?.id === row.id) replyTo = null;
		notice = undoToast(
			++toastSeq,
			DELETED_WORDS,
			() => (notice = null),
			() => undo(row.id)
		);
		void focusAfterRemoval(keys, commentKey(row.id), 'comment-composer');
	}

	async function undo(id: number) {
		const got = await restoreComment(id);
		if (isRefused(got)) {
			say(got.message);
			return;
		}
		await load();
	}

	async function send(body: string): Promise<string | null> {
		if (!list) return 'That did not work. Try again.';
		const got = await sendComment(lessonId, body, replyTo?.id ?? null);
		if (isRefused(got)) return got.message;
		now = Date.now();
		list = withPosted(list, got);
		if (got.threadId !== null) openThreads.add(got.threadId);
		replyTo = null;
		await tick();
		document
			.querySelector(`[data-focus="${commentKey(got.id)}"]`)
			?.scrollIntoView({ block: 'nearest' });
		return null;
	}

	function toggleThread(id: number) {
		if (openThreads.has(id)) openThreads.delete(id);
		else openThreads.add(id);
	}
</script>

<Sheet
	title="Comments"
	sub={lessonTitle}
	{open}
	{onclose}
	tall
	footer={list?.open ? composerFooter : undefined}
>
	{#if loadError}
		<div class="flex flex-col items-center gap-3 py-10 text-center">
			<p class="text-[15px] text-ink-2" role="alert">{loadError}</p>
			<button type="button" class={button('secondary', 'sm')} onclick={() => void load()}
				>Try again</button
			>
		</div>
	{:else if !list}
		<div class="flex justify-center py-10 text-muted"><Spinner label="Loading comments" /></div>
	{:else}
		{#if list.threads.length === 0}
			<p class="py-6 text-center text-[15px] text-muted">Be the first to ask or say something</p>
		{/if}
		<ul class="flex flex-col gap-4">
			{#each list.threads as thread (thread.top.id)}
				{@const shown = openThreads.has(thread.top.id)}
				<li class="flex flex-col gap-1">
					<CommentItem
						row={thread.top}
						{dance}
						{now}
						open={list.open}
						onheart={() => void heart(thread.top)}
						onreply={() => void reply(thread.top)}
						ondelete={() => void remove(thread.top)}
					/>
					{#if thread.replies.length > 0}
						<button
							type="button"
							class="ml-10 flex min-h-11 cursor-pointer items-center gap-1 self-start rounded-full px-2 text-[14px] font-extrabold text-accent-text active:bg-step"
							aria-expanded={shown}
							onclick={() => toggleThread(thread.top.id)}
						>
							{shown ? HIDE_REPLIES : repliesLabel(thread.replies.length)}
							<Icon name={shown ? 'chevron-up' : 'chevron-down'} size={18} />
						</button>
						{#if shown}
							<ul class="ml-12 flex flex-col gap-3">
								{#each thread.replies as r (r.id)}
									<li>
										<CommentItem
											row={r}
											{dance}
											{now}
											open={list.open}
											onheart={() => void heart(r)}
											onreply={() => void reply(r)}
											ondelete={() => void remove(r)}
										/>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
		<p class="pt-5 pb-2 text-center text-[13px] text-muted">
			{whoSees(list.groupName || groupName)}
		</p>
	{/if}

	{#snippet toast()}
		<Toast
			contained
			bottom="0"
			toast={notice}
			onaction={() => notice?.undo?.()}
			ondismiss={() => (notice = null)}
		/>
	{/snippet}
</Sheet>

{#snippet composerFooter()}
	<Composer
		bind:this={composer}
		replyName={replyTo?.name ?? null}
		oncancelreply={() => (replyTo = null)}
		onsend={send}
	/>
{/snippet}
