<!-- src/lib/components/links/LinkPopup.svelte -->
<script lang="ts" module>
	/** The popup's list, or one of its create steps. */
	export type LinkStep = 'list' | 'variation' | 'figure' | 'drill';
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { DANCES } from '$lib/dances/dances';
	import { DEFAULT_EVERY_DAYS, FREQUENCIES } from '$lib/frequency';
	import { PARTNER, PARTNER_LABEL, type Partner } from '$lib/labels';
	import { addLink, createLink, fetchLinkOptions, removeLink } from '$lib/video/links-api';
	import { SpotsApiError } from '$lib/video/spots-api';
	import { lengthText, spotTime } from '$lib/video/spots';
	import type { LinkCreate, LinkedTarget, LinkOption, LinkOptions } from '$lib/types';

	/**
	 * One section's links: what it is linked to (× unlinks), one tap to link
	 * something else, and three create steps that make a variation, a figure or
	 * a drill and link it. A create step replaces the list, never opens on top
	 * of it. See `docs/superpowers/specs/2026-10-29-section-link-popup-design.md`.
	 *
	 * `light` is a modal <dialog> of its own, for site pages. `dark` is an
	 * overlay inside the full-screen player's <dialog>, which owns Back and Esc.
	 * No field is ever focused for the user: the keyboard opens on a tap.
	 */
	interface Props {
		spotId: number;
		theme: 'light' | 'dark';
		/** Controlled, so the player can tie list ↔ create to history. */
		step: LinkStep;
		onstep: (step: LinkStep) => void;
		/** After every change: the section's link labels, for the small lines. */
		onchange?: (labels: string[]) => void;
		onclose: () => void;
	}

	let { spotId, theme, step, onstep, onchange, onclose }: Props = $props();

	let options = $state<LinkOptions | null>(null);
	let loadFailed = $state(false);
	let busy = $state(false);
	let message = $state<string | null>(null);
	let query = $state('');
	/** A linked target whose × asked: also on the lesson by hand. */
	let asking = $state<LinkedTarget | null>(null);

	// Create steps' fields, kept while the popup is open so Back and forth keeps them.
	let groupId = $state<number | null>(null);
	let otherFigures = $state(false);
	let figureQuery = $state('');
	let variationName = $state('');
	let figureName = $state('');
	let firstName = $state('Basic');
	let partner = $state<Partner>('partner');
	let style = $state('');
	let drillName = $state('');
	let everyDays = $state<number>(DEFAULT_EVERY_DAYS);

	let dialog: HTMLDialogElement | undefined = $state();

	onMount(() => {
		if (theme === 'light') dialog?.showModal();
		fetchLinkOptions(spotId).then(
			(o) => {
				options = o;
				partner = o.defaults.partner;
				style = o.defaults.style;
				groupId = o.figures.find((f) => f.near)?.groupId ?? null;
			},
			() => (loadFailed = true)
		);
	});

	const range = $derived(
		options ? `${spotTime(options.spot.startMs)}–${spotTime(options.spot.endMs)}` : ''
	);
	const destination = $derived(
		options?.context.kind === 'lesson'
			? `Linked to ${range} and to ${options.context.title}`
			: `Linked to ${range}`
	);
	const matches = (o: LinkOption) =>
		!query.trim() || o.label.toLowerCase().includes(query.trim().toLowerCase());
	const near = $derived(options ? options.near.filter(matches) : []);
	const other = $derived(options ? options.other.filter(matches) : []);
	const nearFigures = $derived(options ? options.figures.filter((f) => f.near) : []);
	const pickedFigure = $derived(options?.figures.find((f) => f.groupId === groupId) ?? null);
	const restFigures = $derived(
		options
			? options.figures.filter(
					(f) =>
						!f.near &&
						(!figureQuery.trim() ||
							[f.name, ...f.variations].some((n) =>
								n.toLowerCase().includes(figureQuery.trim().toLowerCase())
							))
				)
			: []
	);

	async function run(call: () => Promise<LinkOptions>, after?: () => void) {
		if (busy) return;
		busy = true;
		message = null;
		try {
			options = await call();
			onchange?.(options.linked.map((l) => l.label));
			after?.();
		} catch (e) {
			message = e instanceof SpotsApiError ? e.message : "Couldn't save";
		} finally {
			busy = false;
		}
	}

	function open(next: Exclude<LinkStep, 'list'>) {
		message = null;
		const typed = query.trim();
		if (typed) {
			if (next === 'variation') variationName = typed;
			if (next === 'figure') figureName = typed;
			if (next === 'drill') drillName = typed;
		}
		onstep(next);
	}

	function unlink(l: LinkedTarget) {
		if (l.alsoByHand) {
			asking = l;
			return;
		}
		void run(() => removeLink(spotId, l.linkId, false));
	}

	function create(e: SubmitEvent) {
		e.preventDefault();
		let body: LinkCreate;
		if (step === 'variation') {
			if (groupId === null) {
				message = 'Pick a figure.';
				return;
			}
			body = { kind: 'variation', groupId, name: variationName };
		} else if (step === 'figure') {
			body = { kind: 'figure', figureName, name: firstName, partner, style };
		} else {
			body = { kind: 'drill', name: drillName, everyDays };
		}
		void run(
			() => createLink(spotId, body),
			() => {
				query = '';
				onstep('list');
			}
		);
	}

	/** Esc on the light dialog: back to the list first, then closed. */
	function back(e: Event) {
		e.preventDefault();
		if (asking) asking = null;
		else if (step !== 'list') onstep('list');
		else onclose();
	}

	// The theme is fixed for the popup's life: a host never switches it.
	const dark = untrack(() => theme === 'dark');
	const c = dark
		? {
				card: 'border border-(--pl-hover) bg-(--pl-surface) text-(--pl-ink)',
				muted: 'text-(--pl-muted)',
				ink2: 'text-(--pl-ink-2)',
				line: 'border-(--pl-raised)',
				accent: 'text-(--pl-accent)',
				field:
					'w-full rounded-lg border border-(--pl-hover) bg-(--pl-raised) px-3 py-2.5 text-[15px] text-(--pl-ink) outline-none focus:border-(--pl-accent)',
				go: 'bg-(--pl-accent) text-(--pl-accent-ink)',
				plain: 'bg-(--pl-raised) text-(--pl-ink)',
				small: 'bg-(--pl-raised) text-(--pl-accent)',
				on: 'bg-(--pl-accent) text-(--pl-accent-ink)',
				off: 'bg-(--pl-raised) text-(--pl-ink-2)',
				dashed: 'border-(--pl-tick) text-(--pl-ink-2)',
				danger: 'bg-(--pl-danger-fill) text-white',
				error: 'text-(--pl-danger)'
			}
		: {
				card: 'bg-surface text-ink',
				muted: 'text-muted',
				ink2: 'text-ink-2',
				line: 'border-line',
				accent: 'text-accent',
				field:
					'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent',
				go: 'bg-accent text-accent-ink',
				plain: 'border border-rule bg-raised text-ink',
				small: 'border border-rule bg-raised text-accent',
				on: 'border border-accent bg-accent text-accent-ink',
				off: 'border border-rule bg-raised text-ink-2',
				dashed: 'border-rule text-accent',
				danger: 'bg-danger text-white',
				error: 'text-danger'
			};
	const label = `mb-1 mt-3 block text-[12px] font-medium ${c.muted}`;
	const group = `mt-3 mb-0.5 text-[11.5px] font-medium tracking-wide uppercase ${c.muted}`;
	const chip = 'h-10 cursor-pointer rounded-lg px-3 text-[14px]';
	const big = 'h-11 w-full cursor-pointer rounded-xl text-[15px] font-semibold disabled:opacity-40';
