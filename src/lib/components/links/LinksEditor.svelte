<!-- src/lib/components/links/LinksEditor.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { focusAfterRemoval } from '$lib/focus';
	import LinkList from './LinkList.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import {
		FIELD,
		FIELD_ERROR,
		LABEL,
		TEXTAREA,
		button,
		iconButton
	} from '$lib/components/ui/styles';
	import { parseLink } from '$lib/links';
	import { t } from '$lib/i18n/catalog';
	import type { LinkRow } from '$lib/types';

	interface Props {
		links: LinkRow[];
		/** The last addLink failure, if any. */
		message: string | null;
		/** What was typed, handed back by a failed addLink. */
		entered: string;
		/**
		 * Offer Save video on YouTube links — the figure and lesson pages. A drill
		 * has no stored videos, so its links stay links.
		 */
		canSave?: boolean;
		/** The lesson page's denser YouTube row. */
		compact?: boolean;
		/**
		 * The in-page "Add links" form. The lesson page passes false: its
		 * links are added in `AddLinkSheet`, from the heading's "+ Add".
		 */
		adding?: boolean;
	}

	let {
		links,
		message,
		entered,
		canSave = false,
		compact = false,
		adding = true
	}: Props = $props();
	const uid = $props.id();
	let posting = $state<number | null>(null);
	/** Removing a link: focus goes to the next link's Remove, else the box that adds one. */
	const removeLink =
		(id: number): SubmitFunction =>
		() => {
			const keys = links.map((l) => `link-${l.id}`);
			return async ({ update, result }) => {
				await update();
				if (result.type === 'success')
					await focusAfterRemoval(keys, `link-${id}`, adding ? 'links-add' : 'link-add');
			};
		};
	const webHost = (url: string) => {
		const p = parseLink(url);
		return p?.kind === 'web' ? p.host : url;
	};
</script>

<LinkList {links} {compact}>
	{#snippet actions(link, kind)}
		{#if kind === 'youtube'}
			{#if canSave && parseLink(link.url)?.kind === 'youtube'}
				{#if link.saving?.status === 'queued'}
					<span
						role="status"
						class="mr-auto flex items-center gap-2 px-3 text-[13px] font-semibold text-muted"
						><Spinner size={16} />{t().links.save.saving}</span
					>
				{:else if link.saving?.status === 'failed'}
					<span
						class="mr-auto flex min-w-0 items-center gap-1.5 px-3 py-1 text-[13px] font-bold break-words text-danger"
						><Icon name="warning" size={16} filled />{t().links.save.failed(
							link.saving.error ?? t().links.save.unknown
						)}</span
					>
					<form
						method="POST"
						action="?/retryVideo"
						use:enhance={() => {
							posting = link.id;
							return async ({ update }) => {
								try {
									await update();
								} finally {
									posting = null;
								}
							};
						}}
					>
						<input type="hidden" name="linkId" value={link.id} />
						<button type="submit" class={button('tertiary', 'sm')} disabled={posting === link.id}
							>{#if posting === link.id}<Spinner size={18} />{:else}<Icon
									name="refresh"
									size={18}
								/>{/if}{t().links.save.retry}</button
						>
					</form>
				{:else}
					<form
						method="POST"
						action="?/saveVideo"
						class="mr-auto"
						use:enhance={() => {
							posting = link.id;
							return async ({ update }) => {
								try {
									await update();
								} finally {
									posting = null;
								}
							};
						}}
					>
						<input type="hidden" name="linkId" value={link.id} />
						<button type="submit" class={button('secondary', 'sm')} disabled={posting === link.id}>
							{#if posting === link.id}<Spinner size={18} />{:else}<Icon
									name="download"
									size={18}
								/>{/if}{t().links.save.save}
						</button>
					</form>
				{/if}
			{/if}
			<form method="POST" action="?/deleteLink" use:enhance={removeLink(link.id)} class="ml-auto">
				<input type="hidden" name="linkId" value={link.id} />
				<button data-focus="link-{link.id}" type="submit" class={button('danger-text', 'sm')}
					><Icon name="trash" size={18} />{t().common.remove}</button
				>
			</form>
		{:else}
			<form method="POST" action="?/deleteLink" use:enhance={removeLink(link.id)}>
				<input type="hidden" name="linkId" value={link.id} />
				<button
					data-focus="link-{link.id}"
					type="submit"
					class={iconButton('bare', 'muted')}
					aria-label={t().links.save.removeOf(link.title ?? webHost(link.url))}
					><Icon name="trash" size={20} /></button
				>
			</form>
		{/if}
	{/snippet}
</LinkList>

{#if adding}<form
		method="POST"
		action="?/addLink"
		class="mt-3 flex flex-col gap-3.5"
		use:guarded={{
			label: t().links.add.label,
			submit:
				() =>
				async ({ update, result }) => {
					// Keep the typed text on a failure so the bad line can be fixed in place.
					await update({ reset: result.type === 'success' });
				}
		}}
	>
		<div>
			<label class={LABEL} for="{uid}-urls">{t().links.add.many}</label>
			<textarea
				data-focus="links-add"
				id="{uid}-urls"
				name="urls"
				rows="2"
				placeholder={t().links.add.manyPlaceholder}
				aria-invalid={message ? 'true' : undefined}
				aria-describedby={message ? `${uid}-error` : undefined}
				class={TEXTAREA}>{entered}</textarea
			>
			{#if message}
				<p id="{uid}-error" class={FIELD_ERROR} role="alert">
					<Icon name="warning" size={16} filled />{message}
				</p>
			{/if}
		</div>
		<div>
			<label class={LABEL} for="{uid}-title"
				>{t().links.add.titleField}
				<span class="font-medium text-muted">{t().links.add.optional}</span></label
			>
			<input
				id="{uid}-title"
				name="title"
				maxlength="200"
				placeholder={t().links.add.titlePlaceholder}
				class={FIELD}
			/>
		</div>
		<button type="submit" class={button('secondary', 'md', true)}
			><Icon name="plus" size={20} />{t().links.add.submit}</button
		>
	</form>{/if}
