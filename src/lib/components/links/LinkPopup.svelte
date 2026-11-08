<!-- src/lib/components/links/LinkPopup.svelte -->
<script lang="ts" module>
	import type { LinkStep as Step } from '$lib/video/link-steps';
	/** Re-exported for hosts; defined in $lib/video/link-steps. */
	export type LinkStep = Step;
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { focusAfterRemoval } from '$lib/focus';
	import { SvelteSet } from 'svelte/reactivity';
	import Picker from '$lib/components/picker/Picker.svelte';
	import PickerField from '$lib/components/picker/PickerField.svelte';
	import PickerOpener from '$lib/components/picker/PickerOpener.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import PlayerLayer from '$lib/components/ui/PlayerLayer.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button, FIELD, iconButton, LABEL, SECTION_LABEL } from '$lib/components/ui/styles';
	import LinkLevel from './LinkLevel.svelte';
	import { DANCES } from '$lib/dances/dances';
	import { PARTNER, type Partner } from '$lib/labels';
	import { t } from '$lib/i18n/catalog';
	import { styleLabelsOf } from '$lib/moves/figures';
	import { figureRows, linkOptionGroups } from '$lib/picker/build';
	import { isHeading, type PickGroup, type PickRow } from '$lib/picker/model';
	import { linkRefusal } from '$lib/picker/view';
	import { addLink, createLink, fetchLinkOptions, removeLink } from '$lib/video/links-api';
	import {
		destination,
		linkHeading,
		linkRowId,
		linkTitles,
		linkWords,
		loadFailed as loadFailedWords,
		momentAt,
		momentLabel,
		refusalAt,
		stacked,
		targetKey,
		unlinkKind,
		type CreateSpot,
		type CreateStep
	} from '$lib/video/link-steps';
	import { SpotsApiError } from '$lib/video/spots-api';
	import { restoreArchived } from '$lib/teams/restore-api';
	import type {
		LinkCreate,
		LinkedTarget,
		LinkFigureChoice,
		LinkOptions,
		LinkTarget
	} from '$lib/types';

	/**
	 * One section's or point's links, as levels the host stacks (`steps`, the
	 * top one shows): the links list (a row opens its figure, drill or position
	 * page, × unlinks) with one "Link a figure, drill or position…" opener; the
	 * shared picker over it (a tap links and closes everything, + links and
	 * stays, Done closes); and the create steps, opened from the picker's create
	 * row on top of it, which make a variation, a figure, a drill or a position
	 * and link it. A point links positions only (ruling 10 of the positions
	 * plan): "Link a position…", and Position its only create. A spot with no
	 * links opens straight into the picker (`openingSteps`). See
	 * `docs/superpowers/specs/2026-10-30-unified-pickers-design.md`, "The Link popup".
	 *
	 * `light`: each level is a `Sheet` with a history entry of its own, the
	 * "Unlink …?" question a `Dialog`, for site pages. `dark`: each is a
	 * `PlayerLayer` inside the full-screen player's <dialog>, which owns Back;
	 * the layers carry the media palette, so one set of token classes draws
	 * both. No field is ever focused for the user on a phone: the keyboard
	 * opens on a tap.
	 */
	interface Props {
		spotId: number;
		theme: 'light' | 'dark';
		/** The stack of levels; the top one shows. Controlled by the host. */
		steps: LinkStep[];
		onpush: (step: LinkStep) => void;
		/** One level back (×, Back, Escape, the backdrop). */
		onback: () => void;
		/** Finished or closed: everything goes. */
		onclose: () => void;
		/** After every change: the section's link labels, for the small lines. */
		onchange?: (labels: string[]) => void;
		/**
		 * A linked row's tap, in place of following its link: the player closes
		 * itself first, so its history entries are gone before the page changes.
		 */
		onopen?: (href: string) => void;
		/**
		 * "Use this moment as a point": the full-screen player's, which knows the
		 * playhead. It saves a point there and opens the popup on it; it answers
		 * what to say when that failed (shown here, the popup still usable), or
		 * null. Absent: no such button (a page has no playhead).
		 */
		onmoment?: () => Promise<string | null>;
		/**
		 * Whether the spot is a point, when the host knows: the words are right
		 * before the options come. Absent: neutral words until they do.
		 */
		point?: boolean;
	}

	let {
		spotId,
		theme,
		steps,
		onpush,
		onback,
		onclose,
		onchange,
		onopen,
		onmoment,
		point: pointHint
	}: Props = $props();

	const CREATE_STEPS: readonly LinkStep[] = ['variation', 'drill', 'position'];
	let options = $state<LinkOptions | null>(null);
	let loadFailed = $state(false);
	let busy = $state(false);
	/** The create step's refusal, and where it shows: under its field, or a banner. */
	let refusal = $state<{ message: string; at: CreateSpot } | null>(null);
	/** The links level's refusal (an unlink). */
	let unlinkMessage = $state<string | null>(null);
	/** A linked target whose × asked: also on the lesson by hand. */
	let asking = $state<LinkedTarget | null>(null);

	// The picker's opening: how many + it has linked, its refusal, and the
	// options its groups were built from (fixed while it is open, rule 5).
	let added = $state(0);
	let pickMessage = $state<string | null>(null);
	/** A picked target someone archived since the picker opened: Restore or Pick another. */
	let archivedPick = $state<{ row: PickRow; keep: boolean; restorable: boolean } | null>(null);
	let restoring = $state(false);
	let pickBase = $state.raw<LinkOptions | null>(null);
	/** Counts openings, so an answer that lands after a close is not counted in the next one. */
	let opening = 0;
	/** Rows whose link is on its way: a spinner in place of their +, and no second +. */
	const inFlight = new SvelteSet<string>();

	// Create steps' fields, kept while the popup is open so back and forth keeps them.
	let groupId = $state<number | null>(null);
	let variationName = $state('');
	/** New figure's move when it is a new one (the Move field's create): made with the figure. */
	let newMove = $state<string | null>(null);
	/** A new figure's Danced and Style: its move's first figure's, refilled when another move is picked. */
	let variationPartner = $state<Partner>('partner');
	let variationStyle = $state('');
	$effect(() => {
		const id = groupId;
		untrack(() => {
			const c = options?.figureChoices.find((f) => f.groupId === id);
			if (!c || !options) return;
			variationPartner = c.partner;
			variationStyle = c.style ?? options.defaults.style;
		});
	});
	// A new move has no first figure: its figure starts on the person's defaults.
	$effect(() => {
		if (!newMove) return;
		untrack(() => {
			if (!options) return;
			variationPartner = options.defaults.partner;
			variationStyle = options.defaults.style;
		});
	});
	let drillName = $state('');
	let positionName = $state('');
	/** The new position's type; null: none. Starts on the user's style. */
	let positionStyle = $state<string | null>(null);

	/** "Use this moment as a point" in flight, and its refusal. */
	let momentBusy = $state(false);
	let momentMessage = $state<string | null>(null);

	onMount(() => {
		fetchLinkOptions(spotId).then(
			(o) => {
				options = o;
				// A new move's figure starts on the person's defaults; a picked move refills them.
				variationPartner = o.defaults.partner;
				variationStyle = o.defaults.style;
				positionStyle = o.defaults.style;
				groupId = o.figureChoices.find((f) => f.near)?.groupId ?? null;
			},
			() => (loadFailed = true)
		);
	});

	const top = $derived(steps.at(-1));
	const picking = $derived(steps.includes('pick'));
	const createStep = $derived(steps.find((s): s is CreateStep => CREATE_STEPS.includes(s)) ?? null);
	const heading = $derived(options ? linkHeading(options.spot) : null);
	/**
	 * A point links positions only. Until the options come: the host's word for
	 * it, else not known (null), and the words stay neutral.
	 */
	const point = $derived<boolean | null>(
		options ? options.spot.endMs === null : (pointHint ?? null)
	);
	const words = $derived(linkWords(point));
	const titles = $derived(linkTitles(heading, point));
	const failedWords = $derived(loadFailedWords(point));
	/** Only once the options say it is a section: a point never offers it. */
	const momentWhere = $derived(
		options ? momentAt(steps, point === true, onmoment !== undefined) : null
	);

	// Every opening of the picker starts clean, and fences off late answers.
	let wasPicking = false;
	$effect(() => {
		const now = picking;
		if (now !== wasPicking) {
			wasPicking = now;
			opening += 1;
			added = 0;
			pickMessage = null;
			archivedPick = null;
		}
		if (!now) pickBase = null;
		else if (!untrack(() => pickBase) && options) pickBase = options;
	});

	// Picking a figure answers "Pick a figure."
	$effect(() => {
		void groupId;
		void newMove;
		untrack(() => {
			if (refusal?.at === 'groupId' || refusal?.at === 'figureName') refusal = null;
		});
	});

	// A create step's refusal goes when the step changes; the typed fields stay.
	let refusedStep: CreateStep | null = null;
	$effect(() => {
		const now = createStep;
		if (now !== refusedStep) {
			refusedStep = now;
			refusal = null;
		}
	});

	/** A linked row's page: the variation's figure page, the drill's exercise page, or the position's. */
	const targetHref = (dance: string, t: LinkTarget) =>
		'figureId' in t
			? resolve('/[dance]/(moves)/figures/[id]', { dance, id: String(t.figureId) })
			: 'exerciseId' in t
				? resolve('/[dance]/(today)/exercises/[id]', { dance, id: String(t.exerciseId) })
				: // A position's page, /[dance]/positions/[id] (built beside this, ruling 10).
					`${resolve('/[dance]/(moves)/positions', { dance })}/${t.positionId}`;

	const rowTarget = (r: PickRow): LinkTarget =>
		r.key.startsWith('figure:')
			? { figureId: r.value }
			: r.key.startsWith('position:')
				? { positionId: r.value }
				: { exerciseId: r.value };

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
						title: t().links.create.moves,
						entries: figureRows(options.figureChoices.filter((c) => !c.near).map(asTarget))
					}
				]
			: []
	);

	function changed(o: LinkOptions) {
		options = o;
		onchange?.(o.linked.map((l) => l.label));
	}

	/** One change at a time; a refusal goes to `refuse`. */
	async function run(
		call: () => Promise<LinkOptions>,
		refuse: (m: string, field?: string) => void,
		after?: () => void
	) {
		if (busy) return;
		busy = true;
		try {
			changed(await call());
			after?.();
		} catch (e) {
			// A refusal (4xx) says why; a server failure has nothing to say to the user.
			if (e instanceof SpotsApiError && e.status < 500) refuse(e.message, e.field);
			else refuse(t().links.popup.saveFailed);
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
		archivedPick = null;
		try {
			// A late answer still lands: the link was made, the list shows it.
			changed(await addLink(spotId, rowTarget(row)));
			if (at !== opening) return;
			if (keep) added += 1;
			else if (top === 'pick') onclose();
		} catch (e) {
			if (at === opening) {
				pickMessage = linkRefusal(
					e instanceof SpotsApiError && e.status < 500 ? e.message : undefined,
					row
				);
				// "Archived by Ana": Restore (and link) or Pick another.
				archivedPick =
					e instanceof SpotsApiError && e.archived
						? { row, keep, restorable: e.archived.restorable }
						: null;
			}
		} finally {
			inFlight.delete(row.key);
		}
	}

	/** Restore what was archived since, then make the link that was refused. */
	async function restoreAndLink() {
		const a = archivedPick;
		const target = a ? rowTarget(a.row) : null;
		if (!a || !target || restoring) return;
		restoring = true;
		const refused = await restoreArchived(target);
		restoring = false;
		archivedPick = null;
		if (refused) {
			pickMessage = refused;
			return;
		}
		await link(a.row, a.keep);
	}

	const archivedChoice = $derived(
		archivedPick
			? {
					restoring,
					onrestore: archivedPick.restorable ? restoreAndLink : undefined,
					onpickanother: () => {
						archivedPick = null;
						pickMessage = null;
					}
				}
			: null
	);

	/** The picker's create row: the step opens on top of it, the search text in its name. */
	function startCreate(key: string, typed: string) {
		if (!CREATE_STEPS.includes(key as LinkStep)) return;
		refusal = null;
		if (typed) {
			if (key === 'variation') variationName = typed;
			if (key === 'drill') drillName = typed;
			if (key === 'position') positionName = typed;
		}
		onpush(key as CreateStep);
	}

	/** Once a link is gone: focus goes to the next link's ×, else the opener. */
	function afterUnlink(l: LinkedTarget) {
		const keys = (options?.linked ?? []).map((x) => `linked-${linkRowId(x)}`);
		return () => void focusAfterRemoval(keys, `linked-${linkRowId(l)}`, 'linked-add');
	}

	/** "Use this moment as a point": the host saves it and reopens the popup on it. */
	async function useMoment() {
		if (!onmoment || momentBusy) return;
		momentBusy = true;
		momentMessage = null;
		try {
			momentMessage = await onmoment();
		} catch {
			momentMessage = t().video.toast.pointFailed;
		} finally {
			momentBusy = false;
		}
	}

	function unlink(l: LinkedTarget) {
		unlinkMessage = null;
		if (l.alsoByHand) {
			asking = l;
			// In the player the question is a level of its own, so Back closes only it.
			if (theme === 'dark') onpush('unlink');
			return;
		}
		void run(
			() => removeLink(spotId, l.linkId, false, unlinkKind(l.target)),
			(m) => (unlinkMessage = m),
			afterUnlink(l)
		);
	}

	/** Cancel, an answer, or the layer's own close: the question goes, and with it its level. */
	function closeQuestion() {
		asking = null;
		if (theme === 'dark' && top === 'unlink') onback();
	}

	// Back (or Escape) took the question's level away: the question goes with it.
	$effect(() => {
		if (theme === 'dark' && top !== 'unlink' && untrack(() => asking)) asking = null;
	});

	/** The question's answer: from this section only, or from the lesson too. */
	function answer(alsoLesson: boolean) {
		const l = asking;
		if (!l) return;
		unlinkMessage = null;
		const focus = afterUnlink(l);
		void run(
			() => removeLink(spotId, l.linkId, alsoLesson, unlinkKind(l.target)),
			(m) => {
				closeQuestion();
				unlinkMessage = m;
			},
			() => {
				closeQuestion();
				focus();
			}
		);
	}

	function create(e: SubmitEvent) {
		e.preventDefault();
		const step = createStep;
		if (busy || !step) return;
		let body: LinkCreate;
		if (step === 'variation' && newMove) {
			body = {
				kind: 'figure',
				figureName: newMove,
				name: variationName,
				partner: variationPartner,
				style: variationStyle
			};
		} else if (step === 'variation') {
			if (groupId === null) {
				refusal = { message: t().links.create.pickMove, at: 'groupId' };
				return;
			}
			body = {
				kind: 'variation',
				groupId,
				name: variationName,
				partner: variationPartner,
				style: variationStyle
			};
		} else if (step === 'position') {
			body = { kind: 'position', name: positionName, styleTag: positionStyle };
		} else {
			body = { kind: 'drill', name: drillName };
		}
		refusal = null;
		void run(
			() => createLink(spotId, body),
			(m, field) => (refusal = { message: m, at: refusalAt(step, field) }),
			onclose
		);
	}

	/** The refusal, if it belongs under this field. */
	const errorAt = (at: CreateSpot) => (refusal?.at === at ? refusal.message : null);

	/** The Figure field's picker is a level of its own, so Back closes it first. */
	function setFigurePicking(v: boolean) {
		if (v && top !== 'variation-figure') onpush('variation-figure');
		else if (!v && top === 'variation-figure') onback();
	}

	const uid = $props.id();
	const formId = `${uid}-create`;
	const partnerItems = $derived(PARTNER.map((p) => ({ value: p, label: t().moves.chips[p] })));
</script>

{#snippet links()}
	<div class="flex flex-col gap-2">
		{#if unlinkMessage}<Banner kind="error" title={unlinkMessage} />{/if}
		{#if momentMessage && momentWhere === 'links'}<Banner kind="error" title={momentMessage} />{/if}
		{#if loadFailed}
			<Banner kind="error" title={failedWords.title}>{failedWords.body}</Banner>
		{:else if !options}
			<h3 class={SECTION_LABEL}>{t().links.popup.linked}</h3>
			<div class="rounded-2xl bg-surface" aria-busy="true">
				<span role="status" class="sr-only">{t().picker.loading}</span>
				{#each [58, 44, 66] as w, i (i)}
					<div class="pl-4" aria-hidden="true">
						<div class="flex min-h-14 items-center pr-4 {i < 2 ? 'border-b border-hairline' : ''}">
							<div class="h-3 rounded-md bg-skeleton" style:width="{w}%"></div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			{#if options.linked.length > 0}
				<h3 class={SECTION_LABEL}>{t().links.popup.linked}</h3>
				<ul class="rounded-2xl bg-surface">
					{#each options.linked as l, i (linkRowId(l))}
						{@const href = targetHref(options.dance, l.target)}
						<li class="pl-4">
							<div
								class="flex min-h-14 items-center gap-2 pr-1.5 {i < options.linked.length - 1
									? 'border-b border-hairline'
									: ''}"
							>
								<!-- eslint-disable svelte/no-navigation-without-resolve -- targetHref resolves; a position's page is joined to /[dance]/positions until its route lands -->
								<a
									{href}
									class="flex min-h-14 min-w-0 flex-1 items-center gap-2 self-stretch py-2 text-[16px] leading-[1.3] font-bold {l.archived
										? 'text-muted'
										: 'text-ink'}"
									onclick={(e) => {
										if (!onopen) return;
										e.preventDefault();
										onopen(href);
									}}
									><span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"
										><span class="min-w-0 break-words">{l.label}</span>{#if l.drill}<Badge
												tone="neutral">{t().links.popup.drill}</Badge
											>{:else if 'positionId' in l.target}<Badge tone="accent"
												>{t().links.popup.position}</Badge
											>{/if}{#if l.archived}<Badge tone="warn">{t().links.popup.archived}</Badge
											>{/if}</span
									><span class="flex flex-none text-chevron" aria-hidden="true"
										><Icon name="chevron-right" size={20} /></span
									></a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
								<button
									data-focus="linked-{linkRowId(l)}"
									type="button"
									class={iconButton('bare', 'muted')}
									aria-label={t().links.popup.unlinkOf(l.label)}
									disabled={busy}
									onclick={() => unlink(l)}><Icon name="close" /></button
								>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="px-1 text-[14px] text-muted">{t().links.popup.none}</p>
			{/if}
			<div class="mt-1">
				<PickerOpener data-focus="linked-add" label={words.opener} onclick={() => onpush('pick')} />
			</div>
			{#if momentWhere === 'links'}{@render momentButton()}{/if}
		{/if}
	</div>
{/snippet}

{#snippet momentButton()}
	<button
		type="button"
		class={button('tertiary', 'md', true)}
		aria-busy={momentBusy ? 'true' : undefined}
		aria-disabled={momentBusy ? 'true' : undefined}
		onclick={useMoment}
		>{#if momentBusy}<Spinner size={20} />{:else}<Icon
				name="bookmark"
				size={20}
			/>{/if}{momentLabel()}</button
	>
{/snippet}

{#snippet pickTop()}
	{#if momentMessage}<Banner kind="error" title={momentMessage} />{/if}
	{@render momentButton()}
{/snippet}

{#snippet fieldError(at: CreateSpot)}
	{@const m = errorAt(at)}
	{#if m}<FieldError id="{uid}-{at}-error" message={m} />{/if}
{/snippet}

{#snippet createForm(step: CreateStep, o: LinkOptions)}
	<!-- A fetch form, not use:guarded: the popup keeps what was typed until it closes. -->
	<form id={formId} novalidate onsubmit={create} class="flex flex-col gap-3.5">
		{#if refusal?.at === 'banner'}<Banner kind="error" title={refusal.message} />{/if}
		{#if step === 'variation'}
			<PickerField
				name="groupId"
				label={t().links.create.move}
				placeholder={t().links.create.chooseMove}
				title={t().links.create.chooseMoveTitle}
				search={t().links.create.searchMoves}
				groups={figureGroups}
				nothingLeft={t().links.create.noMoves}
				bind:value={groupId}
				bind:newName={newMove}
				create={{
					label: t().picker.moveField.label,
					tag: t().picker.moveField.tag,
					name: 'figureName'
				}}
				bind:open={() => top === 'variation-figure', setFigurePicking}
				required
				error={errorAt('groupId') ?? errorAt('figureName')}
				{theme}
			/>
			<div>
				<label for="{uid}-name" class={LABEL}>{t().links.create.figureName}</label>
				<input
					id="{uid}-name"
					bind:value={variationName}
					required
					maxlength="200"
					class={FIELD}
					aria-invalid={errorAt('name') ? 'true' : undefined}
					aria-describedby={errorAt('name') ? `${uid}-name-error` : undefined}
				/>
				{@render fieldError('name')}
			</div>
			<div>
				<span class={LABEL}>{t().figure.fields.danced}</span>
				<Segmented
					name="{formId}-variation-partner"
					label={t().figure.fields.danced}
					items={partnerItems}
					value={variationPartner}
					onchange={(v) => (variationPartner = v as Partner)}
				/>
			</div>
			<div>
				<span class={LABEL}>{t().figure.fields.style}</span>
				<Segmented
					name="{formId}-variation-style"
					label={t().figure.fields.style}
					items={DANCES[o.dance].styles.map((s) => ({
						value: s,
						label: styleLabelsOf(DANCES[o.dance].styleLabel)[s]
					}))}
					bind:value={variationStyle}
				/>
				{@render fieldError('style')}
			</div>
		{:else if step === 'position'}
			<div>
				<label for="{uid}-name" class={LABEL}>{t().links.create.name}</label>
				<input
					id="{uid}-name"
					bind:value={positionName}
					required
					maxlength="200"
					placeholder={t().links.create.positionPlaceholder}
					class={FIELD}
					aria-invalid={errorAt('name') ? 'true' : undefined}
					aria-describedby={errorAt('name') ? `${uid}-name-error` : undefined}
				/>
				{@render fieldError('name')}
			</div>
			<div>
				<span class={LABEL}>{t().links.create.type}</span>
				<!-- A tap on the picked type clears it: a position may have none. -->
				<Segmented
					name="{formId}-styleTag"
					label={t().links.create.type}
					items={DANCES[o.dance].styles.map((s) => ({
						value: s,
						label: styleLabelsOf(DANCES[o.dance].styleLabel)[s]
					}))}
					bind:value={positionStyle}
					clearable
				/>
				{@render fieldError('style')}
			</div>
		{:else}
			<div>
				<label for="{uid}-name" class={LABEL}>{t().links.create.name}</label>
				<input
					id="{uid}-name"
					bind:value={drillName}
					required
					maxlength="200"
					class={FIELD}
					aria-invalid={errorAt('name') ? 'true' : undefined}
					aria-describedby={errorAt('name') ? `${uid}-name-error` : undefined}
				/>
				{@render fieldError('name')}
			</div>
		{/if}
	</form>
{/snippet}

{#snippet createFooter()}
	<!-- In flight it keeps the accent, as the kit's loading button: aria-busy and aria-disabled, and `create` ignores a second press. -->
	<button
		type="submit"
		form={formId}
		class={button('primary', 'md', true)}
		aria-busy={busy ? 'true' : undefined}
		aria-disabled={busy ? 'true' : undefined}
		>{#if busy}<Spinner size={20} />{/if}{t().links.create.submit}</button
	>
{/snippet}

{#snippet questionActions()}
	<button
		type="button"
		class={button('secondary', 'sm', true)}
		disabled={busy}
		onclick={() => answer(false)}>{t().links.popup.onlySection}</button
	>
	<button
		type="button"
		class={button('danger', 'sm', true)}
		disabled={busy}
		onclick={() => answer(true)}>{t().links.popup.sectionAndLesson}</button
	>
	<button
		type="button"
		class={button('tertiary', 'sm', true)}
		disabled={busy}
		onclick={closeQuestion}>{t().common.cancel}</button
	>
{/snippet}

<!-- Bottom first: in the dark theme DOM order stacks the layers, in the light one the top layer does. -->
{#if steps.includes('links')}
	<LinkLevel
		{theme}
		title={titles.links}
		sub={heading?.sub}
		back={stacked(steps, 'links')}
		{onback}
	>
		{@render links()}
	</LinkLevel>
{/if}

<Picker
	level
	open={picking}
	{theme}
	kind="link"
	title={titles.pick}
	sub={heading && !stacked(steps, 'pick') ? heading.sub : undefined}
	back={stacked(steps, 'pick')}
	placeholder={words.placeholder}
	{groups}
	loading={!options && !loadFailed}
	failure={loadFailed ? failedWords : null}
	nothingLeft={t().links.popup.nothingLeft}
	create={options ? words.create : undefined}
	top={momentWhere === 'pick' ? pickTop : undefined}
	{added}
	pending={inFlight}
	message={pickMessage}
	archived={archivedChoice}
	onpick={(row) => link(row, false)}
	onadd={(row) => link(row, true)}
	oncreate={startCreate}
	ondone={onclose}
	onclose={() => {
		// Dark: the layer's Back, ×, backdrop or Escape, which may come while a
		// create step sits on it (focus still in the picker): one level back either way.
		// Light: also reached when the Sheet closes because the level already went.
		if (theme === 'dark' || top === 'pick') onback();
	}}
/>

{#if createStep && options}
	{@const o = options}
	<LinkLevel
		{theme}
		title={t().links.create.titles[createStep]}
		sub={destination(o)}
		back={stacked(steps, createStep)}
		z="z-50"
		footer={createFooter}
		{onback}
	>
		{@render createForm(createStep, o)}
	</LinkLevel>
{/if}

<!-- "Unlink …?" over the links level: Back, Escape and the backdrop are Cancel. -->
{#if theme === 'dark'}
	{#if asking}
		<PlayerLayer
			shape="dialog"
			z="z-50"
			title={t().links.popup.unlinkTitle(asking.label)}
			body={t().links.popup.alsoLesson}
			icon="unlink"
			tone="danger"
			footer={questionActions}
			onclose={closeQuestion}
		/>
	{/if}
{:else}
	<Dialog
		open={asking !== null}
		title={t().links.popup.unlinkTitle(asking?.label ?? '')}
		body={t().links.popup.alsoLesson}
		icon="unlink"
		tone="danger"
		actions={questionActions}
		onclose={() => (asking = null)}
	/>
{/if}
