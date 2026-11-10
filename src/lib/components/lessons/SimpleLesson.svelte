<script lang="ts">
	import FlipList from '$lib/components/ui/FlipList.svelte';
	import { withView } from '$lib/teams/group-view';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { act, actAt } from '$lib/act';
	import { offlineRefusal, refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
	import { uploadLink } from '$lib/app-mode';
	import { MAX_LESSON_VIDEO_BYTES } from '$lib/limits';
	import type { MediaProblem } from '$lib/media';
	import type { Level } from '$lib/levels/levels';
	import { lessonBandLine, sectionHeading } from '$lib/lessons/page';
	import { t } from '$lib/i18n/catalog';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { newLine } from '$lib/teams/add';
	import type { AddState, CommentsOn, LessonVideoRow, LinkRow } from '$lib/types';
	import CommentsCard from '$lib/components/comments/CommentsCard.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import PaneColumns from '$lib/components/ui/PaneColumns.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import VideoProblem from '$lib/components/ui/VideoProblem.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import AppUploadLink from '$lib/components/ui/AppUploadLink.svelte';
	import ChunkedUploadButton from '$lib/components/ui/ChunkedUploadButton.svelte';
	import PhoneAddButton from '$lib/components/ui/PhoneAddButton.svelte';
	import { currentAddMode } from '$lib/offline/add-mode.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import {
		CLIP,
		GROUP,
		SECTION_LABEL,
		STRIP_ACTION,
		button,
		iconButton
	} from '$lib/components/ui/styles';
	// The page's group view (`?in=`, or its row's): links to the lists keep it.
	const viewTeam = $derived(page.data.groupMode?.teamId ?? null);

	/**
	 * The simple lesson page (levels spec, "The simple lesson page"): at Follow
	 * my class and Practise and keep my own, a class shows what was taught and
	 * lets it be watched again — notes, videos in the simple player, and what
	 * the person practises from it with when each is next on Today. No sections,
	 * links to figures, routines or positions, sizes or clone tools. A person's
	 * own lesson (Practise and keep my own) keeps Edit (title, day, notes, drawn
	 * by the page's own edit mode), its videos' upload and delete, and its links.
	 */
	interface Props {
		dance: string;
		level: Level;
		lesson: { id: number; title: string; notes: string | null; lessonDay: string };
		/** The class's group; null for the person's own lesson. */
		team: { id: number; name: string } | null;
		today: string;
		videos: LessonVideoRow[];
		links: LinkRow[];
		/** The person's own lesson: Edit, upload and delete videos, edit links. */
		canEdit: boolean;
		/** In the Android app: uploads go through the app. */
		app: boolean;
		practising: { id: number; name: string; when: string }[];
		/** The class's comments card; null for a person's own lesson. */
		comments: CommentsOn | null;
		add: AddState | null;
		/** The group is being deleted: its words, without Make it mine. */
		notice: { tone: 'warning'; text: string } | null;
		/** The links editor's refusal and what was typed. */
		linkMessage: string | null;
		linkEntered: string;
		/** Why a video could not be deleted, by id. */
		videoRefused: Record<number, string>;
		onedit: () => void;
		ondeletevideo: (videoId: number) => void;
		/** The lesson menu (Remove from my lessons), or null when there is none. */
		onmenu: (() => void) | null;
	}

	let {
		dance,
		level,
		lesson,
		team,
		today,
		videos,
		links,
		canEdit,
		app,
		practising,
		comments,
		add,
		notice,
		linkMessage,
		linkEntered,
		videoRefused,
		onedit,
		ondeletevideo,
		onmenu
	}: Props = $props();

	let broken = $state<Record<number, MediaProblem>>({});

	let toast = $state<ToastState | null>(null);
	let seq = 0;
	/** Shows a refusal's message; true when the action was refused. */
	function refused(result: Awaited<ReturnType<typeof act>>, fallback: string): boolean {
		const message = refusalMessage(result, fallback);
		if (message !== null && !offlineRefusal(result)) toast = { id: ++seq, message };
		return message !== null;
	}

	/** A class not in the person's practice yet: one tap adds its default picks (the group's `addNow`). */
	const notAdded = $derived(add !== null && !add.added && add.offer !== null);
	/** Once added, what came in since: at Follow my class auto-add covers it, so only at Practise and keep my own. */
	const fresh = $derived(level === 'own' && add?.added ? add.offer : null);

	let adding = $state(false);
	async function addNow() {
		if (adding || !team) return;
		adding = true;
		try {
			const result = await actAt(`/${dance}/groups/${team.id}`, 'addNow', { lessonId: lesson.id });
			const w = t().lesson.page;
			if (refused(result, w.couldNotAdd)) return;
			toast = undoToast(
				++seq,
				w.added,
				() => (toast = null),
				async () => refused(await act('remove', { stay: 1 }), w.couldNotUndo)
			);
		} finally {
			adding = false;
		}
	}

	/** What came in since: added at once, as the one-tap Add below Everything adds. */
	let addingFresh = $state(false);
	async function addFresh() {
		if (addingFresh || !fresh) return;
		addingFresh = true;
		const ids = (kind: 'routine' | 'drill') =>
			fresh.items.filter((i) => i.kind === kind && i.ticked).map((i) => i.id);
		try {
			const result = await act('add', { routineIds: ids('routine'), drillIds: ids('drill') });
			const w = t().lesson.page;
			if (!refused(result, w.couldNotAdd)) toast = { id: ++seq, message: w.added };
		} finally {
			addingFresh = false;
		}
	}
	let notNowBusy = $state(false);
