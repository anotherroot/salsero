<script lang="ts">
	import { leaveRemoved } from '$lib/nav/trail.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { focusAfterRemoval } from '$lib/focus';
	import { resolve } from '$app/paths';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
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
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import SeekBar from '$lib/components/ui/SeekBar.svelte';
	import { GROUP, PLAY_ROUND, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { act } from '$lib/act';
	import {
		classSongNote,
		deleteSongBody,
		deleteSongTitle,
		songName,
		stopSharingBody,
		stopSharingTitle
	} from '$lib/songs/library';
	import { reportOpen } from '$lib/teams/opens-api';
	import {
		BRAND,
		sampleLabels,
		songSteps,
		songSubtitle,
		sourceOf,
		sourceRows,
		tapProblem
	} from '$lib/songs/song-page';
	import { t } from '$lib/i18n/catalog';
	import { clock } from '$lib/format';
	import { TEMPO_FACTORS, TEMPO_LABEL } from '$lib/labels';
	import { watchMedia } from '$lib/media';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let audio: HTMLAudioElement | undefined = $state();
	let paused = $state(true);
	let audioDuration = $state(NaN);
	let tapped = $state(false);
	/** "Play the song first." from the browser's own check, before anything is sent. */
	let tapError: string | null = $state(null);
	let now = $state(0);
	let detailsOpen = $state(false);
	/** Song details opened on Use another YouTube link (a failed song's Use a YouTube link). */
	let swapping = $state(false);
	let archiving = $state(false);
	/** Why the song will not play, from the audio element or from play(). */
	let audioProblem: string | null = $state(null);
	let tempoError: string | null = $state(null);
	/** The count speed waiting for an answer to "This clears your 1s." */
	let tempoAsk: string | null = $state(null);
	/** A group song's ⋯ menu, and what it opens. */
	let unsharing = $state(false);
	let deleting = $state(false);
	/** A reader's Edit: the Make it mine sheet (ruling 12: once Make my own copy). */
	let makingMine = $state(false);

	/** What every edit of a group's song sends back, for the clash check; nothing for one's own. */
	const seen = $derived(data.seen ? JSON.stringify(data.seen) : '');
	/** `seen` as a posted field, for a group's song only. */
	const withSeen = (): { seen?: string } => (seen ? { seen } : {});
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
	const ticks = $derived(
		grid ? data.anchors.map((i) => grid.beats[i]).filter((t): t is number => t !== undefined) : []
	);
	const sample = $derived(data.sample ? sampleLabels(data.sample.custom) : null);
	// A refusal names the control it is about; one that names none shows at the foot.
	const tapRefusal = $derived(form?.action === 'tap' ? form.message : null);
	const tapShown = $derived(tapError ?? tapRefusal);
	const sampleRefusal = $derived(form?.action === 'sample' ? form.message : null);
	const anchorsRefusal = $derived(form?.action === 'anchors' ? form.message : null);
	// Song details' own refusals (`title` is sent with them) live in its sheet.
	const retryRefusal = $derived(form?.action === 'retry' ? form.message : null);
	const source = $derived(sourceOf(song.sourceUrl));
	const steps = $derived(songSteps(song.status, source, song.fetchedTitle));
	const sources = $derived(sourceRows(song));
	/** A song from a link that the worker is not on: its audio can be swapped. */
	const canSwap = $derived(
		data.canEdit &&
			source !== 'upload' &&
			song.status !== 'waiting_download' &&
			song.status !== 'waiting_analysis'
	);
	let tempo = $derived(String(song.tempoFactor));
	const tempoItems = TEMPO_FACTORS.map((f) => ({ value: String(f), label: TEMPO_LABEL[f] }));

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
		if (audio.paused)
			void audio.play().catch((e) => {
				if (!(e instanceof DOMException && e.name === 'AbortError'))
					audioProblem ??= 'The song would not play.';
			});
		else audio.pause();
	}

	function seek(s: number) {
		if (!audio) return;
		audio.currentTime = s;
		now = s;
		tapError = null;
	}

	async function setTempo(v: string) {
		tempoError = null;
		const r = await act('tempo', { factor: v, ...withSeen() });
		if (r.type === 'failure') {
			tempoError = String(r.data?.message ?? 'Could not change the count speed.');
			tempo = String(song.tempoFactor);
		}
	}

	function cancelTempo() {
		tempoAsk = null;
		tempo = String(song.tempoFactor);
	}

	/** A tap is out; taps made meanwhile wait here, in order. */
	let tapping = false;
	const queuedTaps: number[] = [];

	function gotIt() {
		tapped = true;
		setTimeout(() => (tapped = false), 600);
	}

	/** Send the taps that waited, one at a time, each with what the last one left. */
	async function drainTaps() {
		try {
			for (let t = queuedTaps.shift(); t !== undefined; t = queuedTaps.shift()) {
				const r = await act('tap', { t, ...withSeen() });
				if (r.type === 'success') gotIt();
				else break;
			}
		} finally {
			queuedTaps.length = 0;
			tapping = false;
		}
	}

	/** Removing a 1: focus goes to the next one's Remove, else the Count speed heading. */
	const removeAnchor =
		(beat: number): SubmitFunction =>
		() => {
			const keys = data.anchors.map((b) => `anchor-${b}`);
			return async ({ update, result }) => {
				await update();
				if (result.type === 'success')
					await focusAfterRemoval(keys, `anchor-${beat}`, 'count-speed-heading');
			};
		};
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

