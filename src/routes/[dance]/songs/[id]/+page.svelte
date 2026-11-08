<script lang="ts">
	import { leaveRemoved } from '$lib/nav/trail.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import CountCard from '$lib/components/songs/CountCard.svelte';
	import SectionsList from '$lib/components/songs/SectionsList.svelte';
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { sectionIndexAt } from '$lib/songs/sections';
	import { MUSIC_START_MIN_S, playFrom } from '$lib/songs/music-start';
	import SongEdit from '$lib/components/songs/SongEdit.svelte';
	import SongTab from '$lib/components/songs/SongTab.svelte';
	import GridTab from '$lib/components/songs/GridTab.svelte';
	import { tick } from 'svelte';
	import { sheetStack } from '$lib/sheets/history.svelte';
	import type { ToastState } from '$lib/act-toast';
	import type { TempoFactor } from '$lib/labels';
	import { t } from '$lib/i18n/catalog';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import MakeMineSheet from '$lib/components/clones/MakeMineSheet.svelte';
	import Versions from '$lib/components/clones/Versions.svelte';
	import ItemMenu from '$lib/components/clones/ItemMenu.svelte';
	import { hasMenu, type CloneOffers } from '$lib/clones/menu';
	import { menuLabel } from '$lib/menu';
	import type { MenuItem } from '$lib/menu';
	import { cloneSubtitle } from '$lib/clones/view';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import SongDetailsSheet from '$lib/components/songs/SongDetailsSheet.svelte';
	import { ADD_SECTION, GROUP, SECTION_LABEL, TAP_ONE, button } from '$lib/components/ui/styles';
	import {
		classSongNote,
		deleteSongBody,
		deleteSongTitle,
		songName,
		stopSharingBody,
		stopSharingTitle
	} from '$lib/songs/library';
	import { reportOpen } from '$lib/teams/opens-api';
	import { songSteps, songSubtitle } from '$lib/songs/song-page';
	import { clock } from '$lib/format';
	import { watchMedia } from '$lib/media';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let audio: HTMLAudioElement | undefined = $state();
	let paused = $state(true);
	let audioDuration = $state(NaN);
	let now = $state(0);
	/** The song has played (or been moved to a beat): until then the count is a guess. */
	let played = $state(false);
	let detailsOpen = $state(false);
	let archiving = $state(false);
	/** Why the song will not play, from the audio element or from play(). */
	let audioProblem: string | null = $state(null);
	/** A group song's ⋯ menu, and what it opens. */
	let unsharing = $state(false);
	let deleting = $state(false);
	/** A reader's Edit: the Make it mine sheet (ruling 12: once Make my own copy). */
	let makingMine = $state(false);

	/** What every edit of a group's song sends back, for the clash check; nothing for one's own. */
	const seen = $derived(data.seen ? JSON.stringify(data.seen) : '');
	const group = $derived(data.group);
	const canEdit = $derived(data.canEdit);
	const groupMenu = $derived(group !== null && (data.historyHref || canEdit));
	/** A group song's own ⋯ items: History, Stop sharing, Delete (each as before). */
	const songOwn = $derived<MenuItem[]>(
		!groupMenu || !group
			? []
			: [
					...(data.historyHref
						? [
								{
									key: 'history',
									icon: 'clock' as const,
									label: 'History',
									href: resolve('/[dance]/groups/[id]/history/[kind]/[rootId]', {
										dance: data.dance.slug,
										id: String(group.id),
										kind: 'song',
										rootId: String(data.song.id)
									})
								}
							]
						: []),
					...(canEdit && data.song.sharedAt !== null
						? [
								{
									key: 'unshare',
									icon: 'eye-off' as const,
									label: 'Stop sharing',
									onclick: () => (unsharing = true)
								}
							]
						: []),
					...(canEdit
						? [
								{
									key: 'delete',
									icon: 'trash' as const,
									label: 'Delete',
									danger: true,
									onclick: () => (deleting = true)
								}
							]
						: [])
				]
	);
	/** A group's ready draft: its editor shares it from the pinned bar. */
	const shareBar = $derived(
		group !== null && canEdit && data.song.sharedAt === null && data.song.status === 'ready'
	);

	// Shown, not preloaded: a group's song counts as opened here, and again when
	// an editor's own Share reloads it with a new sharedAt (so it is never new to them).
	// Keyed on primitives, so a tap's reload does not report it again.
	const openKey = $derived(group ? `${data.song.id}:${data.song.sharedAt}` : null);
	$effect(() => {
		if (openKey !== null) reportOpen('song', Number(openKey.split(':')[0]));
	});

	/*
	 * A save that saw an older version (someone else tapped or renamed since)
	 * is refused with who did it: reload, so the page and the next save see
	 * what is stored now. Once per refusal.
	 */
	let refreshedFor: unknown = null;
	$effect(() => {
		if (form && form !== refreshedFor && 'clash' in form) {
			refreshedFor = form;
			void invalidateAll();
		}
	});

	// One sound at a time: the sample pauses this page's own copy of the song.
	$effect(() => {
		if (sampling.id === data.song.id) audio?.pause();
	});

	const song = $derived(data.song);
	const grid = $derived(data.grid);
	const name = $derived(songName(song));
	/** Opened from the person's copy (`?vs=`): the place this page is, for the note under the tabs. */
	const sourcePlace = $derived(
		data.vs !== null && data.cloneLine.self.kind === 'team' ? data.cloneLine.self.name : null
	);
	const usual = $derived(
		songSubtitle({
			artist: song.artist,
			style: data.dance.styleLabel[song.style] ?? song.style,
			bpm: grid?.bpm ?? null
		})
	);
	/** Where a song of yours came from, else artist, style and tempo. */
	const subtitle = $derived(
		(data.cloneLine.self.kind === 'mine' ? cloneSubtitle(data.cloneLine) : null) ?? usual
	);
	const duration = $derived(
		Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : (song.durationS ?? 0)
	);
	/** The section playing, for the list's marks; before play, as the card reads it: from 0:00. */
	const current = $derived(
		grid ? sectionIndexAt(data.sections, played ? beatIndexAt(grid.beats, now) : 0) : -1
	);
	// Song details' own refusals (`title` is sent with them) live in its sheet.
	const retryRefusal = $derived(form?.action === 'retry' ? form.message : null);
	const steps = $derived(songSteps(song.status, song.sourceUrl === null));

	$effect(() => {
		if (!song.status.startsWith('waiting')) return;
		const t = setInterval(() => invalidateAll(), 10_000);
		return () => clearInterval(t);
	});

	// `timeupdate` fires about 4 times a second; while playing, follow every
	// frame so the thumb and the time glide instead of jumping.
	$effect(() => {
		if (paused || !audio) return;
		const el = audio;
		let frame = 0;
		const follow = () => {
			now = el.currentTime;
			frame = requestAnimationFrame(follow);
		};
		frame = requestAnimationFrame(follow);
		return () => cancelAnimationFrame(frame);
	});

	function toggle() {
		if (!audio) return;
		if (!audio.paused) {
			audio.pause();
			return;
		}
		// From 0:00 the song starts where its music does; the seek bar still reaches 0:00.
		const from = playFrom(audio.currentTime, data.start.at, duration || Number.NaN);
		if (from !== null) seek(from);
		void audio.play().catch((e) => {
			if (!(e instanceof DOMException && e.name === 'AbortError'))
				audioProblem ??= 'The song would not play.';
		});
	}

	function seek(s: number) {
		if (!audio) return;
		audio.currentTime = s;
		now = s;
		played = true;
	}

	/** A section in the list: there, playing. */
	function jump(s: number) {
		seek(s);
		if (audio?.paused) void audio.play().catch(() => {});
	}

	/*
	 * Edit is page state, not a route, registered with the sheet stack: Back (and
	 * ×) leaves Edit before it leaves the page, and the reload after each save,
	 * which resets `page.state`, cannot drop it.
	 */
	let editing = $state(false);
	let editKey: number | null = null;
	let editTab = $state<'grid' | 'song'>('grid');
	let editToast = $state<ToastState | null>(null);
	/** Edit · Song's Music starts group, for the grid's ✎. */
	let startGroup: HTMLElement | undefined = $state();
	/** Edit · Grid, whose Tap on the 1 and + Section the pinned bar calls. */
	let gridPane: ReturnType<typeof GridTab> | undefined = $state();

	function openEdit() {
		if (editing) return;
		editing = true;
		editTab = 'grid';
		editKey = sheetStack.open({
			tryLeave: (leave) => leave(),
			close: () => {
				editing = false;
				editKey = null;
				editToast = null;
			}
		});
	}

	/** ✎ on "Music starts": the Song tab's group, where its choices are. */
	async function showStart() {
		editTab = 'song';
		await tick();
		startGroup?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		startGroup?.focus({ preventScroll: true });
	}

	function leaveEdit() {
		if (editKey !== null) sheetStack.requestClose(editKey);
	}

	// Leaving the page while in Edit: its history entry goes too.
	$effect(() => () => {
		if (editKey !== null) sheetStack.closedByOwner(editKey);
	});

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
</script>

