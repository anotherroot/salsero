<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import PaneColumns from '$lib/components/ui/PaneColumns.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import CodeSheet from '$lib/components/teams/CodeSheet.svelte';
	import LessonRow from '$lib/components/lessons/LessonRow.svelte';
	import SongRow from '$lib/components/songs/SongRow.svelte';
	import NewLessonSheet from '$lib/components/lessons/NewLessonSheet.svelte';
	import LeaveSheet from '$lib/components/teams/LeaveSheet.svelte';
	import AddSheet from '$lib/components/teams/AddSheet.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import MyClass from '$lib/components/teams/MyClass.svelte';
	import { act, actAt } from '$lib/act';
	import { refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
	import type { IconName } from '$lib/icons/icons';
	import { FIELD, GROUP, LABEL, ROW, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		addedToToday,
		MY_CLASS,
		classSongsHeading,
		groupMenu,
		groupUsesLine,
		onlyClass,
		peopleLine,
		youLine
	} from '$lib/teams/view';
	import { levelShown } from '$lib/levels/levels';
	import { t } from '$lib/i18n/catalog';
	import { readyMeta, songName, songState } from '$lib/songs/library';
	import type { AddOffer } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const deleted = $derived(data.team.deletedAt !== null);
	const owner = $derived(data.role === 'owner');
	const w = $derived(t().groups.page);

	let menu = $state(false);
	let code = $state(false);
	let renaming = $state(false);
	let leaving = $state(false);
	let creating = $state(false);
	let deleting = $state(false);
	let busy = $state(false);
	/**
	 * The Add sheet's lesson and offer, kept as opened: once the Add lands the
	 * row's offer is gone, and the sheet closes itself rather than vanishing.
	 */
	let adding = $state<{ id: number; title: string; offer: AddOffer } | null>(null);

	let toast = $state<ToastState | null>(null);
	let seq = 0;
	/** Shows a refusal's message; true when the action was refused. */
	function refused(result: Awaited<ReturnType<typeof act>>, fallback: string): boolean {
		const message = refusalMessage(result, fallback);
		if (message !== null) toast = { id: ++seq, message };
		return message !== null;
	}

	/** The switch as drawn: the stored choice, or the tap waiting for the server. */
	let autoOn = $derived(data.autoAdd?.on ?? false);
	async function saveAutoAdd(on: boolean) {
		autoOn = on;
		if (refused(await act('autoAdd', { on: on ? 1 : 0 }), w.couldNotSave)) {
			autoOn = data.autoAdd?.on ?? false;
		}
	}

	/**
	 * Below Everything, Add is one tap: the lesson's default picks, no sheet. In
	 * My class it says so, "Added to Today · Undo", once the add has landed; Undo
	 * is the lesson page's own Remove, posted from here with `stay=1` (it answers
	 * instead of redirecting to Lessons), as the simple lesson page's Undo does.
	 */
	let addingNow = $state<number | null>(null);
	async function addNow(lessonId: number) {
		if (addingNow !== null) return;
		addingNow = lessonId;
		try {
			if (refused(await act('addNow', { lessonId }), w.couldNotAdd)) return;
			if (!data.simple) return;
			const lesson = resolve('/[dance]/lessons/[id]', {
				dance: data.dance.slug,
				id: String(lessonId)
			});
			toast = undoToast(
				++seq,
				addedToToday(),
				() => (toast = null),
				async () => refused(await actAt(lesson, 'remove', { stay: 1 }), w.couldNotUndo)
			);
		} finally {
			addingNow = null;
		}
	}

	// My class: the Class menu, and at Follow my class the person's only class is
	// the tab's own page (no ‹), a teacher's too: its fallback, the tab, opens it again.
	const menuItems = $derived(groupMenu(data.role, data.simple));
	const backShown = $derived(!onlyClass(levelShown(data.user?.level), data.teams, data.team.id));

	let seen: unknown = $state(null);
	$effect(() => {
		if (form !== seen && form?.action === 'rename' && form.message) renaming = true;
	});
	const fresh = $derived(form !== seen ? form : null);
	// A refused New lesson re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form !== seen && form?.action === 'create' && form.message) creating = true;
	});

	function openNewLesson() {
		seen = form;
		creating = true;
	}

	function openRename() {
		seen = form;
		menu = false;
		renaming = true;
	}
	function pick(then: () => void) {
		menu = false;
		then();
	}
</script>

<svelte:head
	><title>{data.team.name} · {data.simple ? MY_CLASS.title : t().shell.tabs.groups}</title
	></svelte:head
>

