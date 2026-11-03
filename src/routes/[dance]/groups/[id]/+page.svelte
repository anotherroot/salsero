<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import CodeSheet from '$lib/components/teams/CodeSheet.svelte';
	import LessonRow from '$lib/components/lessons/LessonRow.svelte';
	import NewLessonSheet from '$lib/components/lessons/NewLessonSheet.svelte';
	import AddSheet from '$lib/components/teams/AddSheet.svelte';
	import type { IconName } from '$lib/icons/icons';
	import { FIELD, GROUP, LABEL, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { peopleLine, youLine } from '$lib/teams/view';
	import type { AddOffer } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const deleted = $derived(data.team.deletedAt !== null);
	const owner = $derived(data.role === 'owner');

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

<svelte:head><title>{data.team.name} · Groups</title></svelte:head>

<Screen title={data.team.name} subtitle="{peopleLine(data.people)} · {youLine(data.role)}" compact>
	{#snippet left()}
		<BackButton
			fallback={{
				href: resolve('/[dance]/groups', { dance: data.dance.slug }),
				label: 'Back to Groups'
			}}
		/>
	{/snippet}
	{#snippet right()}
		{#if !deleted}
			<BandButton icon="more" label="Group menu" onclick={() => (menu = true)} />
		{/if}
	{/snippet}

	{#if deleted}
		<form
			method="POST"
			action="?/restore"
			class="flex items-center gap-3 rounded-2xl bg-surface py-3 pr-3 pl-4"
			use:enhance
		>
			<span class="min-w-0 flex-1 text-[15px] font-semibold text-ink">Deleted</span>
			<button type="submit" class={button('secondary', 'sm')}>Restore</button>
		</form>
		{#if form?.action === 'restore' && form.message}
			<Banner kind="error">{form.message}</Banner>
		{/if}
	{:else}
		{#if form?.action === 'leave' && form.message}<Banner kind="error">{form.message}</Banner>{/if}
		<section class="flex flex-col gap-2">
			<div class="flex items-center justify-between pr-1">
				<h2 class={SECTION_LABEL}>Lessons</h2>
				{#if data.canEdit}
					<button type="button" class={button('tertiary', 'sm')} onclick={openNewLesson}
						><Icon name="plus" size={18} />New lesson</button
					>
				{/if}
			</div>
			{#if data.lessons.length === 0}
				<div class="rounded-2xl bg-surface px-4 py-5 text-[15px] text-muted">No lessons yet</div>
			{:else}
				<ul class={GROUP} aria-label="Lessons">
					{#each data.lessons as lesson (lesson.id)}
						<LessonRow
							{lesson}
							draft={lesson.publishedAt === null}
							href={resolve('/[dance]/lessons/[id]', {
								dance: data.dance.slug,
								id: String(lesson.id)
							})}
							aside={lesson.add ? addAside : undefined}
						/>
						{#snippet addAside()}
							{#if lesson.add?.added}
								<span class="flex items-center gap-1 px-1 text-[14px] font-bold text-done"
									>Added<Icon name="check" size={18} /></span
								>
							{:else if lesson.add?.offer}
								<button
									type="button"
									class={button('secondary', 'sm')}
									aria-label="Add {lesson.title}"
									aria-haspopup="dialog"
									onclick={() =>
										(adding = lesson.add?.offer
											? { id: lesson.id, title: lesson.title, offer: lesson.add.offer }
											: null)}>Add</button
								>
							{/if}
						{/snippet}
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</Screen>

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

<Sheet title={data.team.name} open={menu} onclose={() => (menu = false)}>
	<div class={GROUP}>
		<a
			href={resolve('/[dance]/groups/[id]/people', {
				dance: data.dance.slug,
				id: String(data.team.id)
			})}
			class="flex min-h-14 w-full items-center gap-3 px-4 py-2 active:bg-step"
		>
			<span class="flex-none text-accent-text"><Icon name="group" size={22} /></span>
			<span class="text-[16px] font-bold text-ink">People</span>
		</a>
		{#if data.canEdit}
			<a
				href={resolve('/[dance]/groups/[id]/deleted', {
					dance: data.dance.slug,
					id: String(data.team.id)
				})}
				class="flex min-h-14 w-full items-center gap-3 px-4 py-2 active:bg-step"
			>
				<span class="flex-none text-accent-text"><Icon name="trash" size={22} /></span>
				<span class="text-[16px] font-bold text-ink">Recently deleted</span>
			</a>
		{/if}
		{#if data.code}{@render row('link', 'Show code', () => pick(() => (code = true)))}{/if}
		{#if owner}{@render row('edit', 'Rename', openRename)}{/if}
		{#if !owner}{@render row(
				'logout',
				'Leave group',
				() => pick(() => (leaving = true)),
				true
			)}{/if}
		{#if owner}{@render row(
				'trash',
				'Delete group',
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
		frequency={false}
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

<Sheet title="Rename group" open={renaming} onclose={() => (renaming = false)}>
	<form
		id="rename-group"
		method="POST"
		action="?/rename"
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'Rename group',
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
			<span class={LABEL}>Name</span>
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
			{#if busy}<Spinner />{:else}Save{/if}
		</button>
	{/snippet}
</Sheet>

<Dialog
	open={leaving}
	title="Leave {data.team.name}?"
	body="Its lessons leave your lists. You can join again with the code."
	icon="logout"
	tone="danger"
	onclose={() => (leaving = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (leaving = false)}
			>Cancel</button
		>
		<form method="POST" action="?/leave" use:enhance>
			<button type="submit" class={button('danger', 'sm')}>Leave group</button>
		</form>
	{/snippet}
</Dialog>

<Dialog
	open={deleting}
	title="Delete {data.team.name}?"
	body="Everyone loses its lessons. You can restore it for 30 days."
	icon="trash"
	tone="danger"
	onclose={() => (deleting = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (deleting = false)}
			>Cancel</button
		>
		<form method="POST" action="?/delete" use:enhance>
			<button type="submit" class={button('danger', 'sm')}>Delete group</button>
		</form>
	{/snippet}
</Dialog>
