<!-- src/lib/components/links/LinkPopup.svelte -->
<script lang="ts" module>
	import type { LinkStep as Step } from '$lib/video/link-steps';
	/** Re-exported for hosts; defined in $lib/video/link-steps. */
	export type LinkStep = Step;
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Picker from '$lib/components/picker/Picker.svelte';
	import PickerField from '$lib/components/picker/PickerField.svelte';
	import LinkLevel from './LinkLevel.svelte';
	import { DANCES } from '$lib/dances/dances';
	import { DEFAULT_EVERY_DAYS, FREQUENCIES } from '$lib/frequency';
	import { PARTNER, PARTNER_LABEL, type Partner } from '$lib/labels';
	import { figureRows, linkOptionGroups } from '$lib/picker/build';
	import { isHeading, type PickGroup, type PickRow } from '$lib/picker/model';
	import { addLink, createLink, fetchLinkOptions, removeLink } from '$lib/video/links-api';
	import { SpotsApiError } from '$lib/video/spots-api';
	import { lengthText, spotTime } from '$lib/video/spots';
	import type {
		LinkCreate,
		LinkedTarget,
		LinkFigureChoice,
		LinkOptions,
		SectionTarget
	} from '$lib/types';

	/**
	 * One section's links, as levels the host stacks (`steps`, the top one
	 * shows): the links list (× unlinks) with one "Link a figure or drill…"
	 * button; the shared picker over it (a tap links and closes everything, +
	 * links and stays, Done closes); and the create steps, opened from the
	 * picker's create row on top of it, which make a variation, a figure or a
	 * drill and link it. A section with no links opens straight into the
	 * picker (`openingSteps`). See
	 * `docs/superpowers/specs/2026-10-30-unified-pickers-design.md`, "The Link popup".
	 *
	 * `light`: each level is a modal <dialog> or a Sheet, stacked in the top
	 * layer, for site pages. `dark`: overlays inside the full-screen player's
	 * <dialog>, which owns Back. No field is ever focused for the user on a
	 * phone: the keyboard opens on a tap.
	 */
	interface Props {
		spotId: number;
		theme: 'light' | 'dark';
		/** The stack of levels; the top one shows. Controlled by the host. */
		steps: LinkStep[];
		onpush: (step: LinkStep) => void;
		/** One level back (×, Escape, the backdrop). */
		onback: () => void;
		/** Finished or closed: everything goes. */
		onclose: () => void;
		/** After every change: the section's link labels, for the small lines. */
		onchange?: (labels: string[]) => void;
	}

	let { spotId, theme, steps, onpush, onback, onclose, onchange }: Props = $props();

	type CreateStep = 'variation' | 'figure' | 'drill';
	const CREATE_STEPS: readonly LinkStep[] = ['variation', 'figure', 'drill'];
	const CREATE_ROW = [
		{ key: 'variation', label: '+ Variation' },
		{ key: 'figure', label: '+ Figure' },
		{ key: 'drill', label: '+ Drill' }
	];

	let options = $state<LinkOptions | null>(null);
	let loadFailed = $state(false);
	let busy = $state(false);
	/** The links list's and the create steps' refusals. */
	let message = $state<string | null>(null);
	/** A linked target whose × asked: also on the lesson by hand. */
	let asking = $state<LinkedTarget | null>(null);

	// The picker's opening: how many + it has linked, its refusal, and the
	// options its groups were built from (fixed while it is open, rule 5).
	let added = $state(0);
	let pickMessage = $state<string | null>(null);
	let pickBase = $state.raw<LinkOptions | null>(null);
	/** Counts openings, so an answer that lands after a close is not counted in the next one. */
	let opening = 0;
	/** Rows whose link is on its way: a second + on one would only be refused. Nothing renders it. */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const inFlight = new Set<string>();

	// Create steps' fields, kept while the popup is open so back and forth keeps them.
	let groupId = $state<number | null>(null);
	let variationName = $state('');
	let figureName = $state('');
	let firstName = $state('Basic');
	let partner = $state<Partner>('partner');
	let style = $state('');
	let drillName = $state('');
	let everyDays = $state<number>(DEFAULT_EVERY_DAYS);

	onMount(() => {
		fetchLinkOptions(spotId).then(
			(o) => {
				options = o;
				partner = o.defaults.partner;
				style = o.defaults.style;
				groupId = o.figureChoices.find((f) => f.near)?.groupId ?? null;
			},
			() => (loadFailed = true)
		);
	});

	const top = $derived(steps.at(-1));
	const picking = $derived(steps.includes('pick'));
	const createStep = $derived(steps.find((s): s is CreateStep => CREATE_STEPS.includes(s)) ?? null);

	// Every opening of the picker starts clean, and fences off late answers.
	let wasPicking = false;
	$effect(() => {
		const now = picking;
		if (now !== wasPicking) {
			wasPicking = now;
			opening += 1;
			added = 0;
			pickMessage = null;
		}
		if (!now) pickBase = null;
		else if (!untrack(() => pickBase) && options) pickBase = options;
	});

	// A create step's refusal goes with it: the links list below must not show it.
	$effect(() => {
		if (!createStep) message = null;
	});

	const range = $derived(
		options ? `${spotTime(options.spot.startMs)}–${spotTime(options.spot.endMs)}` : ''
	);
	const destination = $derived(
		options?.context.kind === 'lesson'
			? `Linked to ${range} and to ${options.context.title}`
			: `Linked to ${range}`
	);

	const targetKey = (t: SectionTarget) =>
		'figureId' in t ? `figure:${t.figureId}` : `exercise:${t.exerciseId}`;
	const rowTarget = (r: PickRow): SectionTarget =>
		r.key.startsWith('figure:') ? { figureId: r.value } : { exerciseId: r.value };

	/** The opening's groups, with "✓ Linked" from the latest answer. */
	const groups = $derived.by((): PickGroup[] => {
		if (!pickBase) return [];
		const keys = new Set(options?.linked.map((l) => targetKey(l.target)) ?? []);
		const row = (r: PickRow): PickRow => ({ ...r, linked: keys.has(r.key) });
		return linkOptionGroups(pickBase).map((g) => ({
			...g,
			entries: g.entries.map((e) => (isHeading(e) ? { ...e, rows: e.rows.map(row) } : row(e)))
		}));
	});

	const asTarget = (c: LinkFigureChoice) => ({
		id: c.groupId,
		name: c.name,
		variations: c.variations
	});
	const figureGroups = $derived(
		options
			? [
					{
						title: options.nearTitle,
						entries: figureRows(options.figureChoices.filter((c) => c.near).map(asTarget))
					},
					{
						title: 'Figures',
						entries: figureRows(options.figureChoices.filter((c) => !c.near).map(asTarget))
					}
				]
			: []
	);

	function changed(o: LinkOptions) {
		options = o;
		onchange?.(o.linked.map((l) => l.label));
	}

	async function run(call: () => Promise<LinkOptions>, after?: () => void) {
		if (busy) return;
		busy = true;
		message = null;
		try {
			changed(await call());
			after?.();
		} catch (e) {
			message = e instanceof SpotsApiError ? e.message : "Couldn't save";
		} finally {
			busy = false;
		}
	}

	/** A tap links and closes everything; + links and keeps picking. */
	async function link(row: PickRow, keep: boolean) {
		if (inFlight.has(row.key)) return;
		inFlight.add(row.key);
		const at = opening;
		pickMessage = null;
		try {
			// A late answer still lands: the link was made, the list shows it.
			changed(await addLink(spotId, rowTarget(row)));
			if (at !== opening) return;
			if (keep) added += 1;
			else onclose();
		} catch (e) {
			if (at === opening) {
				pickMessage = e instanceof SpotsApiError ? e.message : 'That could not be linked.';
			}
		} finally {
			inFlight.delete(row.key);
		}
	}

	/** The picker's create row: the step opens on top of it, the search text in its name. */
	function startCreate(key: string, typed: string) {
		if (!CREATE_STEPS.includes(key as LinkStep)) return;
		message = null;
		if (typed) {
			if (key === 'variation') variationName = typed;
			if (key === 'figure') figureName = typed;
			if (key === 'drill') drillName = typed;
		}
		onpush(key as CreateStep);
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
		if (createStep === 'variation') {
			if (groupId === null) {
				message = 'Pick a figure.';
				return;
			}
			body = { kind: 'variation', groupId, name: variationName };
		} else if (createStep === 'figure') {
			body = { kind: 'figure', figureName, name: firstName, partner, style };
		} else {
			body = { kind: 'drill', name: drillName, everyDays };
		}
		void run(() => createLink(spotId, body), onclose);
	}

	/** The Figure field's picker is a level of its own, so Back closes it first. */
	function setFigurePicking(v: boolean) {
		if (v && top !== 'variation-figure') onpush('variation-figure');
		else if (!v && top === 'variation-figure') onback();
	}

	/** The "Unlink …?" question takes Escape and the backdrop before the level does. */
	function closeQuestion(): boolean {
		if (!asking) return false;
		asking = null;
		return true;
	}

	// The theme is fixed for the popup's life: a host never switches it.
	const dark = untrack(() => theme === 'dark');
	const c = dark
		? {
				muted: 'text-(--pl-muted)',
				ink2: 'text-(--pl-ink-2)',
				line: 'border-(--pl-raised)',
				accent: 'text-(--pl-accent)',
				field:
					'w-full rounded-lg border border-(--pl-hover) bg-(--pl-raised) px-3 py-2.5 text-[15px] text-(--pl-ink) outline-none focus:border-(--pl-accent)',
				trigger: 'border-(--pl-hover) bg-(--pl-raised) text-(--pl-accent)',
				go: 'bg-(--pl-accent) text-(--pl-accent-ink)',
				plain: 'bg-(--pl-raised) text-(--pl-ink)',
				on: 'bg-(--pl-accent) text-(--pl-accent-ink)',
				off: 'bg-(--pl-raised) text-(--pl-ink-2)',
				danger: 'bg-(--pl-danger-fill) text-white',
				error: 'text-(--pl-danger)'
			}
		: {
				muted: 'text-muted',
				ink2: 'text-ink-2',
				line: 'border-line',
				accent: 'text-accent',
				field:
					'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent',
				trigger: 'border-rule bg-raised text-accent',
				go: 'bg-accent text-accent-ink',
				plain: 'border border-rule bg-raised text-ink',
				on: 'border border-accent bg-accent text-accent-ink',
				off: 'border border-rule bg-raised text-ink-2',
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
			onclick={onback}>‹ Link</button
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
			onclick={onback}>×</button
		>
	</div>
{/snippet}

{#snippet links()}
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
	{:else}
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
		{:else}
			<p class="mt-3 text-[13px] {c.muted}">Not linked to anything yet.</p>
		{/if}
		{#if message}<p class="mt-2 text-[13px] {c.error}" role="alert">{message}</p>{/if}
		<button
			type="button"
			class="mt-3 flex h-11 w-full cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-left text-[14.5px] font-medium {c.trigger}"
			aria-haspopup="dialog"
			onclick={() => onpush('pick')}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				class="shrink-0 {c.muted}"
				aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg
			>
			Link a figure or drill…
		</button>
	{/if}
{/snippet}

{#snippet createForm(step: CreateStep, o: LinkOptions)}
	<form onsubmit={create}>
		{#if step === 'variation'}
			{@render header('New variation', destination, true)}
			<div class="mt-3">
				<PickerField
					name="groupId"
					label="Figure"
					placeholder="Choose a figure…"
					title="Choose a figure"
					search="Search figures"
					groups={figureGroups}
					nothingLeft="There are no figures yet."
					bind:value={groupId}
					bind:open={() => top === 'variation-figure', setFigurePicking}
					required
					{theme}
				/>
			</div>
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
				{#each DANCES[o.dance].styles as s (s)}
					<button
						type="button"
						class="{chip} flex-1 {style === s ? c.on : c.off}"
						aria-pressed={style === s}
						onclick={() => (style = s)}>{DANCES[o.dance].styleLabel[s]}</button
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
{/snippet}

<!-- Bottom first: in the dark theme DOM order stacks the overlays, in the light one the top layer does. -->
{#if steps.includes('links')}
	<LinkLevel {theme} label="Link a section" intercept={closeQuestion} {onback}>
		{@render links()}
	</LinkLevel>
{/if}

<Picker
	open={picking}
	{theme}
	kind="link"
	title={options ? `Link ${range} to…` : 'Link a section to…'}
	placeholder="Search figures and drills"
	{groups}
	nothingLeft={loadFailed
		? "Couldn't load this section's links."
		: options
			? 'Nothing else to link.'
			: 'Loading…'}
	create={options ? CREATE_ROW : undefined}
	{added}
	message={pickMessage}
	onpick={(row) => link(row, false)}
	onadd={(row) => link(row, true)}
	oncreate={startCreate}
	ondone={onclose}
	onclose={() => {
		// Also reached when the Sheet closes because the level already went.
		if (top === 'pick') onback();
	}}
/>

{#if createStep && options}
	{@const o = options}
	<LinkLevel
		{theme}
		label={createStep === 'variation'
			? 'New variation'
			: createStep === 'figure'
				? 'New figure'
				: 'New drill'}
		z="z-50"
		{onback}
	>
		{@render createForm(createStep, o)}
	</LinkLevel>
{/if}