<!-- Passed only when drawn: an empty `left` would still hold the ‹'s place in the band. -->
{#snippet back()}
	<BackButton
		fallback={{
			href: resolve('/[dance]/groups', { dance: data.dance.slug }),
			label: t().shell.backTo(data.simple ? MY_CLASS.title : t().shell.tabs.groups)
		}}
	/>
{/snippet}

<Screen
	title={data.team.name}
	subtitle={data.simple ? undefined : `${peopleLine(data.people)} · ${youLine(data.role)}`}
	compact
	width="two"
	left={backShown ? back : undefined}
>
	{#snippet right()}
		{#if !deleted}
			<BandButton
				icon="more"
				label={data.simple ? MY_CLASS.menu : w.menu}
				onclick={() => (menu = true)}
			/>
		{/if}
	{/snippet}

	{#if deleted}
		<form
			method="POST"
			action="?/restore"
			class="flex items-center gap-3 rounded-2xl bg-surface py-3 pr-3 pl-4"
			use:enhance
		>
			<span class="min-w-0 flex-1 text-[15px] font-semibold text-ink">{w.deleted}</span>
			<button type="submit" class={button('secondary', 'sm')}>{w.restore}</button>
		</form>
		{#if form?.action === 'restore' && form.message}
			<Banner kind="error">{form.message}</Banner>
		{/if}
	{:else}
		{#if form?.action === 'leave' && form.message}<Banner kind="error">{form.message}</Banner>{/if}
	{/if}
	{#if data.simple}
		<!-- My class: the latest class, the earlier ones and the class songs (levels spec). -->
		<MyClass
			dance={data.dance.slug}
			styleLabel={data.dance.styleLabel}
			lessons={data.lessons}
			songs={data.songs}
			{addingNow}
			onadd={addNow}
		/>
	{:else if !deleted}
		<!--
			The group in its pane (desktop spec, "Two columns"): from a 780 px pane two
			columns, 7 : 5 — the lessons on the left, the group's space and Class songs
			on the right; one column below that and on the phone, in the phone's order.
		-->
		<PaneColumns
			ratio="7:5"
			class="gap-2"
			lead={data.storage || data.autoAdd ? space : undefined}
			left={lessons}
			right={songs}
		/>
	{/if}
</Screen>

{#snippet space()}
	{#if data.storage}
		<a
			href={resolve('/[dance]/groups/[id]/storage', {
				dance: data.dance.slug,
				id: String(data.team.id)
			})}
			class="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 active:bg-step"
		>
			<span class="text-[15px] font-semibold text-ink"
				>{groupUsesLine(data.storage.usedBytes, data.storage.limitBytes)}</span
			>
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</a>
	{/if}
	{#if data.autoAdd}
		<div class="{ROW} rounded-2xl bg-surface pr-1.5">
			<span class="min-w-0 flex-1 text-[15px] font-semibold text-ink">{w.autoAdd}</span>
			<Switch label={w.autoAdd} checked={autoOn} onchange={saveAutoAdd} />
		</div>
	{/if}
{/snippet}

{#snippet lessons()}
	<section class="flex flex-col gap-2">
		<div class="flex items-center justify-between pr-1">
			<h2 class={SECTION_LABEL}>{w.lessons}</h2>
			{#if data.canEdit}
				<button type="button" class={button('tertiary', 'sm')} onclick={openNewLesson}
					><Icon name="plus" size={18} />{w.newLesson}</button
				>
			{/if}
		</div>
		{#if data.lessons.length === 0}
			<div class="rounded-2xl bg-surface px-4 py-5 text-[15px] text-muted">{w.noLessons}</div>
		{:else}
			<ul class={GROUP} aria-label={w.lessons}>
				{#each data.lessons as lesson (lesson.id)}
					<LessonRow
						{lesson}
						draft={lesson.publishedAt === null}
						isNew={lesson.isNew}
						href={resolve('/[dance]/lessons/[id]', {
							dance: data.dance.slug,
							id: String(lesson.id)
						})}
						aside={lesson.add ? addAside : undefined}
					/>
					{#snippet addAside()}
						{#if lesson.add?.added}
							<span class="flex items-center gap-1 px-1 text-[14px] font-bold text-done"
								>{w.added}<Icon name="check" size={18} /></span
							>
						{:else if lesson.add?.offer && data.addAtOnce}
							<button
								type="button"
								class={button('secondary', 'sm')}
								aria-label={t().entry.classes.addLesson(lesson.title)}
								aria-busy={addingNow === lesson.id}
								disabled={addingNow !== null}
								onclick={() => addNow(lesson.id)}
								>{#if addingNow === lesson.id}<Spinner />{:else}{t().common.add}{/if}</button
							>
						{:else if lesson.add?.offer}
							<button
								type="button"
								class={button('secondary', 'sm')}
								aria-label={t().entry.classes.addLesson(lesson.title)}
								aria-haspopup="dialog"
								onclick={() =>
									(adding = lesson.add?.offer
										? { id: lesson.id, title: lesson.title, offer: lesson.add.offer }
										: null)}>{t().common.add}</button
							>
						{/if}
					{/snippet}
				{/each}
			</ul>
		{/if}
	</section>
{/snippet}

{#snippet songs()}
	<!-- The class playlist: the shared songs, and for its editors the drafts too. -->
	{#if data.songs.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class={SECTION_LABEL}>{classSongsHeading(data.songs.length)}</h2>
			<ul class={GROUP} aria-label={t().entry.classes.songs}>
				{#each data.songs as s (s.id)}
					<SongRow
						href={resolve('/[dance]/songs/[id]', {
							dance: data.dance.slug,
							id: String(s.id)
						})}
						name={songName(s)}
						meta={s.status === 'ready'
							? readyMeta(s, data.dance.styleLabel)
							: songState(s, data.dance.styleLabel).meta}
						tone={s.status === 'failed' ? 'danger' : null}
						sample={s.sample}
						draft={s.draft}
						isNew={s.isNew}
					/>
				{/each}
			</ul>
		</section>
	{/if}
{/snippet}

{#snippet row(icon: IconName, label: string, onclick: () => void, danger = false)}
	<button
		type="button"
		class="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-step"
		{onclick}
	>
		<span class="flex-none {danger ? 'text-danger' : 'text-accent-text'}"
			><Icon name={icon} size={22} /></span
		>
		<span class="text-[16px] font-bold {danger ? 'text-danger' : 'text-ink'}">{label}</span>
	</button>
{/snippet}

<Sheet title={data.team.name} open={menu} onclose={() => (menu = false)} size="small">
	<div class={GROUP}>
		<a
			href={resolve('/[dance]/groups/[id]/people', {
				dance: data.dance.slug,
				id: String(data.team.id)
			})}
			class="flex min-h-14 w-full items-center gap-3 px-4 py-2 active:bg-step"
		>
			<span class="flex-none text-accent-text"><Icon name="group" size={22} /></span>
			<span class="text-[16px] font-bold text-ink">{w.people}</span>
		</a>
		{#if menuItems.includes('deleted')}
			<a
				href={resolve('/[dance]/groups/[id]/deleted', {
					dance: data.dance.slug,
					id: String(data.team.id)
				})}
				class="flex min-h-14 w-full items-center gap-3 px-4 py-2 active:bg-step"
			>
				<span class="flex-none text-accent-text"><Icon name="trash" size={22} /></span>
				<span class="text-[16px] font-bold text-ink">{w.recentlyDeleted}</span>
			</a>
		{/if}
		{#if menuItems.includes('code') && data.code}{@render row('link', w.showCode, () =>
				pick(() => (code = true))
			)}{/if}
		{#if menuItems.includes('rename')}{@render row('edit', w.rename, openRename)}{/if}
		{#if menuItems.includes('leave')}{@render row(
				'logout',
				data.simple ? w.leaveClass : w.leaveGroup,
				() => pick(() => (leaving = true)),
				true
			)}{/if}
		{#if menuItems.includes('delete')}{@render row(
				'trash',
				w.deleteGroup,
				() => pick(() => (deleting = true)),
				true
			)}{/if}
	</div>
</Sheet>

{#if data.canEdit}
	<NewLessonSheet
		open={creating}
		onclose={() => (creating = false)}
		action="?/createLesson"
		refusal={fresh?.action === 'create' ? fresh : null}
		today={data.today}
	/>
{/if}

{#if adding}
	<AddSheet
		open={true}
		onclose={() => (adding = null)}
		title={adding.title}
		lessonId={adding.id}
		offer={adding.offer}
		action="?/add"
	/>
{/if}

{#if data.code}
	<CodeSheet
		open={code}
		name={data.team.name}
		link={data.code.link}
		qr={data.code.qr}
		{owner}
		onclose={() => (code = false)}
	/>
{/if}

<Sheet title={w.renameGroup} open={renaming} onclose={() => (renaming = false)} size="small">
	<form
		id="rename-group"
		method="POST"
		action="?/rename"
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: w.renameGroup,
			submit: ({ cancel }) => {
				if (busy) return cancel();
				busy = true;
				return async ({ update, result }) => {
					try {
						await update({ reset: false });
						if (result.type === 'success') renaming = false;
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		{#if fresh?.action === 'rename' && fresh.message}<Banner kind="error">{fresh.message}</Banner
			>{/if}
		<label class="block">
			<span class={LABEL}>{w.name}</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				name="name"
				autofocus
				autocomplete="off"
				maxlength="60"
				required
				value={fresh?.action === 'rename' ? (fresh.name ?? data.team.name) : data.team.name}
				class={FIELD}
			/>
		</label>
	</form>
	{#snippet footer()}
		<button
			type="submit"
			form="rename-group"
			class={button('primary', 'md', true)}
			aria-busy={busy}
		>
			{#if busy}<Spinner />{:else}{t().common.save}{/if}
		</button>
	{/snippet}
</Sheet>

<LeaveSheet open={leaving} onclose={() => (leaving = false)} team={data.team} />

<Dialog
	open={deleting}
	title={w.deleteQuestion(data.team.name)}
	body={w.deleteBody}
	icon="trash"
	tone="danger"
	onclose={() => (deleting = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (deleting = false)}
			>{t().common.cancel}</button
		>
		<form method="POST" action="?/delete" use:enhance>
			<button type="submit" class={button('danger', 'sm')}>{w.deleteGroup}</button>
		</form>
	{/snippet}
</Dialog>

<Toast {toast} onaction={() => toast?.undo?.()} ondismiss={() => (toast = null)} />
