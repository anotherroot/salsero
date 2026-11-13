<script lang="ts">
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import LinkLevel from './LinkLevel.svelte';
	import { t } from '$lib/i18n/catalog';
	import { copyHereLines } from '$lib/clones/copy-here';
	import { CopyHereLoad } from '$lib/clones/copy-here-load.svelte';
	import { cancelLabel, loadFailed, twinChoiceLabel, whichTitle } from '$lib/clones/view';
	import type { ElsewhereKind } from '$lib/types';

	/**
	 * Link from other places, the card (board option B2): a row from the
	 * person's own app or another group, tapped in a group's picker, asks before
	 * it is copied. It says what comes along and what stays behind, asks Copy
	 * to…'s twin questions, and refuses when the group's space is full. Copy
	 * and link is the primary; with `restore` (the family's member here is
	 * archived) Restore and link; with `sameName` (the group has its own of
	 * that name) a warning on top, Link the group's one the primary and Copy
	 * anyway below it.
	 *
	 * Stacked over the picker (Back closes only the card), light or dark as
	 * the picker is. Mounted while open; it loads the plan as it mounts.
	 *
	 * `then` 'use' (a group's field pickers: a figure's positions, a routine's
	 * slots): nothing is linked, the copy is used, and the card says so (Copy
	 * and use, Restore and use, Use the group's one).
	 */
	interface Props {
		theme: 'light' | 'dark';
		kind: ElsewhereKind;
		id: number;
		label: string;
		/** The place it is copied from; null for the person's own app. */
		from: string | null;
		into: { teamId: number; name: string };
		/** A live group row of the same name from another family. */
		sameName: number | null;
		/** The family's archived member in the group. */
		restore: number | null;
		/** A copy, restore or link is on its way. */
		busy: boolean;
		/** Why the last try was refused. */
		message: string | null;
		/** Dark only: above the picker's layer. */
		z?: string;
		/** What follows the copy: a link (the default), or the field using it. */
		then?: 'link' | 'use';
		oncopy: (use: Record<string, number>) => void;
		onrestore: (use: Record<string, number>) => void;
		onlinkgroups: () => void;
		onclose: () => void;
	}

	let {
		theme,
		kind,
		id,
		label,
		from,
		into,
		sameName,
		restore,
		busy,
		message,
		z = 'z-50',
		then = 'link',
		oncopy,
		onrestore,
		onlinkgroups,
		onclose
	}: Props = $props();

	const uid = $props.id();
	const w = $derived(t().clones.copyHere);
	const using = $derived(then === 'use');
	// The plan and the twin answers: a refresh that hands the card the same row again keeps them.
	const plan = new CopyHereLoad();
	const teamId = $derived(into.teamId);
	$effect(() => {
		void plan.load(kind, id, teamId);
	});
	$effect(() => () => plan.stop());
	const view = $derived(plan.view);
	const failed = $derived(plan.failed);

	const lines = $derived(
		view
			? copyHereLines(view, { kind, label, from, into: into.name, sameName: sameName !== null })
			: null
	);
	/** Copy is held back while the plan is out, or when it would not fit. */
	const cannotCopy = $derived(busy || !lines || lines.room !== null);

	const CAPTION = 'text-[12px] font-bold tracking-wide text-muted uppercase';
	const CARD = 'flex flex-col gap-1 rounded-2xl bg-step p-3.5 text-[14px] leading-[1.4] text-ink-2';
</script>

<LinkLevel
	{theme}
	title={lines?.title ?? w.title(label, into.name)}
	back
	{z}
	onback={onclose}
	{footer}
>
	<div class="flex flex-col gap-3">
		{#if message}<Banner kind="error">{message}</Banner>{/if}
		{#if sameName !== null}
			<Banner kind="warning">{w.sameName(into.name, label, from)}</Banner>
		{/if}
		{#if restore !== null}
			<Banner kind="info">{using ? w.archivedUse : w.archived}</Banner>
		{/if}
		<p class="text-[15px] leading-[1.45] text-ink-2">{using ? w.leadUse(from) : w.lead(from)}</p>
		{#if failed}
			<Banner kind="error">{loadFailed()}</Banner>
		{:else if !lines || !view}
			<div class="grid place-items-center py-6 text-muted"><Spinner /></div>
		{:else}
			<section class={CARD} aria-labelledby="{uid}-goes">
				<h3 id="{uid}-goes" class={CAPTION}>{w.comes}</h3>
				<p>{lines.goes}</p>
				{#each lines.already as line (line)}<p>{line}</p>{/each}
			</section>
			{#if lines.behind}
				<section class={CARD} aria-labelledby="{uid}-behind">
					<h3 id="{uid}-behind" class={CAPTION}>{w.behind}</h3>
					<p>{lines.behind}</p>
				</section>
			{/if}
			{#each view.twins as q, qi (q.gene)}
				<fieldset class="flex flex-col gap-1.5">
					<legend class="px-1 pb-1.5 text-[13px] font-bold text-muted">{whichTitle(q.label)}</legend
					>
					<div class={GROUP}>
						{#each q.choices as c (c.id)}
							<label class="flex min-h-[56px] cursor-pointer items-center gap-3 px-4 py-2">
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="text-[16px] font-bold text-ink">{twinChoiceLabel(c.place)}</span>
									<span class="text-[13px] text-muted">{c.meta}</span>
								</span>
								<input
									type="radio"
									name="{uid}-twin-{qi}"
									value={c.id}
									checked={plan.use[q.gene] === c.id}
									class="size-[22px] flex-none cursor-pointer"
									style="accent-color: var(--color-accent)"
									onchange={() => (plan.use = { ...plan.use, [q.gene]: c.id })}
								/>
							</label>
						{/each}
					</div>
				</fieldset>
			{/each}
			{#if lines.room}<Banner kind="error">{lines.room}</Banner>{/if}
		{/if}
	</div>
</LinkLevel>

{#snippet footer()}
	<div class="flex flex-col gap-2">
		{#if sameName !== null && restore === null}
			<button
				type="button"
				class={button('primary', 'md', true)}
				disabled={busy}
				aria-busy={busy}
				onclick={onlinkgroups}
				>{#if busy}<Spinner />{:else}<Icon name="link" size={20} />{using
						? w.useGroups
						: w.linkGroups}{/if}</button
			>
			<div class="grid grid-cols-2 gap-2">
				<button type="button" class={button('tertiary', 'md', true)} onclick={onclose}
					>{cancelLabel()}</button
				>
				<button
					type="button"
					class={button('tertiary', 'md', true)}
					disabled={cannotCopy}
					onclick={() => oncopy(plan.use)}>{w.copyAnyway}</button
				>
			</div>
		{:else}
			<div class="grid grid-cols-[1fr_2fr] gap-2">
				<button type="button" class={button('tertiary', 'md', true)} onclick={onclose}
					>{cancelLabel()}</button
				>
				{#if restore !== null}
					<button
						type="button"
						class={button('primary', 'md', true)}
						disabled={busy}
						aria-busy={busy}
						onclick={() => onrestore(plan.use)}
						>{#if busy}<Spinner />{:else}<Icon name="undo" size={20} />{using
								? w.restoreAndUse
								: w.restoreAndLink}{/if}</button
					>
				{:else}
					<button
						type="button"
						class={button('primary', 'md', true)}
						disabled={cannotCopy}
						aria-busy={busy}
						onclick={() => oncopy(plan.use)}
						>{#if busy}<Spinner />{:else}<Icon name="copy" size={20} />{using
								? w.copyAndUse
								: w.copyAndLink}{/if}</button
					>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}