</script>

{#snippet addBand()}
	<!-- A published class not in the person's practice yet. On the desktop a soft accent bar under the title. -->
	<div
		class="flex items-center gap-3 desk:min-h-[52px] desk:rounded-2xl desk:bg-accent-soft desk:py-1.5 desk:pr-2 desk:pl-4"
	>
		<span
			class="min-w-0 flex-1 text-[13px] font-semibold text-band-small desk:text-[15px] desk:font-bold desk:text-accent-text"
			>{t().lesson.page.notInPractice}</span
		>
		<button
			type="button"
			class={STRIP_ACTION}
			aria-busy={adding}
			disabled={adding}
			onclick={addNow}
		>
			{#if adding}
				<Spinner /><span class="sr-only">{t().lesson.page.adding}</span>
			{:else}
				{t().common.add}
			{/if}
		</button>
	</div>
{/snippet}

<Screen
	compact
	width="two"
	title={lesson.title}
	subtitle={lessonBandLine(lesson.lessonDay, today, team !== null)}
	extra={notAdded ? addBand : undefined}
>
	{#snippet left()}
		<BackButton
			fallback={level === 'follow'
				? {
						href: resolve('/[dance]/groups', { dance }),
						label: t().shell.backTo(t().shell.tabs.myClass)
					}
				: {
						href: withView(resolve('/[dance]/lessons', { dance }), viewTeam),
						label: t().shell.backTo(t().shell.tabs.lessons)
					}}
		/>
	{/snippet}
	{#snippet right()}
		{#if onmenu}
			<BandButton icon="more" label={t().lesson.page.menu} onclick={onmenu} />
		{/if}
		{#if canEdit}
			<BandButton
				focusKey="start-editing"
				icon="pencil"
				label={t().lesson.page.edit}
				onclick={onedit}
			/>
		{/if}
	{/snippet}

	<!-- The content's snippets live in this div: one at the top of Screen would be its prop. -->
	<div class="pb-4">
		{#snippet top()}
			{#if notice}<Banner kind={notice.tone}>{notice.text}</Banner>{/if}
			{#if fresh}
				<!-- What came into the class since the person added it: Add at once, or Not now. -->
				<div
					class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-accent-soft py-2 pr-2 pl-4"
				>
					<span class="min-w-0 flex-1 text-[15px] font-bold text-accent-text"
						>{newLine(fresh.items)}</span
					>
					<form
						method="POST"
						action="?/notNow"
						use:enhance={() => {
							notNowBusy = true;
							return async ({ update }) => {
								try {
									await update();
								} finally {
									notNowBusy = false;
								}
							};
						}}
					>
						<button
							type="submit"
							class={button('tertiary', 'sm')}
							aria-busy={notNowBusy}
							disabled={notNowBusy}>{t().lesson.page.notNow}</button
						>
					</form>
					<button
						type="button"
						class={button('primary', 'sm')}
						aria-busy={addingFresh}
						disabled={addingFresh}
						onclick={addFresh}
					>
						{#if addingFresh}<Spinner /><span class="sr-only">{t().lesson.page.adding}</span
							>{:else}{t().common.add}{/if}
					</button>
				</div>
			{/if}
		{/snippet}

		{#snippet about()}
			{#if lesson.notes}
				<section class="flex flex-col gap-1.5 rounded-2xl bg-surface px-4 pt-3.5 pb-4">
					<h2 class="text-[13px] font-bold text-muted">{t().lesson.page.notes}</h2>
					<LinkedText
						text={lesson.notes}
						class="text-[16px] leading-[1.45] font-medium whitespace-pre-line text-ink"
					/>
				</section>
			{/if}
		{/snippet}

		{#snippet watched()}
			<section class="flex flex-col gap-2 pt-2.5 two:pt-0">
				<h2 class={SECTION_LABEL} tabindex="-1" data-focus="videos-heading">
					{sectionHeading(t().lesson.page.videos, videos.length)}
				</h2>
				{#if videos.length}
					<FlipList keys={videos.map((video) => video.id)} class="flex flex-col gap-3">
						{#each videos as video, i (video.id)}
							{#snippet videoTrash()}
								{#if canEdit}<button
										data-focus="video-{video.id}"
										type="button"
										aria-label={t().lesson.page.deleteVideo(i + 1)}
										aria-haspopup="dialog"
										class={iconButton('bare', 'danger')}
										onclick={() => ondeletevideo(video.id)}><Icon name="trash" size={22} /></button
									>{/if}
							{/snippet}
							<li data-flip={video.id} class="{CLIP} rounded-[22px] bg-surface">
								{#if broken[video.id] === 'missing'}
									<VideoProblem
										title={t().lesson.page.missingTitle}
										body={t().lesson.page.missingBody}
										meta={t().lesson.page.video(i + 1)}
									>
										{#snippet action()}{@render videoTrash()}{/snippet}
									</VideoProblem>
								{:else if broken[video.id] === 'unplayable'}
									<VideoProblem
										title={t().lesson.page.unplayableTitle}
										body={t().lesson.page.unplayableBody}
										meta={t().lesson.page.video(i + 1)}
									>
										{#snippet action()}
											<span class="flex items-center gap-1">
												<a
													href={resolve('/lesson-videos/[file]', { file: video.file })}
													download
													class={button('tertiary', 'sm')}
													><Icon name="download" size={18} />{t().lesson.page.download}</a
												>
												{@render videoTrash()}
											</span>
										{/snippet}
									</VideoProblem>
								{:else}
									<VideoFrame
										src="/lesson-videos/{video.file}"
										phone={{ ...video, table: 'lesson_videos' }}
										sourceUrl={video.sourceUrl}
										owner={{ lessonVideoId: video.id }}
										title={lesson.title}
										caption={{ title: t().lesson.page.video(i + 1) }}
										onproblem={(p) => (broken = { ...broken, [video.id]: p })}
										onclosed={() => void refreshWhenSettled()}
										simple
										canEdit={false}
										action={canEdit ? videoTrash : undefined}
									/>
								{/if}
								{#if videoRefused[video.id]}
									<div class="px-3 pb-2.5">
										<Banner kind="error" title={t().lesson.page.cantDelete}
											>{videoRefused[video.id]}</Banner
										>
									</div>
								{/if}
							</li>
						{/each}
					</FlipList>
				{:else if !canEdit}
					<p class="px-1 text-[15px] text-muted">{t().lesson.page.noVideos}</p>
				{/if}
				{#if canEdit}
					<div class={videos.length ? 'mt-3' : ''}>
						{#if app}
							<AppUploadLink
								kind="dashed"
								href={uploadLink(
									{ lesson: lesson.id },
									{ back: page.url.pathname, name: lesson.title }
								)}
								label={t().lesson.page.addVideos}
							/>
						{:else if currentAddMode(false, team === null) === 'phone'}
							<PhoneAddButton
								target={{ lessonId: lesson.id }}
								label={t().lesson.page.addVideos}
								multiple
							/>
						{:else}
							<ChunkedUploadButton
								uploadUrl="/api/lessons/{lesson.id}/videos"
								accept="video/*"
								label={t().lesson.page.addVideos}
								maxBytes={MAX_LESSON_VIDEO_BYTES}
							/>
						{/if}
					</div>
				{/if}
			</section>
			{#if canEdit || links.length > 0}
				<section class="flex flex-col gap-2 pt-2.5">
					<h2 class={SECTION_LABEL}>{sectionHeading(t().lesson.page.links, links.length)}</h2>
					{#if canEdit}
						<LinksEditor compact {links} canSave message={linkMessage} entered={linkEntered} />
					{:else}
						<LinkList compact {links} />
					{/if}
				</section>
			{/if}
		{/snippet}

		{#snippet practice()}
			{#if practising.length > 0}
				<section class="flex flex-col gap-2 pt-2.5">
					<h2 class={SECTION_LABEL}>{t().lesson.page.practising}</h2>
					<FlipList keys={practising.map((row) => row.id)} class={GROUP}>
						{#each practising as row (row.id)}
							<li data-flip={row.id}>
								<a
									href={resolve('/[dance]/(today)/exercises/[id]', { dance, id: String(row.id) })}
									class="flex min-h-[60px] items-center gap-3 py-2 pr-3.5 pl-4"
								>
									<span class="flex min-w-0 flex-1 flex-col gap-0.5">
										<span class="text-[16px] leading-[1.3] font-bold text-ink">{row.name}</span>
										<span class="text-[13px] leading-[1.35] text-muted">{row.when}</span>
									</span>
									<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
								</a>
							</li>
						{/each}
					</FlipList>
				</section>
			{/if}
			{#if team && comments}<CommentsCard {comments} />{/if}
		{/snippet}

		<!--
		Phone: notes, videos, what you're practising, comments. Desktop (two columns):
		notes and the practice list on the left, the videos on the right.
	-->
		<PaneColumns
			ratio="5:7"
			class="gap-3"
			top={notice || fresh ? top : undefined}
			left={about}
			right={watched}
			leftEnd={practice}
		/>
	</div>
</Screen>

<Toast
	toast={toast && {
		id: toast.id,
		message: toast.message,
		action: toast.action,
		icon: toast.icon,
		tone: toast.tone
	}}
	onaction={() => toast?.undo?.()}
	ondismiss={() => (toast = null)}
/>
