<script lang="ts">
	import { withView } from '$lib/teams/group-view';
	import { page } from '$app/state';
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
	import Versions from '$lib/components/clones/Versions.svelte';
	import ItemMenu from '$lib/components/clones/ItemMenu.svelte';
	import { hasMenu, type CloneOffers } from '$lib/clones/menu';
	import { menuLabel } from '$lib/menu';
	import MakeMineSheet from '$lib/components/clones/MakeMineSheet.svelte';
	import PositionSheet from '$lib/components/positions/PositionSheet.svelte';
	import PointStill from '$lib/components/positions/PointStill.svelte';
	import PointRow from '$lib/components/positions/PointRow.svelte';
	import PositionRelations from '$lib/components/positions/PositionRelations.svelte';
	import PositionLinkPicker from '$lib/components/positions/PositionLinkPicker.svelte';
	import SectionRow from '$lib/components/figures/SectionRow.svelte';
	import SectionPlayer from '$lib/components/ui/SectionPlayer.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import UnlinkVia from '$lib/components/lessons/UnlinkVia.svelte';
	import { CLIP, GROUP, SECTION_LABEL, button, iconButton } from '$lib/components/ui/styles';
	import { cloneSubtitle } from '$lib/clones/view';
	import { viaBadge } from '$lib/lessons/page';
	import { focusAfterRemoval, focusKeyed } from '$lib/focus';
	import { t } from '$lib/i18n/catalog';
	import { spotLabel } from '$lib/video/spots';
	import type { PickRow } from '$lib/picker/model';
	import type { SectionVideo, Spot, ViaSection } from '$lib/types';
	import {
		ADD_SPOT,
		LESSON_PICK,
		LINK_LESSON,
		LINK_SPOTS,
		lessonMeta,
		lessonPickGroups,
		lessonPickTitle,
		lessonsTitle,
		recordingsTitle,
		unlinkFocus,
		unlinkLabel,
		linkSpotsSub,
		linkSpotsTitle,
		pointLabel,
		positionMenuItems,
		spotPickGroups,
		ARCHIVED,
		BUSY,
		makeMineNote,
		deadEnd,
		editTitle,
		holdChips,
		orphan,
		pictureLine,
		positionFromLessonNote,
		positionSubtitle,
		SHEET,
		spotVideoLabel,
		styleLabelOf
	} from '$lib/positions/view';
	import type { ActionData, PageData, SubmitFunction } from './$types';
	// The page's group view (`?in=`, or its row's): links to the lists keep it.
	const viewTeam = $derived(page.data.groupMode?.teamId ?? null);

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
	const figuresHref = $derived(
		withView(resolve('/[dance]/(moves)/figures', { dance: slug }), viewTeam)
	);
	const newFrom = $derived(`${figuresHref}?new=1&start=${position.id}`);
	const newInto = $derived(`${figuresHref}?new=1&end=${position.id}`);
	/** New figure from or into it: an editor's, where a figure of theirs may take it (a reader of a group's gets none). */
	const canNew = $derived(data.canTag && data.canEdit);
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

	// Show on the map: the map (in the pane on the desktop), this position picked.
	const mapHref = $derived(
		withView(
			`${resolve('/[dance]/(moves)/positions/map', { dance: slug })}?pick=${position.id}`,
			viewTeam
		)
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
		leaveOrAsk(editArea ?? null, () => void finishEditing(), t().figure.edit.stop);
	}
	// Another position opened in this pane (the same route): leave edit mode for it.
	const positionId = $derived(position.id);
	$effect(() => {
		void positionId;
		editing = null;
	});
	let makingMine = $state(false);

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

	// --- Recordings and Lessons: an editor links from the pickers; a row's Unlink takes it away.
	/** Links are an editor's, while the position is live. */
	const canLink = $derived(data.canEdit && !archived);
	let linking = $state<'spot' | 'lesson' | null>(null);
	const lessonHref = (id: number) =>
		resolve('/[dance]/lessons/[id]', { dance: slug, id: String(id) });
	/** An unlink's refusal, under its list. */
	const refusal = (action: 'unlinkSpot' | 'unlinkLesson') =>
		form && 'action' in form && form.action === action && 'message' in form
			? String(form.message)
			: null;
	// One-tap unlinks: once one lands, focus goes to the next row, else the list's
	// Add or Link, Edit, or (a reader's own) the list's heading (`unlinkFocus`).
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
	/** The band's ⋯ is open. */
	let menuOpen = $state(false);
	/** What the ⋯ offers of the copy actions (ItemMenu, mounted once below the page). */
	const offers = $derived<CloneOffers>({
		sync: data.keep.mode ? data.keep : null,
		drop: data.drop,
		detach: data.detach,
		copy: data.copyTo,
		sameAs: data.sameAs
	});
	/** The page's own ⋯ items: New figure from and into here, Show on the map, History. */
	const ownMenu = $derived(
		positionMenuItems({
			name: position.name,
			newFrom: canNew ? newFrom : null,
			newInto: canNew ? newInto : null,
			mapHref: archived ? null : mapHref,
			historyHref: data.historyHref
		})
	);
