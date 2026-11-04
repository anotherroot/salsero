<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SendSheet from './SendSheet.svelte';
	import { GROUP, ROW, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		FAMILY_TITLE,
		SEND_MINE,
		YOURS,
		memberMeta,
		selfMeta,
		statusChip
	} from '$lib/clones/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { CloneKind, FamilyView, PlaceRef } from '$lib/types';

	/**
	 * Copies you can see (board C3 p1): this row first ("This one · you
	 * changed …"), then every other member of its family the person reads,
	 * each with their role there and where it stands against this one, as a
	 * chip. Each copy opens its own page. Send mine… writes this one's
	 * changes into the copies the person edits (`SendSheet`).
	 */
	let {
		family,
		kind,
		dance,
		current
	}: {
		family: FamilyView;
		kind: CloneKind;
		dance: DanceSlug;
		/** The page's own row. */
		current: number;
	} = $props();

	const uid = $props.id();
	let sending = $state(false);

	const name = (p: PlaceRef) => (p.kind === 'team' ? p.name : YOURS);
	const self = $derived(family.entries.find((e) => e.member.id === current));
	const pageWord = $derived(self?.member.place.kind === 'mine' ? 'yours' : 'this one');

	function pageOf(id: number): string {
		const p = { dance, id: String(id) };
		switch (kind) {
			case 'figure':
				return resolve('/[dance]/figures/[id]', p);
			case 'routine':
				return resolve('/[dance]/routines/[id]', p);
			case 'drill':
				return resolve('/[dance]/exercises/[id]', p);
			case 'song':
				return resolve('/[dance]/songs/[id]', p);
			case 'lesson':
				return resolve('/[dance]/lessons/[id]', p);
		}
	}
</script>

<section class="flex flex-col gap-2" aria-labelledby="{uid}-family">
	<h2 id="{uid}-family" class={SECTION_LABEL}>{FAMILY_TITLE}</h2>
	<ul class={GROUP}>
		{#each family.entries as e (e.member.id)}
			{@const chip = statusChip(e.status)}
			<li>
				{#if e.member.id === current}
					<div class={ROW}>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-[16px] font-bold text-ink">{name(e.member.place)}</span>
							<span class="text-[13px] text-muted">{selfMeta(e.changed)}</span>
						</span>
					</div>
				{:else}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- pageOf resolves it -->
					<a href={pageOf(e.member.id)} class={ROW}>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-[16px] font-bold text-ink">{name(e.member.place)}</span>
							<span class="text-[13px] text-muted"
								>{memberMeta(e.role, e.status, e.changed, pageWord)}</span
							>
						</span>
						{#if chip}<Badge tone={chip.tone}>{chip.text}</Badge>{/if}
						<span class="flex-none text-chevron"><Icon name="chevron-right" size={18} /></span>
					</a>
				{/if}
			</li>
		{/each}
	</ul>
	{#if family.canSend}
		<button
			type="button"
			class={button('secondary', 'md', true)}
			aria-haspopup="dialog"
			onclick={() => (sending = true)}><Icon name="upload" size={20} />{SEND_MINE}</button
		>
		<SendSheet open={sending} onclose={() => (sending = false)} {kind} fromId={current} />
	{/if}
</section>
