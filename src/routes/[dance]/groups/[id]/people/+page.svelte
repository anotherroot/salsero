<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import { peopleLine, roleLabel } from '$lib/teams/view';
	import { removeBody } from '$lib/teams/leave-view';
	import { t } from '$lib/i18n/catalog';
	import type { Person } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const owner = $derived(data.role === 'owner');
	const w = $derived(t().groups.people);
	/** The person a sheet or question is about. */
	let acting = $state<Person | null>(null);
	let asking = $state<{ kind: 'handOver' | 'remove'; person: Person } | null>(null);

	function ask(kind: 'handOver' | 'remove') {
		if (!acting) return;
		asking = { kind, person: acting };
		acting = null;
	}
</script>

<svelte:head><title>{w.title} · {data.team.name}</title></svelte:head>

<Screen title={w.title} subtitle="{data.team.name} · {peopleLine(data.people.length)}" compact>
	{#snippet left()}
		<BackButton
			fallback={{
				href: resolve('/[dance]/groups/[id]', {
					dance: data.dance.slug,
					id: String(data.team.id)
				}),
				label: t().shell.backTo(data.team.name)
			}}
		/>
	{/snippet}

	{#if form?.message}<Banner kind="error">{form.message}</Banner>{/if}

	<ul class={GROUP} aria-label={w.title}>
		{#each data.people as person (person.id)}
			<li class="flex min-h-14 items-center gap-3 px-4 py-2">
				<span class="min-w-0 flex-1 truncate text-[16px] font-bold text-ink">{person.name}</span>
				<Badge tone={person.role === 'owner' ? 'accent' : 'neutral'}>{roleLabel(person.role)}</Badge
				>
				{#if owner && person.role !== 'owner'}
					<button
						type="button"
						class="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full text-muted active:bg-step"
						aria-label={w.actionsFor(person.name)}
						onclick={() => (acting = person)}><Icon name="more" /></button
					>
				{/if}
			</li>
		{/each}
	</ul>
</Screen>

<Sheet
	title={acting?.name ?? ''}
	open={acting !== null}
	onclose={() => (acting = null)}
	size="small"
>
	{#if acting}
		<div class={GROUP}>
			<form
				method="POST"
				action="?/role"
				use:enhance={() =>
					async ({ update }) => {
						acting = null;
						await update();
					}}
			>
				<input type="hidden" name="userId" value={acting.id} />
				<input type="hidden" name="role" value={acting.role === 'editor' ? 'member' : 'editor'} />
				<button
					type="submit"
					class="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-step"
				>
					<span class="flex-none text-accent-text"><Icon name="edit" size={22} /></span>
					<span class="text-[16px] font-bold text-ink"
						>{acting.role === 'editor' ? w.makeMember : w.makeEditor}</span
					>
				</button>
			</form>
			<button
				type="button"
				class="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-step"
				onclick={() => ask('handOver')}
			>
				<span class="flex-none text-accent-text"><Icon name="key" size={22} /></span>
				<span class="text-[16px] font-bold text-ink">{w.handOverGroup}</span>
			</button>
			<button
				type="button"
				class="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-step"
				onclick={() => ask('remove')}
			>
				<span class="flex-none text-danger"><Icon name="trash" size={22} /></span>
				<span class="text-[16px] font-bold text-danger">{t().common.remove}</span>
			</button>
		</div>
	{/if}
</Sheet>

<Dialog
	open={asking !== null}
	title={asking?.kind === 'handOver'
		? w.handOverQuestion(asking.person.name)
		: w.removeQuestion(asking?.person.name ?? '')}
	body={asking?.kind === 'handOver' ? w.handOverBody : removeBody()}
	icon={asking?.kind === 'handOver' ? 'key' : 'trash'}
	tone="danger"
	onclose={() => (asking = null)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (asking = null)}
			>{t().common.cancel}</button
		>
		<form
			method="POST"
			action={asking?.kind === 'handOver' ? '?/handOver' : '?/remove'}
			use:enhance={() =>
				async ({ update }) => {
					asking = null;
					await update();
				}}
		>
			<input type="hidden" name="userId" value={asking?.person.id ?? ''} />
			<button type="submit" class={button('danger', 'sm')}
				>{asking?.kind === 'handOver' ? w.handOver : t().common.remove}</button
			>
		</form>
	{/snippet}
</Dialog>
