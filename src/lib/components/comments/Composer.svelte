<script lang="ts">
	import { tick } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { iconButton, TEXTAREA } from '$lib/components/ui/styles';
	import { track } from '$lib/unsaved/guard.svelte';
	import type { SaveOutcome } from '$lib/unsaved/pending';
	import { bodyError, COMPOSER_PLACEHOLDER, replyingTo } from '$lib/comments/view';

	/**
	 * The comments sheet's footer: the field, Send, and "Replying to Maja ×".
	 *
	 * It posts to the comments API with fetch, not to a page action, so it
	 * registers with the unsaved-changes guard itself (`track`, as a slot's note
	 * does) rather than through `use:guarded`, whose Save waits for a form
	 * action's answer. The effect is the same: closing the sheet or leaving with
	 * text in the field asks "Unsaved changes", and that dialog's Save sends it.
	 */
	interface Props {
		/** Whom the comment answers, or null for a top comment. */
		replyName: string | null;
		oncancelreply: () => void;
		/** Sends the body; resolves to the refusal's words, or null once it is posted. */
		onsend: (body: string) => Promise<string | null>;
	}

	let { replyName, oncancelreply, onsend }: Props = $props();

	const id = $props.id();
	const errorId = `composer-error-${id}`;
	let text = $state('');
	let sending = $state(false);
	let error = $state<string | null>(null);
	let form: HTMLFormElement | undefined = $state();
	let field: HTMLTextAreaElement | undefined = $state();

	export function focus(): void {
		field?.focus();
	}

	/** Grows with the text, up to four lines (then it scrolls). */
	function fit(): void {
		if (!field) return;
		field.style.height = 'auto';
		field.style.height = `${field.scrollHeight + 2}px`;
	}

	async function send(): Promise<SaveOutcome> {
		if (sending) return { ok: false, message: 'Still sending.' };
		const problem = bodyError(text);
		if (problem) {
			error = problem;
			return { ok: false, message: problem };
		}
		sending = true;
		error = null;
		try {
			const refused = await onsend(text);
			if (refused) {
				error = refused;
				return { ok: false, message: refused };
			}
			text = '';
			await tick();
			fit();
			return { ok: true };
		} finally {
			sending = false;
		}
	}

	$effect(() => {
		const node = form;
		if (!node) return;
		return track({
			label: 'Comment',
			node,
			dirty: () => !sending && text.trim() !== '',
			sending: () => sending,
			save: send
		});
	});
</script>

<form
	bind:this={form}
	novalidate
	class="flex flex-col gap-1.5"
	onsubmit={(e) => {
		e.preventDefault();
		void send();
	}}
>
	{#if replyName}
		<p class="flex min-h-8 items-center gap-1 pl-1 text-[14px] font-semibold text-ink-2">
			<span class="min-w-0 flex-1 truncate">{replyingTo(replyName)}</span>
			<button
				type="button"
				class="{iconButton('bare', 'muted')} -my-1.5"
				aria-label="Write a new comment instead"
				onclick={() => {
					oncancelreply();
					focus();
				}}><Icon name="close" size={20} /></button
			>
		</p>
	{/if}
	<div class="flex items-end gap-2">
		<label class="min-w-0 flex-1">
			<span class="sr-only">{replyName ? replyingTo(replyName) : 'Comment'}</span>
			<textarea
				bind:this={field}
				bind:value={text}
				data-focus="comment-composer"
				rows="1"
				placeholder={COMPOSER_PLACEHOLDER}
				class="{TEXTAREA} composer"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? errorId : undefined}
				oninput={() => {
					error = null;
					fit();
				}}></textarea>
		</label>
		<button
			type="submit"
			class="{iconButton('filled')} mb-1"
			aria-label="Send"
			aria-busy={sending}
			disabled={sending || text.trim() === ''}
		>
			{#if sending}<Spinner />{:else}<Icon name="arrow-up" />{/if}
		</button>
	</div>
	{#if error}<FieldError id={errorId} message={error} />{/if}
</form>

<style>
	/* One line to start, four at most; `fit` sets the height in between. */
	.composer {
		resize: none;
		max-height: calc(4 * 1.375em + 30px);
		overflow-y: auto;
	}
</style>
