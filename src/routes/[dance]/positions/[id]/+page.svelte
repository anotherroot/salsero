<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import SourceTabs from '$lib/components/clones/SourceTabs.svelte';
	import MakeMineSheet from '$lib/components/clones/MakeMineSheet.svelte';
	import PositionSheet from '$lib/components/positions/PositionSheet.svelte';
	import PointStill from '$lib/components/positions/PointStill.svelte';
	import { CLIP, GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { cloneSubtitle } from '$lib/clones/view';
	import {
		ARCHIVED,
		MAKE_MINE_NOTE,
		NEW_FIGURE,
		NONE_YET,
		deadEnd,
		editTitle,
		figureFromRow,
		figureIntoRow,
		fromTitle,
		holdChips,
		intoTitle,
		moreLine,
		orphan,
		pictureLine,
		positionFromLessonNote,
		positionSubtitle,
		routinesTitle,
		SHEET,
		spotVideoLabel,
		styleLabelOf,
		throughMeta
	} from '$lib/positions/view';
	import type { ActionData, PageData, SubmitFunction } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const position = $derived(data.position);
	const slug = $derived(data.dance.slug);
	const styleLabel = $derived(styleLabelOf(data.dance.styleLabel));
	/** A group's position read by someone who cannot edit it: whose it is. */
	const readerTeam = $derived(data.canEdit ? null : data.team);
	const archived = $derived(position.archived);
	const chips = $derived(holdChips(position.hold));

	/** The band's subtitle: a copy's "Your copy · from …" or a group's "<Group>’ position", then the counts. */
	const subtitle = $derived(
		positionSubtitle(position, {
			lead: data.inGroupMode ? undefined : (cloneSubtitle(data.cloneLine) ?? undefined),
			ins: data.counts.inCount,
			outs: data.counts.outCount
		})
	);

	// New figure from it (ruling 8): the figures list's New move, tagged with it.
	const figuresHref = $derived(resolve('/[dance]/figures', { dance: slug }));
	const newFrom = $derived(`${figuresHref}?new=1&start=${position.id}`);
	const newInto = $derived(`${figuresHref}?new=1&end=${position.id}`);
	const figureHref = (id: number) =>
		resolve('/[dance]/figures/[id]', { dance: slug, id: String(id) });
	const routineHref = (id: number) =>
		resolve('/[dance]/routines/[id]', { dance: slug, id: String(id) });

	// A dead end or an orphan is the person's own report (not the group's workspace), and only
	// says so where they could add the figure that mends it.
	const gap = $derived(
		!data.canTag || data.inGroupMode
			? null
			: data.counts.deadEnd
				? { ...deadEnd(position.name, data.counts.inCount), href: newFrom }
				: data.counts.orphan
					? { ...orphan(position.name, data.counts.outCount), href: newInto }
					: null
	);

	let editing = $state(false);
	let makingMine = $state(false);
	/** "In routines": three, then "and N more" shows the rest in place. */
	let allRoutines = $state(false);
	const routines = $derived(allRoutines ? data.routines : data.routines.slice(0, 3));

	// Restore (an archived position): one tap, its refusal under it, the button back.
	let restoring = $state(false);
	const restore: SubmitFunction = ({ cancel }) => {
		if (restoring) return cancel();
		restoring = true;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				restoring = false;
			}
		};
	};
	const restoreRefusal = $derived(
		form && 'action' in form && form.action === 'restore' && 'message' in form
			? String(form.message)
			: null
	);
</script>

<svelte:head><title>{position.name} · {data.dance.label}</title></svelte:head>