</script>

{#snippet header(title: string, sub: string, withBack: boolean)}
	{#if withBack}
		<button
			type="button"
			class="mb-1 -ml-1 h-8 cursor-pointer px-1 text-[14px] font-medium {c.accent}"
			onclick={() => onstep('list')}>‹ Link</button
		>
	{/if}
	<div class="flex items-start gap-2">
		<div class="min-w-0 flex-1">
			<h2 class="text-[17px] font-semibold">{title}</h2>
			<p class="mt-0.5 text-[12.5px] {c.muted}">{sub}</p>
		</div>
		<button
			type="button"
			class="-mt-1 -mr-2 grid size-10 shrink-0 cursor-pointer place-items-center text-[20px] {c.muted}"
			aria-label="Close"
			onclick={onclose}>×</button
		>
	</div>
{/snippet}

{#snippet row(o: LinkOption)}
	<li class="flex items-center gap-2 border-b py-1.5 last:border-b-0 {c.line}">
		<span class="min-w-0 flex-1 truncate text-[15px]"
			>{o.label}{#if o.drill}<span class="ml-1.5 text-[12px] {c.muted}">Drill</span>{/if}</span
		>
		<button
			type="button"
			class="h-9 shrink-0 cursor-pointer rounded-lg px-3 text-[13px] font-semibold {c.small}"
			disabled={busy}
			onclick={() => run(() => addLink(spotId, o.target))}>Add</button
		>
	</li>
{/snippet}

{#snippet body()}
	{#if loadFailed}
		<p class="text-[14px] {c.error}">Couldn't load this section's links.</p>
		<button type="button" class="{big} mt-4 {c.plain}" onclick={onclose}>Close</button>
	{:else if !options}
		<p class="py-6 text-center text-[14px] {c.muted}">Loading…</p>
	{:else if asking}
		<h2 class="text-[17px] font-semibold">Unlink {asking.label}?</h2>
		<p class="mt-1 text-[14px] {c.ink2}">It's also linked to this lesson.</p>
		<div class="mt-4 flex flex-col gap-2">
			<button
				type="button"
				class="{big} {c.plain}"
				disabled={busy}
				onclick={() => {
					const l = asking!;
					void run(
						() => removeLink(spotId, l.linkId, false),
						() => (asking = null)
					);
				}}>Only from this section</button
			>
			<button
				type="button"
				class="{big} {c.danger}"
				disabled={busy}
				onclick={() => {
					const l = asking!;
					void run(
						() => removeLink(spotId, l.linkId, true),
						() => (asking = null)
					);
				}}>From the section and the lesson</button
			>
			<button
				type="button"
				class="h-11 cursor-pointer text-[14px] font-medium {c.muted}"
				onclick={() => (asking = null)}>Cancel</button
			>
		</div>
	{:else if step === 'list'}
		{@render header(
			`Link ${range}`,
			[options.spot.label, lengthText(options.spot.endMs - options.spot.startMs)]
				.filter(Boolean)
				.join(' · '),
			false
		)}
		{#if options.linked.length > 0}
			<p class={group}>Linked</p>
			<ul>
				{#each options.linked as l (l.linkId)}
					<li class="flex items-center gap-2 border-b py-1.5 last:border-b-0 {c.line}">
						<span
							class="min-w-0 flex-1 truncate text-[15px] font-medium {l.archived ? c.muted : ''}"
							>{l.label}{l.archived ? ' (archived)' : ''}{#if l.drill}<span
									class="ml-1.5 text-[12px] font-normal {c.muted}">Drill</span
								>{/if}</span
						>
						<button
							type="button"
							class="grid size-9 shrink-0 cursor-pointer place-items-center text-[18px] {c.muted}"
							aria-label="Unlink {l.label}"
							disabled={busy}
							onclick={() => unlink(l)}>×</button
						>
					</li>
				{/each}
			</ul>
		{/if}
		<input
			type="search"
			bind:value={query}
			placeholder="Search figures and drills"
			aria-label="Search figures and drills"
			class="mt-3 {c.field}"
		/>
		{#if near.length > 0}
			<p class={group}>{options.context.kind === 'lesson' ? 'This lesson' : 'This figure'}</p>
			<ul>
				{#each near as o (`${o.drill}-${o.label}`)}{@render row(o)}{/each}
			</ul>
		{/if}
		{#if other.length > 0}
			<p class={group}>Other</p>
			<ul>
				{#each other as o (`${o.drill}-${o.label}`)}{@render row(o)}{/each}
			</ul>
		{/if}
		{#if near.length === 0 && other.length === 0}
			<p class="mt-3 text-[13px] {c.muted}">
				{query.trim() ? 'Nothing matches. Create it below.' : 'Nothing else to link.'}
			</p>
		{/if}
		{#if message}<p class="mt-2 text-[13px] {c.error}" role="alert">{message}</p>{/if}
		<div class="mt-3 flex gap-1.5">
			{#each [['variation', '+ Variation'], ['figure', '+ Figure'], ['drill', '+ Drill']] as const as [kind, text] (kind)}
				<button
					type="button"
					class="h-11 flex-1 cursor-pointer rounded-xl border border-dashed text-[13px] font-semibold {c.dashed}"
					onclick={() => open(kind)}>{text}</button
				>
			{/each}
		</div>
	{:else}
		<form onsubmit={create}>
			{#if step === 'variation'}
				{@render header('New variation', destination, true)}
				<span class={label}>Figure</span>
				<div class="flex flex-wrap gap-1.5">
					{#each nearFigures as f (f.groupId)}
						<button
							type="button"
							class="{chip} {groupId === f.groupId ? c.on : c.off}"
							aria-pressed={groupId === f.groupId}
							onclick={() => {
								groupId = f.groupId;
								otherFigures = false;
							}}>{f.name}</button
						>
					{/each}
					{#if pickedFigure && !pickedFigure.near}
						<button type="button" class="{chip} {c.on}" aria-pressed="true"
							>{pickedFigure.name}</button
						>
					{/if}
					<button
						type="button"
						class="{chip} {otherFigures ? c.on : c.off}"
						aria-expanded={otherFigures}
						onclick={() => (otherFigures = !otherFigures)}>Other…</button
					>
				</div>
				{#if otherFigures}
					<input
						type="search"
						bind:value={figureQuery}
						placeholder="Search figures"
						aria-label="Search figures"
						class="mt-2 {c.field}"
					/>
					<ul class="mt-1 max-h-40 overflow-y-auto">
						{#each restFigures as f (f.groupId)}
							<li class="border-b last:border-b-0 {c.line}">
								<button
									type="button"
									class="flex w-full cursor-pointer flex-col items-start py-2 text-left"
									onclick={() => {
										groupId = f.groupId;
										otherFigures = false;
									}}
								>
									<span class="text-[15px]">{f.name}</span>
									<span class="text-[12px] {c.muted}">{f.variations.join(', ')}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				<label class="block">
					<span class={label}>Variation name</span>
					<input bind:value={variationName} required maxlength="200" class={c.field} />
				</label>
			{:else if step === 'figure'}
				{@render header('New figure', destination, true)}
				<label class="block">
					<span class={label}>Figure name</span>
					<input bind:value={figureName} required maxlength="200" class={c.field} />
				</label>
				<label class="block">
					<span class={label}>Variation name</span>
					<input bind:value={firstName} required maxlength="200" class={c.field} />
				</label>
				<span class={label}>Danced</span>
				<div class="flex gap-1.5">
					{#each PARTNER as p (p)}
						<button
							type="button"
							class="{chip} flex-1 {partner === p ? c.on : c.off}"
							aria-pressed={partner === p}
							onclick={() => (partner = p)}>{PARTNER_LABEL[p]}</button
						>
					{/each}
				</div>
				<span class={label}>Style</span>
				<div class="flex gap-1.5">
					{#each DANCES[options.dance].styles as s (s)}
						<button
							type="button"
							class="{chip} flex-1 {style === s ? c.on : c.off}"
							aria-pressed={style === s}
							onclick={() => (style = s)}>{DANCES[options.dance].styleLabel[s]}</button
						>
					{/each}
				</div>
			{:else}
				{@render header('New drill', destination, true)}
				<label class="block">
					<span class={label}>Name</span>
					<input bind:value={drillName} required maxlength="200" class={c.field} />
				</label>
				<label class="block">
					<span class={label}>How often</span>
					<select bind:value={everyDays} class={c.field}>
						{#each FREQUENCIES as f (f.days)}
							<option value={f.days}>{f.label}</option>
						{/each}
					</select>
				</label>
			{/if}
			{#if message}<p class="mt-2 text-[13px] {c.error}" role="alert">{message}</p>{/if}
			<button type="submit" class="{big} mt-4 {c.go}" disabled={busy}>Create and link</button>
		</form>
	{/if}
{/snippet}

{#if dark}
	<div
		class="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) onclose();
		}}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Link a section"
			class="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-2xl p-4 shadow-[0_16px_40px_rgb(0_0_0/0.6)] {c.card}"
		>
			{@render body()}
		</div>
	</div>
{:else}
	<dialog
		bind:this={dialog}
		aria-label="Link a section"
		oncancel={back}
		{onclose}
		onclick={(e) => {
			if (e.target === dialog) onclose();
		}}
	>
		<div class="max-h-[88dvh] overflow-y-auto p-4">{@render body()}</div>
	</dialog>
{/if}

<style>
	dialog {
		margin: auto;
		width: calc(100% - 32px);
		max-width: 420px;
		padding: 0;
		border: none;
		border-radius: 18px;
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: 0 16px 40px rgb(0 0 0 / 0.25);
	}
	dialog::backdrop {
		background: rgb(20 18 16 / 0.45);
	}
</style>