</script>

<svelte:head><title>{position.name} · {data.dance.label}</title></svelte:head>

<Screen
	compact
	width="two"
	title={position.name}
	subtitle={editing === 'pane' ? t().positions.page.editing : subtitle}
>
	{#snippet left()}
		{#if editing === 'pane'}
			<BandButton
				focusKey="stop-editing"
				icon="close"
				label={t().figure.edit.stop}
				onclick={stopEditing}
			/>
		{:else}
			<BackButton
				fallback={{
					href: withView(resolve('/[dance]/(moves)/positions', { dance: slug }), viewTeam),
					label: t().shell.backTo(t().moves.segments.positions)
				}}
			/>
		{/if}
	{/snippet}
	{#snippet right()}
		<!-- As the figure page's band: Edit and ⋯. While editing in the pane, the Save pinned at the bottom saves and closes edit mode. -->
		{#if editing !== 'pane'}
			{#if data.canEdit && !archived}
				<BandButton
					focusKey="edit-position"
					icon="pencil"
					label={editTitle(position.name)}
					onclick={startEditing}
				/>
			{/if}
			{#if hasMenu(ownMenu, offers)}
				<BandButton
					icon="more"
					label={menuLabel('position')}
					focusKey="item-menu"
					onclick={() => (menuOpen = true)}
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
	The position in its pane (desktop spec, "Two columns"), in the figure page's
	order: a reader's note, a gap and the source tabs under the header, then two
	columns from a 780 px pane, 1 : 1 (the picture, the facts and Recordings on the
	left; Lessons and the card of figures on the right). One column below that and
	on the phone, in that order. Versions (whose toast is `fixed`) sits outside
	PaneColumns: nothing pinned lives in its size container.
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
					<a href={gap.href} class={button('secondary', 'sm')}>{gap.action}</a>
				{/snippet}
			</Banner>
		{/if}

		<Versions
			sources={data.sources}
			kind="position"
			dance={slug}
			current={position.id}
			mineId={data.mineId}
			self={data.cloneLine.self}
			title={position.name}
			family={data.family}
			step={data.step}
			keep={data.keep}
		/>

		<PaneColumns ratio="1:1" class="gap-2" left={about} right={around} />
	</div>
{/snippet}

{#snippet about()}
	<!-- The picture first, when there is one: a still, chosen in Edit among the linked points. -->
	{#if data.picture}
		{@const picture = data.picture}
		<div class="{CLIP} relative rounded-2xl bg-surface">
			<PointStill
				src={picture.video.src}
				ms={picture.spot.startMs}
				label={pictureLine(spotVideoLabel(picture.video), picture.spot.startMs)}
				class="aspect-video w-full"
			/>
			<span
				class="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-linear-to-b from-transparent to-black/65 px-3 pt-6 pb-2.5 text-[13px] font-semibold text-white"
				aria-hidden="true">{pictureLine(spotVideoLabel(picture.video), picture.spot.startMs)}</span
			>
		</div>
	{/if}

	<!-- The position's own facts: its type, the hold, the notes. -->
	<section class="flex flex-col gap-3.5 rounded-2xl bg-surface p-4" aria-label={t().figure.facts}>
		<div class="flex flex-wrap gap-1.5">
			<Badge tone="accent">{styleLabel(position.styleTag)}</Badge>
		</div>
		{#if chips.length > 0}
			<div class="flex flex-col gap-1.5">
				<span class="text-[13px] font-bold text-muted">{t().positions.page.hold}</span>
				<ul class="flex flex-wrap gap-1.5" aria-label={t().positions.page.hold}>
					{#each chips as chip (chip)}
						<li><Badge>{chip}</Badge></li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if position.notes}
			<div class="-mx-4 h-px bg-hairline"></div>
			<LinkedText
				text={position.notes}
				class="text-[15px] leading-[1.45] font-medium whitespace-pre-line text-ink-2"
			/>
		{/if}
	</section>

	<!--
		Recordings (as the figure page's): the linked sections and points in one card,
		an editor's + Add in the heading row. Sections loop full screen; a point opens
		the player at its moment. A reader with nothing here sees nothing.
	-->
	{#if data.spots.length > 0 || canLink}
		<section class="flex flex-col gap-2 pt-3.5">
			<div class="flex min-h-11 items-center justify-between">
				<h2 class={SECTION_LABEL} tabindex="-1" data-focus="recordings-heading">
					{recordingsTitle(data.spots.length)}
				</h2>
				{#if canLink}
					<button
						type="button"
						data-focus="link-spot"
						class={button('tertiary', 'sm')}
						aria-label={ADD_SPOT.aria}
						aria-haspopup="dialog"
						onclick={() => (linking = 'spot')}
						><Icon name="plus" size={20} />{ADD_SPOT.label}</button
					>
				{/if}
			</div>
			{#if data.spots.length > 0}
				<ul class={GROUP}>
					{#each data.spots as s (s.linkId)}
						{#snippet unlinkThis()}{@render unlinkSpotButton(s)}{/snippet}
						<li>
							{#if s.point}
								<PointRow
									spot={s}
									picture={data.picture?.linkId === s.linkId}
									focusKey="spot-{s.linkId}"
									canEdit={s.canEdit}
									trailing={s.canUnlink ? unlinkThis : undefined}
								/>
							{:else}
								<SectionRow
									section={s}
									focusKey="spot-{s.linkId}"
									canEdit={s.canEdit}
									trailing={s.canUnlink ? unlinkThis : undefined}
								/>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if refusal('unlinkSpot')}
				<FieldError id="unlink-spot-error" message={refusal('unlinkSpot') ?? ''} />
			{/if}
		</section>
	{/if}
{/snippet}

{#snippet around()}
	<!-- Lessons: linked by hand, or there through a section or point of their videos. -->
	<!-- The right column's first heading sits level with the picture from `two:`. -->
	{#if data.lessons.length > 0 || canLink}
		<section class="flex flex-col gap-2 pt-3.5 two:pt-0">
			<div class="flex min-h-11 items-center justify-between">
				<h2 class={SECTION_LABEL} tabindex="-1" data-focus="lessons-heading">
					{lessonsTitle(data.lessons.length)}
				</h2>
				{#if canLink}
					<button
						type="button"
						data-focus="link-lesson"
						class={button('tertiary', 'sm')}
						aria-label={LINK_LESSON.aria}
						aria-haspopup="dialog"
						onclick={() => (linking = 'lesson')}
						><Icon name="plus" size={20} />{LINK_LESSON.label}</button
					>
				{/if}
			</div>
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
		</section>
	{/if}

	<!-- What grows with use: three rows, each opening a sheet with search (as the figure page's). -->
	<div class="pt-3.5 {data.lessons.length > 0 || canLink ? '' : 'two:pt-0'}">
		<PositionRelations
			name={position.name}
			from={data.from}
			into={data.into}
			routines={data.routines}
			newFrom={canNew ? newFrom : null}
			newInto={canNew ? newInto : null}
			{figureHref}
			{routineHref}
		/>
	</div>
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

<!-- A reader's pinned row: Edit makes the position theirs (Make it mine). -->
{#if data.makeMine}
	<BottomBar>
		<button
			type="button"
			class={button('secondary', 'md', true)}
			aria-haspopup="dialog"
			aria-describedby="make-mine-note"
			onclick={() => (makingMine = true)}><Icon name="pencil" size={20} />{t().common.edit}</button
		>
		<p id="make-mine-note" class="mt-2 text-center text-[13px] text-muted">{makeMineNote()}</p>
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

<!-- The ⋯ menu and its sheets, once: the band (drawn twice) only holds its button. -->
<ItemMenu
	bind:open={menuOpen}
	title={position.name}
	kind="position"
	current={position.id}
	own={ownMenu}
	{offers}
/>
