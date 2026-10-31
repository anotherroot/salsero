<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import LessonFields from '$lib/components/lessons/LessonFields.svelte';
	import FrequencyField from '$lib/components/exercises/FrequencyField.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { DEFAULT_EVERY_DAYS } from '$lib/frequency';
	import { dateTile, diskSubtitle, lessonCounts, monthGroups, videoMeta } from '$lib/lessons/list';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creating = $state(false);
	// The `form` that was there when the sheet opened: an older refusal is not this sheet's.
	let seen: unknown = $state(null);
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form !== seen && form?.message) creating = true;
	});
	let busy = $state(false);
	let everyDays = $state(DEFAULT_EVERY_DAYS);

	function openSheet() {
		seen = form;
		creating = true;
	}

	// A refusal that is about no one field goes at the top of the sheet.
	const otherError = $derived(form?.message && !form.field ? form.message : null);
	const errors = $derived(
		form?.field && form.message ? { [form.field]: form.message } : ({} as Record<string, string>)
	);
	// What was typed comes back with a refusal; an old one is not this sheet's.
	const fresh = $derived(form !== seen ? form : null);
	const groups = $derived(monthGroups(data.lessons));
</script>

<svelte:head><title>Lessons · {data.dance.label}</title></svelte:head>

<Screen title="Lessons" subtitle={diskSubtitle(data.storageBytes)}>
	{#snippet right()}
		<BandButton icon="plus" label="New lesson" onclick={openSheet} />
	{/snippet}

	{#if data.lessons.length === 0}
		<div class="h-[52px] flex-none"></div>
		<EmptyState
			icon="lessons"
			title="No lessons yet"
			body="Add one after your next class — the videos, the notes, and something on Today to make you go back over it."
		>
			{#snippet action()}
				<button type="button" class={button('primary')} onclick={openSheet}>
					<Icon name="plus" size={20} /> New lesson
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="flex flex-col gap-3.5">
			{#each groups as group (group.key)}
				<section class="flex flex-col gap-2">
					<h2 class={SECTION_LABEL}>{group.label}</h2>
					<ul class={GROUP} aria-label={group.label}>
						{#each group.lessons as lesson (lesson.id)}
							{@const tile = dateTile(lesson.lessonDay)}
							{@const meta = videoMeta(lesson)}
							<li>
								<a
									href={resolve('/[dance]/lessons/[id]', {
										dance: data.dance.slug,
										id: String(lesson.id)
									})}
									class="flex min-h-[84px] items-center gap-3 py-3 pr-3 pl-4 active:bg-step"
								>
									<span
										aria-hidden="true"
										class="flex h-[54px] w-12 flex-none flex-col items-center justify-center gap-[3px] rounded-xl bg-accent-soft"
									>
										<span
											class="text-[11px] leading-none font-extrabold tracking-[0.06em] text-accent-text uppercase"
											>{tile.weekday}</span
										>
										<span class="font-display text-[22px] leading-none font-extrabold text-ink"
											>{tile.day}</span
										>
									</span>
									<span class="flex min-w-0 flex-1 flex-col gap-0.5">
										<span class="text-[16px] leading-[1.3] font-bold text-ink"
											><span class="sr-only">{tile.label}, </span>{lesson.title}</span
										>
										{#if meta}<span class="text-[13px] text-muted">{meta}</span>{/if}
										<!-- Always all three, in the same place: a zero fades rather than vanishing, so a lesson still missing something shows it. -->
										<span class="mt-[5px] flex flex-wrap gap-x-3 text-[13px]">
											{#each lessonCounts(lesson) as c (c.word)}
												<span class={c.n === 0 ? 'text-muted' : 'text-ink-2'}
													><span class="font-extrabold tabular-nums {c.n === 0 ? '' : 'text-ink'}"
														>{c.n}</span
													>
													{c.word}</span
												>
											{/each}
										</span>
									</span>
									<span class="flex flex-none text-chevron"
										><Icon name="chevron-right" size={20} /></span
									>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</Screen>

<Sheet title="New lesson" open={creating} onclose={() => (creating = false)}>
	<form
		id="new-lesson"
		method="POST"
		action="?/create"
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'New lesson',
			submit: ({ cancel }) => {
				// One lesson per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}
		}}
	>
		{#if otherError && fresh}<Banner kind="error">{otherError}</Banner>{/if}

		<LessonFields
			autofocus
			lessonDay={fresh?.lessonDay ?? data.today}
			title={fresh?.title ?? ''}
			notes={fresh?.notes ?? null}
			max={data.today}
			errors={fresh ? errors : {}}
		/>

		<div class="flex flex-col gap-1.5">
			<FrequencyField name="everyDays" label="Go over it again" bind:value={everyDays} />
			<p class="pl-1 text-[13px] text-muted">Puts “Review: …” on Today; lower it as it settles.</p>
		</div>
	</form>

	{#snippet footer()}
		<button
			type="submit"
			form="new-lesson"
			class={button('primary', 'md', true)}
			aria-busy={busy}
			aria-label={busy ? 'Creating lesson' : undefined}
		>
			{#if busy}<Spinner />{:else}Create lesson{/if}
		</button>
	{/snippet}
</Sheet>
