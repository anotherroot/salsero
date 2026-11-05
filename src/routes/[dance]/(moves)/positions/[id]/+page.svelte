<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { desk } from '$lib/nav/desk.svelte';
	import { leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import PaneColumns from '$lib/components/ui/PaneColumns.svelte';
	import PositionForm from '$lib/components/positions/PositionForm.svelte';
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
	import PointCard from '$lib/components/positions/PointCard.svelte';
	import PositionLinkPicker from '$lib/components/positions/PositionLinkPicker.svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import SectionPlayer from '$lib/components/ui/SectionPlayer.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import PickerOpener from '$lib/components/picker/PickerOpener.svelte';
	import UnlinkVia from '$lib/components/lessons/UnlinkVia.svelte';
	import { CLIP, GROUP, SECTION_LABEL, button, iconButton } from '$lib/components/ui/styles';
	import { cloneSubtitle } from '$lib/clones/view';
	import { viaBadge } from '$lib/lessons/page';
	import { focusAfterRemoval, focusKeyed } from '$lib/focus';
	import { spotLabel } from '$lib/video/spots';
	import type { PickRow } from '$lib/picker/model';
	import type { SectionVideo, Spot, ViaSection } from '$lib/types';
	import {
		LESSON_PICK,
		LINK_LESSON,
		LINK_SPOT,
		LINK_SPOTS,
		lessonMeta,
		lessonPickGroups,
		lessonPickTitle,
		lessonsTitle,
		unlinkFocus,
		unlinkLabel,
		linkSpotsSub,
		linkSpotsTitle,
		pointLabel,
		spotPickGroups,
		videoTitle,
		ARCHIVED,
		BUSY,
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
	const figuresHref = $derived(resolve('/[dance]/(moves)/figures', { dance: slug }));
	const newFrom = $derived(`${figuresHref}?new=1&start=${position.id}`);
	const newInto = $derived(`${figuresHref}?new=1&end=${position.id}`);
	const figureHref = (id: number) =>
		resolve('/[dance]/(moves)/figures/[id]', { dance: slug, id: String(id) });
	const routineHref = (id: number) =>
		resolve('/[dance]/(moves)/routines/[id]', { dance: slug, id: String(id) });

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

	// Show on the map (desktop): the map in the pane, this position picked.
	const mapHref = $derived(
		`${resolve('/[dance]/(moves)/positions/map', { dance: slug })}?pick=${position.id}`
	);

	/**
	 * Where Edit opened, decided once when it is pressed (desktop spec, "Editing a
	 * position"): in place in the pane on the desktop, today's sheet on the phone.
	 * It is behaviour, not layout, so `desk` may decide it; a resize while editing
	 * keeps it, so nothing typed is remounted away.
	 */
	let editing = $state<'pane' | 'sheet' | null>(null);
	/** The pane's edit form, for "Stop editing"'s question. */
	let editArea = $state<HTMLElement>();
	/** The pane's Save is out (PositionForm's `busy`). */
	let saving = $state(false);
	async function startEditing() {
		if (!desk.current) {
			editing = 'sheet';
			return;
		}
		window.scrollTo({ top: 0 });
		editing = 'pane';
		await tick();
		// The Edit button that was focused is gone: hand focus to its successor.
		focusKeyed('stop-editing');
	}
	async function finishEditing() {
		editing = null;
		await tick();
		focusKeyed('edit-position');
	}
	function stopEditing() {
		leaveOrAsk(editArea ?? null, () => void finishEditing(), 'Stop editing');
	}
	// Another position opened in this pane (the same route): leave edit mode for it.
	const positionId = $derived(position.id);
	$effect(() => {
		void positionId;
		editing = null;
	});
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

	// --- Video and Lessons: an editor links from the pickers; a row's Unlink takes it away.
	/** Links are an editor's, while the position is live. */
	const canLink = $derived(data.canEdit && !archived);
	/** The right column's first list: its heading drops its top padding from `two:`. */
	const rightFirst = $derived(
		data.spots.length > 0 || canLink ? 'video' : data.lessons.length > 0 ? 'lessons' : 'routines'
	);
	let linking = $state<'spot' | 'lesson' | null>(null);
	const lessonHref = (id: number) =>
		resolve('/[dance]/lessons/[id]', { dance: slug, id: String(id) });
	/** An unlink's refusal, under its list. */
	const refusal = (action: 'unlinkSpot' | 'unlinkLesson') =>
		form && 'action' in form && form.action === action && 'message' in form
			? String(form.message)
			: null;
	// One-tap unlinks: once one lands, focus goes to the next row, else the list's
	// opener, Edit, or (a reader's own) the list's heading (`unlinkFocus`).
	const unlinkSpot =
		(linkId: number): SubmitFunction =>
		() => {
			const keys = data.spots.map((x) => `spot-${x.linkId}`);
			return async ({ update, result }) => {
				await update();
				if (result.type === 'success')
					await focusAfterRemoval(
						keys,
						`spot-${linkId}`,
						unlinkFocus('spot', { canLink, canEditPosition: canLink })
					);
			};
		};
	const lessonKeys = () => data.lessons.map((x) => `lesson-${x.id}`);
	const lessonFallback = () => unlinkFocus('lesson', { canLink, canEditPosition: canLink });
	const unlinkLesson =
		(id: number): SubmitFunction =>
		() => {
			const keys = lessonKeys();
			return async ({ update, result }) => {
				await update();
				if (result.type === 'success')
					await focusAfterRemoval(keys, `lesson-${id}`, lessonFallback());
			};
		};
	/** A lesson there through its videos, whose Unlink is asking first. */
	let unlinkingVia = $state<{ id: number; title: string; via: ViaSection[] } | null>(null);
	/** The rows as they were when it asked: where focus goes once the row is gone. */
	let viaKeys: string[] = [];
	let viaGone = '';
	const askUnlinkVia = (l: { id: number; title: string; viaSections: ViaSection[] }) => {
		viaKeys = lessonKeys();
		viaGone = `lesson-${l.id}`;
		unlinkingVia = { id: l.id, title: l.title, via: l.viaSections };
	};

	/** ▶ in the spot picker: the section, looping, over the picker. */
	let preview = $state<{ video: SectionVideo; spot: Spot } | null>(null);
	function previewRow(row: PickRow) {
		for (const g of data.linkable) {
			const spot = g.sections.find((s) => s.id === row.value);
			if (spot) {
				preview = { video: g.video, spot };
				return;
			}
		}
	}
</script>

<svelte:head><title>{position.name} · {data.dance.label}</title></svelte:head>

<Screen
	compact
	width="two"
	title={position.name}
	subtitle={editing === 'pane' ? 'Editing' : subtitle}
>
	{#snippet left()}
		{#if editing === 'pane'}
			<BandButton focusKey="stop-editing" icon="close" label="Stop editing" onclick={stopEditing} />
		{:else}
			<BackButton
				fallback={{
					href: resolve('/[dance]/(moves)/positions', { dance: slug }),
					label: 'Back to Positions'
				}}
			/>
		{/if}
	{/snippet}
	{#snippet right()}
		<!-- While editing in the pane, the Save pinned at the bottom saves and closes edit mode. -->
		{#if editing !== 'pane'}
			{#if !archived}
				<!-- The desktop's map button: the map in the pane, with this position picked. -->
				<span class="hidden desk:contents"
					><BandButton icon="graph" label="Show on the map" href={mapHref} /></span
				>
			{/if}
			{#if data.historyHref}
				<BandButton icon="clock" label="History" href={data.historyHref} />
			{/if}
			{#if data.canEdit && !archived}
				<BandButton
					focusKey="edit-position"
					icon="pencil"
					label={editTitle(position.name)}
					onclick={startEditing}
				/>
			{/if}
		{/if}
	{/snippet}

	{#if editing === 'pane' && data.canEdit && !archived}
		<!-- Edit in place (desktop): the form in two columns, its Save pinned below. -->
		<div class="pt-1.5 pb-28" bind:this={editArea}>
			<PositionForm
				columns
				onsaved={() => void finishEditing()}
				formId="position-edit"
				bind:busy={saving}
				mode="edit"
				action="?/update"
				dance={slug}
				{position}
				points={data.spots}
				defaultStyle={data.defaultStyle}
				seen={data.seen ?? undefined}
			/>
		</div>
	{:else}
		{@render content()}
	{/if}
</Screen>

<!--
	The position in its pane (desktop spec, "Two columns"): the type, a reader's note,
	a gap and the source tabs under the header, then two columns from a 780 px pane,
	1 : 1 (the picture, the hold, notes and its figures on the left; video, lessons and
	routines on the right). One column below that and on the phone, in the phone's
	order. SourceTabs (whose toast is `fixed`) sits outside PaneColumns: nothing pinned
	lives in its size container.
-->
{#snippet content()}
	<div class="flex flex-col gap-2 {data.makeMine ? 'pb-40' : 'pb-4'}">
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

		<!-- The boards' order: the type, a reader's note, a gap, then the sources and their row. -->
		<div class="flex flex-wrap gap-1.5">
			<Badge tone="accent">{styleLabel(position.styleTag)}</Badge>
		</div>

		{#if readerTeam && data.fromLesson}
			<p
				class="flex items-start gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-[14px] leading-snug text-accent-text"
			>
				<span class="mt-px flex-none"><Icon name="group" size={18} /></span>
				<span>{positionFromLessonNote(data.fromLesson, readerTeam.name)}</span>
			</p>
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

		<PaneColumns ratio="1:1" class="gap-2" left={about} right={watched} />
	</div>
{/snippet}

{#snippet about()}
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
					<!-- The picture is chosen in the edit form, among the linked points. -->
					<button
						type="button"
						class={button('tertiary', 'sm')}
						aria-haspopup="dialog"
						onclick={startEditing}>{SHEET.change}</button
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

	<div class="flex min-h-11 items-center justify-between pt-1.5 pr-1">
		<h2 class={SECTION_LABEL} tabindex="-1" data-focus="from-heading">
			{fromTitle(data.from.length)}
		</h2>
		<!-- A reader of a group's position gets no New here (the boards show none). -->
		{#if data.canTag && data.canEdit}
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
{/snippet}

{#snippet watched()}
	<!-- Video: sections loop full screen (SectionCard), points play inline from their moment (PointCard). -->
	<!-- The right column's first heading sits level with the picture from `two:`. -->
	{#if data.spots.length > 0 || canLink}
		<h2 class="{SECTION_LABEL} pt-2.5 two:pt-0" tabindex="-1" data-focus="video-heading">
			{videoTitle(data.spots.length)}
		</h2>
		{#if data.spots.length > 0}
			<ul class="flex flex-col gap-2">
				{#each data.spots as s (s.linkId)}
					{#snippet unlinkThis()}{@render unlinkSpotButton(s)}{/snippet}
					<li>
						{#if s.point}
							<PointCard
								spot={s}
								picture={data.picture?.linkId === s.linkId}
								focusKey="spot-{s.linkId}"
								action={s.canUnlink ? unlinkThis : undefined}
							/>
						{:else if s.canUnlink}
							<SectionCard
								section={s}
								focusKey="spot-{s.linkId}"
								canEdit={s.canEdit}
								unlink={unlinkThis}
							/>
						{:else}
							<SectionCard section={s} focusKey="spot-{s.linkId}" canEdit={s.canEdit} />
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if refusal('unlinkSpot')}
			<FieldError id="unlink-spot-error" message={refusal('unlinkSpot') ?? ''} />
		{/if}
		{#if canLink}
			<PickerOpener label={LINK_SPOT} data-focus="link-spot" onclick={() => (linking = 'spot')} />
		{/if}
	{/if}

	<!-- Lessons: linked by hand, or there through a section or point of their videos. -->
	{#if data.lessons.length > 0 || canLink}
		<h2
			class="{SECTION_LABEL} pt-2.5 {rightFirst === 'lessons' ? 'two:pt-0' : ''}"
			tabindex="-1"
			data-focus="lessons-heading"
		>
			{lessonsTitle(data.lessons.length)}
		</h2>
		{#if data.lessons.length > 0}
			<ul class={GROUP}>
				{#each data.lessons as l (l.id)}
					{@const via = viaBadge(l.viaSections)}
					<li class="flex items-center">
						<a
							href={lessonHref(l.id)}
							data-focus="lesson-{l.id}"
							class="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 pr-2 pl-4"
						>
							<span
								class="flex size-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
								aria-hidden="true"><Icon name="lessons" size={20} /></span
							>
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-[16px] leading-tight font-bold text-ink">{l.title}</span>
								<span class="flex flex-wrap items-center gap-1.5 text-[13px] text-muted"
									>{lessonMeta({
										teamName: data.inGroupMode ? null : l.teamName,
										lessonDay: l.lessonDay
									})}{#if via}<Badge>{via}</Badge>{/if}</span
								>
							</span>
							{#if !l.canUnlink}
								<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
							{/if}
						</a>
						{#if l.canUnlink}
							{#if l.viaSections.length > 0}
								<!-- There through its videos: Unlink asks, and takes those links too. -->
								<button
									type="button"
									aria-haspopup="dialog"
									aria-label={unlinkLabel(position.name, l.title)}
									class="{iconButton('bare', 'muted')} mr-1.5"
									onclick={() => askUnlinkVia(l)}><Icon name="unlink" size={22} /></button
								>
							{:else}
								<form
									method="POST"
									action="?/unlinkLesson"
									class="mr-1.5 flex"
									use:enhance={unlinkLesson(l.id)}
								>
									<input type="hidden" name="lessonId" value={l.id} />
									<button
										type="submit"
										aria-label={unlinkLabel(position.name, l.title)}
										aria-describedby={refusal('unlinkLesson') ? 'unlink-lesson-error' : undefined}
										class={iconButton('bare', 'muted')}><Icon name="unlink" size={22} /></button
									>
								</form>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if refusal('unlinkLesson')}
			<FieldError id="unlink-lesson-error" message={refusal('unlinkLesson') ?? ''} />
		{/if}
		{#if canLink}
			<PickerOpener
				label={LINK_LESSON}
				data-focus="link-lesson"
				onclick={() => (linking = 'lesson')}
			/>
		{/if}
	{/if}

	{#if data.routines.length > 0}
		<h2 class="{SECTION_LABEL} pt-2.5 {rightFirst === 'routines' ? 'two:pt-0' : ''}">
			{routinesTitle(data.routines.length)}
		</h2>
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
{/snippet}

<!-- A spot's Unlink: one tap; a group's goes to Recently deleted. -->
{#snippet unlinkSpotButton(s: { linkId: number; point: boolean; spot: Spot })}
	<form method="POST" action="?/unlinkSpot" class="flex" use:enhance={unlinkSpot(s.linkId)}>
		<input type="hidden" name="linkId" value={s.linkId} />
		<button
			type="submit"
			aria-label={unlinkLabel(
				s.point ? pointLabel(s.spot.startMs) : spotLabel(s.spot),
				position.name
			)}
			aria-describedby={refusal('unlinkSpot') ? 'unlink-spot-error' : undefined}
			class={iconButton('bare', 'muted')}><Icon name="unlink" size={22} /></button
		>
	</form>
{/snippet}

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

{#if canLink}
	<PositionLinkPicker
		open={linking === 'spot'}
		onclose={() => (linking = null)}
		title={linkSpotsTitle(position.name)}
		sub={linkSpotsSub(data.team?.name ?? null)}
		placeholder={LINK_SPOTS.search}
		groups={spotPickGroups(data.linkable, data.videoPlaces)}
		nothingLeft={LINK_SPOTS.none}
		emptyIcon="bookmark"
		action="?/linkSpot"
		field="spotId"
		onpreview={previewRow}
	>
		{#snippet top()}
			<p class="px-1 text-[13px] leading-snug text-muted">{LINK_SPOTS.note}</p>
		{/snippet}
	</PositionLinkPicker>
	<PositionLinkPicker
		open={linking === 'lesson'}
		onclose={() => (linking = null)}
		title={lessonPickTitle(position.name)}
		sub={LESSON_PICK.sub}
		placeholder={LESSON_PICK.search}
		groups={lessonPickGroups(data.linkableLessons, data.today)}
		nothingLeft={LESSON_PICK.none}
		emptyIcon="lessons"
		action="?/linkLesson"
		field="lessonId"
	/>
{/if}

{#if preview}
	<SectionPlayer
		src={preview.video.src}
		owner={preview.video.owner}
		spot={preview.spot}
		from={preview.video.from}
		onclose={() => (preview = null)}
	/>
{/if}

{#if unlinkingVia}
	<UnlinkVia
		action="?/unlinkLesson"
		name="lessonId"
		id={unlinkingVia.id}
		label={position.name}
		lesson={unlinkingVia.title}
		via={unlinkingVia.via}
		onclose={() => (unlinkingVia = null)}
		onunlinked={() => void focusAfterRemoval(viaKeys, viaGone, lessonFallback())}
	/>
{/if}

{#if editing === 'pane' && data.canEdit && !archived}
	<BottomBar mode>
		<button
			type="submit"
			form="position-edit"
			class={button('primary', 'md', true)}
			aria-busy={saving}
			aria-label={saving ? BUSY.saving : undefined}
		>
			{#if saving}<Spinner />{:else}{SHEET.save}{/if}
		</button>
	</BottomBar>
{/if}

<!-- Mounted while open, so its fields start from the position as it is now, after any save. -->
{#if editing === 'sheet' && data.canEdit && !archived}
	<PositionSheet
		open={true}
		onclose={() => (editing = null)}
		mode="edit"
		action="?/update"
		dance={slug}
		{position}
		points={data.spots}
		defaultStyle={data.defaultStyle}
		seen={data.seen ?? undefined}
	/>
{/if}
