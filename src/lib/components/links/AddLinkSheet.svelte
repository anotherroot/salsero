<!-- src/lib/components/links/AddLinkSheet.svelte -->
<script lang="ts">
	/**
	 * "Add a link" (spec A2, option 2B): one Link field and, once what is pasted
	 * parses, a card saying what it found; an optional Title; "Add link" in the
	 * footer. It posts `urls` (the one link) and `title` to `action` — a page's
	 * `addLink`. A success closes the sheet; a refusal keeps it open with the
	 * page's message under the field. The lesson page's and the figure page's.
	 */
	import type { SubmitFunction } from '@sveltejs/kit';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, FIELD_ERROR, LABEL, button } from '$lib/components/ui/styles';
	import { linkFound } from '$lib/links';

	interface Props {
		open: boolean;
		onclose: () => void;
		/** Where the form posts: a page's `?/addLink`. */
		action: string;
		/** The page's last addLink refusal, if any. */
		message: string | null;
		/** What was typed, handed back by that refusal. */
		entered: string;
		/** A YouTube link can be saved here (a figure's or lesson's, not a drill's). */
		canSave?: boolean;
	}

	let { open, onclose, action, message, entered, canSave = false }: Props = $props();
	const uid = $props.id();

	let url = $state('');
	let busy = $state(false);
	// Each opening starts from what a refusal handed back, else empty.
	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) url = entered;
		wasOpen = open;
	});
	const found = $derived(linkFound(url));

	const submit: SubmitFunction = ({ cancel }) => {
		if (busy) return cancel();
		busy = true;
		return async ({ update, result }) => {
			try {
				// A success clears the form: the sheet stays mounted, and the next link must not take this Title.
				await update({ reset: result.type === 'success' });
			} finally {
				busy = false;
			}
			if (result.type === 'success') onclose();
		};
	};
</script>

<Sheet title="Add a link" {open} {onclose}>
	<form
		id="{uid}-form"
		method="POST"
		{action}
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{ label: 'A link', submit }}
	>
		<div>
			<label class={LABEL} for="{uid}-url">Link</label>
			<input
				id="{uid}-url"
				name="urls"
				type="url"
				inputmode="url"
				autocomplete="off"
				placeholder="Paste a YouTube or web link"
				class={FIELD}
				bind:value={url}
				aria-invalid={message ? 'true' : undefined}
				aria-describedby={message ? `${uid}-error` : undefined}
			/>
			{#if message}
				<p id="{uid}-error" class={FIELD_ERROR} role="alert">
					<Icon name="warning" size={16} filled />{message}
				</p>
			{/if}
			{#if found}
				<div class="mt-2 flex items-center gap-3 rounded-[14px] bg-surface p-2.5">
					{#if found.youtube}
						<span
							class="grid h-10 w-14 flex-none place-items-center rounded-[9px] bg-band text-band-small"
							><Icon name="play" size={16} filled /></span
						>
					{:else}
						<span
							class="grid size-10 flex-none place-items-center rounded-xl bg-accent-soft text-accent-text"
							><Icon name="link" size={20} /></span
						>
					{/if}
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="truncate text-[15px] font-bold text-ink">{found.title}</span>
						{#if !found.youtube || canSave}
							<span class="text-[13px] text-muted">{found.line}</span>
						{/if}
					</span>
				</div>
			{/if}
		</div>
		<div>
			<label class={LABEL} for="{uid}-title"
				>Title <span class="font-medium text-muted">(optional)</span></label
			>
			<input id="{uid}-title" name="title" maxlength="200" class={FIELD} />
		</div>
	</form>
	{#snippet footer()}
		<button
			type="submit"
			form="{uid}-form"
			class={button('primary', 'md', true)}
			aria-busy={busy}
			disabled={busy}
		>
			{#if busy}<Spinner /><span class="sr-only">Adding…</span>{:else}Add link{/if}
		</button>
	{/snippet}
</Sheet>