<Screen compact width="song" title={name} {subtitle}>
	{#snippet left()}
		<BackButton
			fallback={{
				href: resolve('/[dance]/songs', { dance: data.dance.slug }),
				label: 'Back to Music'
			}}
		/>
	{/snippet}
	{#snippet right()}
		{#if canEdit}
			<BandButton icon="edit" label="Song details" onclick={() => (detailsOpen = true)} />
		{:else if data.makeMine}
			<BandButton icon="edit" label="Edit song" onclick={() => (makingMine = true)} />
		{/if}
		{#if hasMenu(songOwn, offers)}
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
		{#if !group || song.sharedAt !== null}
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
				tapError = null;
			}}
			ontimeupdate={() => (now = audio?.currentTime ?? 0)}
			onseeked={() => (now = audio?.currentTime ?? 0)}
		></audio>

		<section class="flex flex-none flex-col gap-3 rounded-[22px] bg-surface px-4 pt-3.5 pb-4">
			<!-- "–" until the song has played: a count at 0:00 would be a guess, as a tap there would be. -->
			<LiveCount
				time={() => (audio && !tapProblem(audio) ? audio.currentTime : null)}
				beats={grid.beats}
				counts={grid.counts}
			/>
			<div class="flex items-center gap-3.5">
				<button
					type="button"
					class={PLAY_ROUND}
					aria-label={paused ? 'Play the song' : 'Pause the song'}
					onclick={toggle}
				>
					<Icon name={paused ? 'play' : 'pause'} filled />
				</button>
				<div class="min-w-0 flex-1 pt-3.5">
					<SeekBar label="Position in the song" value={now} {duration} {ticks} onseek={seek} />
				</div>
			</div>
		</section>
		{#if audioProblem}<Banner kind="error" title={audioProblem} />{/if}

		{#if canEdit}
			<form
				method="POST"
				action="?/tap"
				class="flex flex-col gap-2"
				use:enhance={({ formData, cancel }) => {
					const problem = tapProblem(audio ?? null);
					tapError = problem;
					if (problem) {
						cancel();
						return;
					}
					const t = audio?.currentTime ?? 0;
					// A tap while the last one is out waits for it, so it carries what that one left.
					if (tapping) {
						cancel();
						queuedTaps.push(t);
						return;
					}
					tapping = true;
					formData.set('t', String(t));
					if (seen) formData.set('seen', seen);
					return async ({ update, result }) => {
						try {
							await update({ reset: false });
							if (result.type === 'success') gotIt();
							// A refused tap (a clash) would refuse the waiting ones too.
							else queuedTaps.length = 0;
						} finally {
							await drainTaps();
						}
					};
				}}
			>
				<span class="sr-only" role="status">{tapped ? 'Got it' : ''}</span>
				{#if tapped}
					<button
						type="submit"
						class="flex h-16 w-full flex-none items-center justify-center gap-2.5 rounded-full bg-done-soft font-display text-[22px] font-extrabold text-done"
					>
						<Icon name="check" size={24} stroke={2.6} />Got it
					</button>
				{:else}
					<button type="submit" class={button('primary', 'lg', true)}>Tap on the 1</button>
				{/if}
				{#if tapShown === 'Play the song first.'}
					<Banner kind="error" title="Play the song first."
						>A tap marks the beat that is playing.</Banner
					>
				{:else if tapShown}
					<Banner kind="error" title={tapShown} />
				{/if}
			</form>

			<p class="px-3 pt-1 text-center text-[13px] leading-[1.45] text-muted">
				{grid.suggested
					? 'The count is a guess. Play the song and tap on every “1” you hear until it lines up.'
					: 'If the count slips after a break, tap the 1 again there.'}{grid.bpm
					? ` · ${Math.round(grid.bpm)} BPM`
					: ''}
			</p>
		{:else if grid.bpm}
			<p class="px-3 pt-1 text-center text-[13px] leading-[1.45] text-muted">
				{Math.round(grid.bpm)} BPM
			</p>
		{/if}

		{#if data.sample && sample}
			<h2 class="{SECTION_LABEL} pt-3.5">Sample</h2>
			<div class={GROUP}>
				<div class="flex min-h-16 items-center gap-1 pr-1 pl-4">
					<div class="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
						<span class="flex items-center gap-1.5">
							<span class="text-[16px] leading-[1.3] font-bold text-ink tabular-nums"
								>From {clock(data.sample.song.startS)}</span
							>
							<Badge tone={sample.tone}>{sample.badge}</Badge>
						</span>
						<span class="text-[13px] leading-[1.35] text-muted">{sample.meta}</span>
					</div>
					<SampleButton song={data.sample.song} {name} />
				</div>
			</div>
			{#if canEdit}
				<form
					method="POST"
					action="?/sample"
					class="flex"
					use:enhance={({ formData }) => {
						formData.set('t', String(audio?.currentTime ?? 0));
						return async ({ update }) => update({ reset: false });
					}}
				>
					{#if seen}<input type="hidden" name="seen" value={seen} />{/if}
					<button type="submit" class={button('secondary', 'md', true)}
						>Start the sample at {clock(now)}</button
					>
				</form>
				{#if data.sample.custom}
					<form method="POST" action="?/sampleAuto" use:enhance class="-mt-1 flex justify-center">
						{#if seen}<input type="hidden" name="seen" value={seen} />{/if}
						<button type="submit" class={button('tertiary', 'sm')}>Back to automatic</button>
					</form>
				{/if}
			{/if}
			{#if sampleRefusal}
				<Banner kind="error" title={sampleRefusal} />
			{/if}
		{/if}

		{#if canEdit}
			<h2 class="{SECTION_LABEL} pt-2" tabindex="-1" data-focus="count-speed-heading">
				Count speed
			</h2>
			<Segmented
				name="factor"
				label="Count speed"
				items={tempoItems}
				bind:value={tempo}
				onchange={(v) => (data.anchors.length ? (tempoAsk = v) : setTempo(v))}
			/>
			{#if tempoError}<Banner kind="error" title={tempoError} />{/if}
			<p class="px-3 pt-1 text-[13px] leading-[1.45] text-muted">
				If the count runs at half or double your steps, switch it. This clears your taps.
			</p>

			{#if data.anchors.length > 0}
				<div class="flex min-h-5 items-center justify-between pt-3 pr-1 pl-4">
					<h2 class="text-[13px] font-bold text-muted">Your 1s · {data.anchors.length}</h2>
					<form method="POST" action="?/resetAnchors" use:enhance class="-my-3">
						{#if seen}<input type="hidden" name="seen" value={seen} />{/if}
						<button type="submit" class={button('tertiary', 'sm')}>Clear all</button>
					</form>
				</div>
				<ul class={GROUP} aria-label="Your 1s">
					{#each data.anchors as beat (beat)}
						{@const time = clock(grid.beats[beat] ?? 0)}
						<li class="flex min-h-14 items-center justify-between gap-3 pr-1 pl-4">
							<span class="text-[16px] font-bold text-ink tabular-nums">{time}</span>
							<form method="POST" action="?/removeAnchor" use:enhance={removeAnchor(beat)}>
								<input type="hidden" name="beat" value={beat} />
								{#if seen}<input type="hidden" name="seen" value={seen} />{/if}
								<button
									data-focus="anchor-{beat}"
									type="submit"
									class={button('danger-text', 'sm')}
									aria-label="Remove the 1 at {time}">Remove</button
								>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			{#if anchorsRefusal}<Banner kind="error" title={anchorsRefusal} />{/if}
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
			{@render fromLine()}
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
			{#if canSwap}
				<button
					type="button"
					class={button('secondary', 'md', true)}
					onclick={() => {
						swapping = true;
						detailsOpen = true;
					}}
				>
					<Icon name="youtube" size={20} />{t().songs.source.useLink}
				</button>
			{/if}
			{@render fromLine()}
		{/if}
	{/if}
	{#if shareBar}<div class="h-28 flex-none"></div>{/if}
</Screen>

{#snippet fromLine()}
	{#if sources.length > 0}
		<p class="px-3 text-center text-[13px] leading-[1.6] text-muted">
			{#each sources as row, i (row.kind)}
				{#if i > 0}<span aria-hidden="true"> · </span>{/if}
				{i === 0 ? t().songs.source.from : t().songs.source.audioFrom}
				<a
					href={row.href}
					target="_blank"
					rel="external noopener noreferrer"
					class="font-bold text-accent-text">{BRAND[row.kind]} ↗</a
				>
			{/each}
		</p>
	{/if}
{/snippet}

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
	onclose={() => {
		detailsOpen = false;
		swapping = false;
	}}
	{sources}
	{canSwap}
	copies={data.copiesInStep}
	bind:swapping
	{song}
	dance={data.dance}
	{form}
	{seen}
	onarchive={group ? undefined : () => (archiving = true)}
/>

<Dialog
	open={tempoAsk !== null}
	icon="metronome"
	title="Change count speed?"
	body={data.anchors.length === 1
		? 'This clears the 1 you tapped.'
		: `This clears your ${data.anchors.length} 1s.`}
	onclose={cancelTempo}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={cancelTempo}>Cancel</button>
		<button
			type="button"
			class={button('primary', 'sm')}
			onclick={() => {
				const v = tempoAsk;
				tempoAsk = null;
				if (v !== null) void setTempo(v);
			}}>Change</button
		>
	{/snippet}
</Dialog>

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