<Screen compact title={position.name} {subtitle}>
	{#snippet left()}
		<BackButton
			fallback={{
				href: resolve('/[dance]/positions', { dance: slug }),
				label: 'Back to Positions'
			}}
		/>
	{/snippet}
	{#snippet right()}
		{#if data.historyHref}
			<BandButton icon="clock" label="History" href={data.historyHref} />
		{/if}
		{#if data.canEdit && !archived}
			<BandButton
				focusKey="edit-position"
				icon="pencil"
				label={editTitle(position.name)}
				onclick={() => (editing = true)}
			/>
		{/if}
	{/snippet}

	<div class="flex flex-col gap-2 {data.makeMine ? 'pb-40' : 'pb-4'}">
		<SourceTabs
			sources={data.sources}
			kind="position"
			dance={slug}
			current={position.id}
			mineId={data.mineId}
			compare={data.compare}
			family={data.family}
			drop={data.drop}
			detach={data.detach}
			copy={data.copyTo}
			sameAs={data.sameAs}
		/>

		{#if archived}
			<Banner kind="warning" title={ARCHIVED.title}>
				{ARCHIVED.body}
				{#snippet action()}
					{#if data.canEdit}
						<form method="POST" action="?/restore" use:enhance={restore}>
							<button
								type="submit"
								class={button('secondary', 'sm')}
								aria-busy={restoring}
								disabled={restoring}
							>
								<!-- Both in one cell: the label keeps the width while the spinner shows. -->
								<span class="grid place-items-center">
									<span class="col-start-1 row-start-1" class:invisible={restoring}
										>{ARCHIVED.restore}</span
									>
									{#if restoring}<span class="col-start-1 row-start-1"><Spinner size={18} /></span
										>{/if}
								</span>
							</button>
						</form>
					{/if}
				{/snippet}
			</Banner>
			{#if restoreRefusal}
				<Banner kind="error">{restoreRefusal}</Banner>
			{/if}
		{/if}

		{#if readerTeam && data.fromLesson}
			<p
				class="flex items-start gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-[14px] leading-snug text-accent-text"
			>
				<span class="mt-px flex-none"><Icon name="group" size={18} /></span>
				<span>{positionFromLessonNote(data.fromLesson, readerTeam.name)}</span>
			</p>
		{/if}

		<div class="flex flex-wrap gap-1.5">
			<Badge tone="accent">{styleLabel(position.styleTag)}</Badge>
		</div>

		{#if data.picture}
			{@const picture = data.picture}
			<div class="{CLIP} rounded-2xl bg-surface">
				<PointStill src={picture.video.src} ms={picture.spot.startMs} />
				<div class="flex min-h-11 items-center gap-2 py-1 pr-1.5 pl-3.5">
					<span class="flex-none text-muted"><Icon name="bookmark" size={18} /></span>
					<span class="min-w-0 flex-1 text-[13px] text-muted"
						>{pictureLine(spotVideoLabel(picture.video), picture.spot.startMs)}</span
					>
					{#if data.canEdit && !archived}
						<!-- The picture is chosen in the edit sheet, among the linked points. -->
						<button
							type="button"
							class={button('tertiary', 'sm')}
							aria-haspopup="dialog"
							onclick={() => (editing = true)}>{SHEET.change}</button
						>
					{/if}
				</div>
			</div>
		{/if}

		{#if chips.length > 0}
			<ul class="flex flex-wrap gap-1.5" aria-label="Hold">
				{#each chips as chip (chip)}
					<li><Badge>{chip}</Badge></li>
				{/each}
			</ul>
		{/if}

		{#if position.notes}
			<section class="flex flex-col gap-1.5 rounded-2xl bg-surface px-4 pt-3.5 pb-4">
				<h2 class="text-[13px] font-bold text-muted">Notes</h2>
				<LinkedText
					text={position.notes}
					class="text-[16px] leading-[1.45] font-medium whitespace-pre-line text-ink-2"
				/>
			</section>
		{/if}

		{#if gap}
			<Banner kind="warning" title={gap.title}>
				{gap.body}
				{#snippet action()}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
					<a href={gap.href} class={button('secondary', 'sm')}>{gap.action}</a>
				{/snippet}
			</Banner>
		{/if}

		<div class="flex min-h-11 items-center justify-between pt-1.5 pr-1">
			<h2 class={SECTION_LABEL}>{fromTitle(data.from.length)}</h2>
			{#if data.canTag}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
				<a href={newFrom} class={button('tertiary', 'sm')}
					><Icon name="plus" size={18} />{NEW_FIGURE}</a
				>
			{/if}
		</div>
		{#if data.from.length === 0}
			<p class="rounded-2xl bg-surface px-4 py-3.5 text-[14px] text-muted">{NONE_YET}</p>
		{:else}
			<ul class={GROUP}>
				{#each data.from as f (f.id)}
					<li>{@render figureRow(f.id, f.label, figureFromRow(f))}</li>
				{/each}
			</ul>
		{/if}

		<h2 class="{SECTION_LABEL} pt-2.5">{intoTitle(data.into.length)}</h2>
		{#if data.into.length === 0}
			<p class="rounded-2xl bg-surface px-4 py-3.5 text-[14px] text-muted">{NONE_YET}</p>
		{:else}
			<ul class={GROUP}>
				{#each data.into as f (f.id)}
					<li>{@render figureRow(f.id, f.label, figureIntoRow(f))}</li>
				{/each}
			</ul>
		{/if}

		<!--
			Task 17: "Video · N" (data.spots: SectionCard for a section, PointCard for a
			point, Link a section or point…) and "Lessons · N" (data.lessons, Link a
			lesson…) go here, between the figures and the routines.
		-->

		{#if data.routines.length > 0}
			<h2 class="{SECTION_LABEL} pt-2.5">{routinesTitle(data.routines.length)}</h2>
			<ul class={GROUP}>
				{#each routines as r (r.id)}
					<li>
						<a
							href={routineHref(r.id)}
							class="flex min-h-[60px] items-center gap-2.5 py-2 pr-3.5 pl-4"
						>
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-[16px] leading-tight font-bold text-ink">{r.name}</span>
								<span class="text-[13px] text-muted">{throughMeta(r.pairs)}</span>
							</span>
							<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
						</a>
					</li>
				{/each}
				{#if !allRoutines && data.routines.length > 3}
					<li>
						<button
							type="button"
							class="flex min-h-12 w-full cursor-pointer items-center py-2 pr-3.5 pl-4 text-left text-[15px] font-bold text-accent-text"
							aria-expanded="false"
							onclick={() => (allRoutines = true)}>{moreLine(data.routines.length - 3)}</button
						>
					</li>
				{/if}
			</ul>
		{/if}
	</div>
</Screen>

{#snippet figureRow(id: number, label: string, meta: string)}
	<a href={figureHref(id)} class="flex min-h-[60px] items-center gap-3 py-2 pr-3.5 pl-4">
		<span
			class="flex size-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
			aria-hidden="true"><Icon name="figures" size={22} /></span
		>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] leading-tight font-bold text-ink">{label}</span>
			{#if meta}<span class="text-[13px] text-muted">{meta}</span>{/if}
		</span>
		<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
{/snippet}

<!-- A reader's pinned row: Edit makes the position theirs (Make it mine). -->
{#if data.makeMine}
	<BottomBar>
		<button
			type="button"
			class={button('secondary', 'md', true)}
			aria-haspopup="dialog"
			aria-describedby="make-mine-note"
			onclick={() => (makingMine = true)}><Icon name="pencil" size={20} />Edit</button
		>
		<p id="make-mine-note" class="mt-2 text-center text-[13px] text-muted">{MAKE_MINE_NOTE}</p>
	</BottomBar>
	<MakeMineSheet open={makingMine} onclose={() => (makingMine = false)} offer={data.makeMine} />
{/if}

<!-- Mounted while open, so its fields start from the position as it is now, after any save. -->
{#if editing && data.canEdit && !archived}
	<PositionSheet
		open={true}
		onclose={() => (editing = false)}
		mode="edit"
		action="?/update"
		dance={slug}
		{position}
		points={data.spots}
		defaultStyle={data.defaultStyle}
		seen={data.seen ?? undefined}
	/>
{/if}