<svelte:head><title>{song.title || 'Song'} · {data.dance.label}</title></svelte:head>

<Screen
	compact
	width="song"
	title={name}
	subtitle={editing ? t().songs.page.edit.subtitle : subtitle}
>
	{#snippet left()}
		{#if editing}
			<BandButton icon="close" label={t().songs.page.edit.leave} onclick={leaveEdit} />
		{:else}
			<BackButton
				fallback={{
					href: resolve('/[dance]/songs', { dance: data.dance.slug }),
					label: 'Back to Music'
				}}
			/>
		{/if}
	{/snippet}
	{#snippet right()}
		{#if editing}
			<!-- Nothing to save: every change saved when it was made. -->
		{:else if canEdit && grid}
			<BandButton icon="edit" label={t().songs.page.edit.open} onclick={openEdit} />
		{:else if canEdit}
			<BandButton icon="edit" label="Song details" onclick={() => (detailsOpen = true)} />
		{:else if data.makeMine}
			<BandButton icon="edit" label="Edit song" onclick={() => (makingMine = true)} />
		{/if}
		{#if !editing && hasMenu(songOwn, offers)}
			<BandButton
				icon="more"
				label={menuLabel('song')}
				focusKey="item-menu"
				onclick={() => (menuOpen = true)}
			/>
		{/if}
	{/snippet}

	<Versions
		sources={data.sources}
		kind="song"
		dance={data.dance.slug}
		current={song.id}
		mineId={data.mineId}
		self={data.cloneLine.self}
		title={name}
		family={data.family}
		step={data.step}
		keep={data.keep}
		taking={sourcePlace}
	/>
	{#if group && !canEdit}
		<Banner kind="info" title={classSongNote(group.name)} />
	{/if}
	{#if form?.action === 'share' && form.message}<Banner kind="error" title={form.message} />{/if}

	{#if grid && song.audioFile}
		<!-- A group's draft is not in anyone's practice yet, its editors' included. -->
		{#if !editing && (!group || song.sharedAt !== null)}
			<a
				href={resolve(`/${data.dance.slug}/player?song=${song.id}`)}
				class={button('secondary', 'md', true)}
			>
				<Icon name="play" size={18} filled />Practice with this song
			</a>
		{/if}

		<!-- preload=auto: the count needs the playhead to be accurate from the first tap. -->
		<audio
			bind:this={audio}
			bind:paused
			bind:duration={audioDuration}
			src="/audio/{song.audioFile}"
			preload="auto"
			class="hidden"
			{@attach watchMedia(`/audio/${song.audioFile}`, (p) => {
				audioProblem =
					p === 'missing'
						? 'The song’s audio file is missing.'
						: 'This browser can’t play the song’s audio.';
			})}
			onplay={() => {
				stopSample();
				played = true;
			}}
			ontimeupdate={() => (now = audio?.currentTime ?? 0)}
			onseeked={() => (now = audio?.currentTime ?? 0)}
		></audio>

		{#if editing}
			<SongEdit
				bind:tab={editTab}
				bind:toast={editToast}
				{now}
				{paused}
				{duration}
				quietUntil={data.start.at >= MUSIC_START_MIN_S ? data.start.at : 0}
				ontoggle={toggle}
				onseek={seek}
			>
				{#snippet gridTab()}
					<GridTab
						bind:this={gridPane}
						beats={grid.beats}
						counts={grid.counts}
						anchors={data.anchors}
						tempoFactor={data.song.tempoFactor as TempoFactor}
						sections={data.sections}
						sectionsJson={data.sectionsJson}
						suggestions={data.suggestions}
						start={data.start}
						{now}
						{played}
						audio={() => (audio && played ? audio : null)}
						seen={() => seen}
						toast={(t) => (editToast = t)}
						onjump={(i) => seek(grid.beats[i])}
						onstart={showStart}
						onsection={() => {}}
					/>
				{/snippet}
				{#snippet gridBar()}
					<button type="button" class={TAP_ONE} onclick={() => gridPane?.tap()}
						>{t().songs.page.tap.button}</button
					>
					<button
						type="button"
						class={ADD_SECTION}
						aria-label={t().songs.page.plusSectionLabel}
						onclick={() => gridPane?.addSection()}
						><Icon name="plus" size={20} />{t().songs.page.plusSection}</button
					>
				{/snippet}
				{#snippet songTab()}
					<SongTab
						bind:startGroup
						{now}
						{name}
						anchors={data.anchors}
						tempoFactor={data.song.tempoFactor as TempoFactor}
						sections={data.sections.length}
						sectionsJson={data.sectionsJson}
						sample={data.sample}
						start={data.start}
						seen={() => seen}
						toast={(t) => (editToast = t)}
						ondetails={() => (detailsOpen = true)}
					/>
				{/snippet}
			</SongEdit>
		{:else}
			<CountCard
				{now}
				{paused}
				{played}
				{duration}
				beats={grid.beats}
				counts={grid.counts}
				sections={data.sections}
				anchors={data.anchors.length}
				startS={data.start.at}
				time={() => (audio && played ? audio.currentTime : null)}
				ontoggle={toggle}
				onseek={seek}
			/>
			{#if audioProblem}<Banner kind="error" title={audioProblem} />{/if}

			{#if data.sample}
				<h2 class="{SECTION_LABEL} pt-3.5">{t().songs.page.listen.sample}</h2>
				<div class={GROUP}>
					<div class="flex min-h-16 items-center gap-1 pr-1 pl-4">
						<div class="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
							<span class="text-[16px] leading-[1.3] font-bold text-ink tabular-nums"
								>{t().songs.page.listen.sampleFrom(clock(data.sample.song.startS))}</span
							>
							<span class="text-[13px] leading-[1.35] text-muted"
								>{t().songs.page.listen.sampleMeta}</span
							>
						</div>
						<SampleButton song={data.sample.song} {name} />
					</div>
				</div>
			{/if}

			<SectionsList sections={data.sections} {current} onjump={jump} />
		{/if}
	{:else}
		{#if steps.length > 0}
			<ul class={GROUP} aria-label="Progress">
				{#each steps as step (step.title)}
					<li class="flex min-h-14 items-center gap-3 py-2 pr-4 pl-4">
						<span class="flex size-6 flex-none items-center justify-center">
							{#if step.state === 'done'}
								<span class="text-done"><Icon name="check-circle" size={24} filled /></span>
							{:else if step.state === 'now'}
								<Spinner size={24} />
							{:else}
								<span class="text-field-line"><Icon name="circle" size={24} /></span>
							{/if}
						</span>
						<span class="flex min-w-0 flex-col gap-0.5">
							<span
								class="text-[16px] leading-[1.3] font-bold {step.state === 'todo'
									? 'text-muted'
									: 'text-ink'}">{step.title}</span
							>
							<span class="text-[13px] leading-[1.35] text-muted">{step.meta}</span>
						</span>
					</li>
				{/each}
			</ul>
			<p class="px-3 pt-1 text-center text-[13px] leading-[1.45] text-muted">
				It runs on the laptop about once a minute while it is on. This page updates by itself.
			</p>
		{:else}
			<Banner kind="error" title="This song failed">{song.error ?? 'Unknown error'}</Banner>
			<form method="POST" action="?/retry" use:enhance class="flex flex-col gap-2">
				<button type="submit" class={button('primary', 'md', true)}>
					<Icon name="refresh" size={20} />Retry
				</button>
				{#if retryRefusal}<Banner kind="error" title={retryRefusal} />{/if}
			</form>
			<a href={resolve(`/${data.dance.slug}/songs?add=1`)} class={button('secondary', 'md', true)}>
				<Icon name="upload" size={20} />Upload a file instead
			</a>
			{#if song.sourceUrl}
				<p class="px-3 text-center text-[13px] break-all text-muted">From {song.sourceUrl}</p>
			{/if}
		{/if}
	{/if}
	{#if shareBar}<div class="h-28 flex-none"></div>{/if}
</Screen>

{#if shareBar}
	<BottomBar width="song">
		<form method="POST" action="?/share" use:enhance class="flex flex-col gap-2">
			<p class="flex items-center justify-center gap-2 text-[13px] text-muted">
				<Badge tone="warn">Draft</Badge>Only the group's editors see it
			</p>
			<button type="submit" class={button('primary', 'md', true)}>
				<Icon name="people" size={20} />Share with the class
			</button>
		</form>
	</BottomBar>
{/if}

{#if data.makeMine}
	<MakeMineSheet open={makingMine} onclose={() => (makingMine = false)} offer={data.makeMine} />
{/if}

<Dialog
	open={unsharing}
	icon="eye-off"
	title={stopSharingTitle(name)}
	body={stopSharingBody(data.users)}
	onclose={() => (unsharing = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (unsharing = false)}
			>Cancel</button
		>
		<form
			method="POST"
			action="?/unshare"
			use:enhance={() =>
				async ({ update }) => {
					unsharing = false;
					await update();
				}}
		>
			<button type="submit" class={button('primary', 'sm')}>Stop sharing</button>
		</form>
	{/snippet}
</Dialog>

<Dialog
	open={deleting}
	icon="trash"
	tone="danger"
	title={deleteSongTitle(name)}
	body={deleteSongBody(data.users)}
	onclose={() => (deleting = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (deleting = false)}
			>Cancel</button
		>
		<form
			method="POST"
			action="?/delete"
			use:enhance={() =>
				async ({ update, result }) => {
					if (result.type === 'redirect') {
						deleting = false;
						await leaveRemoved(result.location);
						return;
					}
					await update();
				}}
		>
			<button type="submit" class={button('danger', 'sm')}>Delete</button>
		</form>
	{/snippet}
</Dialog>

<SongDetailsSheet
	open={detailsOpen}
	onclose={() => (detailsOpen = false)}
	{song}
	dance={data.dance}
	{form}
	{seen}
	onarchive={group ? undefined : () => (archiving = true)}
/>

<Dialog
	open={archiving}
	icon="trash"
	tone="danger"
	title="Archive this song?"
	body={`${name} leaves Music and the song popup. Sets you logged with it stay.`}
	onclose={() => (archiving = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (archiving = false)}
			>Cancel</button
		>
		<form
			method="POST"
			action="?/archive"
			use:enhance={() => {
				return async ({ update, result }) => {
					if (result.type === 'redirect') {
						archiving = false;
						await leaveRemoved(result.location);
						return;
					}
					await update();
				};
			}}
		>
			<button type="submit" class={button('danger', 'sm')}>Archive</button>
		</form>
	{/snippet}
</Dialog>

<!-- The ⋯ menu and its sheets, once: the band (drawn twice) only holds its button. -->
<ItemMenu bind:open={menuOpen} title={name} kind="song" current={song.id} own={songOwn} {offers} />
