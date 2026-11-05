<script lang="ts">
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import HeroCard from '$lib/components/ui/HeroCard.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import ReloadBar from '$lib/components/shell/ReloadBar.svelte';
	import { onMount } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import TypeTile from '$lib/components/ui/TypeTile.svelte';
	import Stepper from '$lib/components/ui/Stepper.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Face from '$lib/components/exercises/Face.svelte';
	import FaceRating from '$lib/components/exercises/FaceRating.svelte';
	import { FEELS, type Feel } from '$lib/schedule/feel';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import PickerMultiField from '$lib/components/picker/PickerMultiField.svelte';
	import type { PickGroup, PickRow } from '$lib/picker/model';
	import type { LinkRow, LinkedSection } from '$lib/types';
	import {
		button,
		iconButton,
		FIELD,
		TEXTAREA,
		FIELD_ERROR,
		LABEL,
		CHIP,
		CLIP,
		GROUP,
		ROW,
		SECTION_LABEL,
		SELECT,
		type ButtonKind,
		type ButtonSize,
		type IconButtonVariant
	} from '$lib/components/ui/styles';
	import { ICONS, FILLED, type IconName } from '$lib/icons/icons';

	let dance = $state('salsa');
	let seg = $state('a');
	let segBand = $state('b');
	let chip = $state('one');
	let on = $state(true);
	let bannerShown = $state(true);
	let sheetOpen = $state(false);
	let sheetBack = $state(false);
	let dialogOpen = $state(false);
	let dangerOpen = $state(false);
	let toast = $state<{ id: number; message: string; action?: string } | null>(null);
	let toastId = 0;
	let sheetToastMsg = $state<{ id: number; message: string; action?: string } | null>(null);
	let tallOpen = $state(false);
	let tallToast = $state<{ id: number; message: string; action?: string } | null>(null);
	let kitFeel = $state<Feel | null>(null);
	let bpm = $state(180);
	let bpmMin = $state(60);
	let vol = $state(0.8);
	let showBar = $state(false);
	let showReload = $state(false);
	// `?bars` opens the pinned bars and a toast, for the desktop screenshot check.
	onMount(() => {
		if (!location.search.includes('bars')) return;
		showBar = true;
		showReload = true;
		toast = { id: ++toastId, message: 'Slot 4 deleted', action: 'Undo' };
	});

	const kitSection = (label: string | null): LinkedSection => ({
		linkId: 1,
		spot: { id: 1, startMs: 20000, endMs: 44000, label, linkedTo: [] },
		video: {
			owner: { lessonVideoId: 1 },
			src: '/lesson-videos/none.mp4',
			from: { kind: 'lesson', lessonId: 1, title: 'Thursday class', lessonDay: '2026-10-22' }
		}
	});
	const kitLinks: LinkRow[] = [
		{
			id: 1,
			url: 'https://youtu.be/9bZkp7q19f0?t=75',
			title: 'Son clave vs rumba clave',
			createdAt: 0,
			saving: null
		},
		{
			id: 2,
			url: 'https://salsaclave.com/patterns',
			title: 'Clave patterns explained',
			createdAt: 0,
			saving: null
		},
		{ id: 3, url: 'https://example.org/notes', title: null, createdAt: 0, saving: null }
	];

	let manyValues = $state<number[]>([]);
	let manyMade = $state(0);
	let manyGroups = $state<PickGroup[]>([
		{
			title: 'Positions',
			entries: [
				{ key: 'position:1', value: 1, label: 'Open break', meta: 'open · facing' },
				{ key: 'position:2', value: 2, label: 'Cross-body lead', meta: 'closed' },
				{ key: 'position:3', value: 3, label: 'Hammerlock', meta: 'crossed' }
			]
		}
	]);
	// Every second create is refused, to see the button re-enable and the banner.
	async function kitCreate(query: string): Promise<PickRow | { message: string } | null> {
		await new Promise((r) => setTimeout(r, 800));
		if (++manyMade % 2 === 0)
			return { message: `You already have a position called ${query || 'Caída'}.` };
		const row: PickRow = {
			key: `position:${10 + manyMade}`,
			value: 10 + manyMade,
			label: query || `New position ${manyMade}`
		};
		manyGroups[0].entries.push(row);
		return row;
	}

	const tileTones = ['accent', 'quiet', 'done'] as const;
	const tileExercises = [
		{ label: 'partner', exercise: { source: 'figure', partner: 'partner' } },
		{ label: 'solo', exercise: { source: 'figure', partner: 'solo' } },
		{ label: 'routine', exercise: { source: 'routine', partner: null } },
		{ label: 'lesson', exercise: { source: 'lesson', partner: null } },
		{ label: 'drill', exercise: { source: 'custom', partner: null } }
	] as const;
	const kinds: ButtonKind[] = ['primary', 'secondary', 'tertiary', 'danger', 'danger-text'];
	const sizes: ButtonSize[] = ['sm', 'md', 'lg'];
	const variants: IconButtonVariant[] = ['bare', 'tonal', 'filled', 'step'];
	const names = Object.keys(ICONS).sort() as IconName[];
	const tones = ['neutral', 'accent', 'status', 'danger', 'warn', 'done'] as const;
	const bannerKinds = ['info', 'warning', 'error', 'success'] as const;

	function showToast(action: boolean) {
		toast = { id: ++toastId, message: 'Slot 4 deleted', action: action ? 'Undo' : undefined };
	}
</script>

<svelte:head><title>Kit gallery</title></svelte:head>

<div data-dance={dance} style:display="contents">
	<Screen title="Cañón con vuelta · Doble" subtitle="Montaña · Caída">
		{#snippet left()}<BandButton icon="back" label="Back" />{/snippet}
		{#snippet right()}<BandButton icon="plus" label="Add" />{/snippet}
		{#snippet extra()}
			<Segmented
				onBand
				label="Dance"
				name="kit-dance"
				bind:value={dance}
				items={[
					{ value: 'salsa', label: 'Salsa' },
					{ value: 'bachata', label: 'Bachata' }
				]}
			/>
		{/snippet}
		{#snippet hero()}
			<HeroCard title="Caída · Montaña" meta="3 due" />
		{/snippet}

		<div class="flex flex-col gap-8 px-4 pb-24">
			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Hero card</h2>
				<HeroCard title="Start session" meta="3 due · 4 not yet due" />
				<HeroCard title="Start session" meta="No active exercises · 3 inactive" state="disabled" />
				<HeroCard title="All done for today" meta="5 exercises · 7 sets" state="done" />
				<HeroCard title="As a link" href="/dev/kit" />
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Group mode</h2>
				<!-- Static: the real band reads page.data.groupMode (Screen), the tab bar too (BottomNav). -->
				<div data-dance={dance} data-group class="flex flex-col gap-3">
					<div class="relative flex flex-col gap-1.5 rounded-2xl bg-band px-5 pt-6 pb-6">
						<div
							aria-hidden="true"
							class="absolute inset-x-0 top-0 h-[6px] rounded-t-2xl"
							style="background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-band-ink) 35%, transparent) 0 6px, transparent 6px 12px)"
						></div>
						<div class="flex items-center gap-1.5 text-band-small">
							<Icon name="people" size={16} /><span class="text-[13px] font-bold"
								>Tuesday class · group</span
							>
						</div>
						<div class="flex items-center justify-between">
							<span class="font-display text-[30px] leading-[1.1] font-extrabold text-band-ink"
								>Moves</span
							>
							<div class="flex items-center">
								<BandButton icon="people" label="Switch group" />
								<BandButton icon="plus" label="Add" />
							</div>
						</div>
					</div>
					<div
						class="grid grid-cols-[2fr_1fr_2fr] items-center gap-1 rounded-2xl bg-tab-bg px-2 py-2"
					>
						<span class="flex h-11 items-center justify-center gap-2 px-3 text-accent-text"
							><Icon name="back" size={28} /><span class="text-[14px] font-extrabold">Mine</span
							></span
						>
						<span class="flex h-11 items-center justify-center text-muted"
							><Icon name="moves" size={28} /></span
						>
						<span
							class="flex h-11 items-center justify-center gap-2 rounded-full bg-accent/12 px-3 text-accent-text"
							><Icon name="lessons" size={28} filled /><span class="text-[14px] font-extrabold"
								>Lessons</span
							></span
						>
					</div>
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Type tiles</h2>
				{#each tileTones as tone (tone)}
					<div class="flex items-center gap-3">
						<span class="w-14 text-[13px] font-bold text-muted">{tone}</span>
						{#each tileExercises as ex (ex.label)}
							<TypeTile exercise={ex.exercise} {tone} />
						{/each}
					</div>
				{/each}
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Buttons</h2>
				{#each kinds as kind (kind)}
					<div class="flex flex-wrap items-center gap-2">
						{#each sizes as size (size)}
							<button type="button" class={button(kind, size)}>{kind} {size}</button>
						{/each}
						<button type="button" class={button(kind)} disabled>Disabled</button>
						<button type="button" class={button(kind)} aria-busy="true"><Spinner /></button>
						<button type="button" class={button(kind)}>
							<Icon name="plus" size={20} /> With icon
						</button>
					</div>
				{/each}
				<button type="button" class={button('primary', 'md', true)}>Full width</button>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Icon buttons</h2>
				<div class="flex flex-wrap gap-3">
					{#each variants as v (v)}
						<button type="button" class={iconButton(v)} aria-label={v}><Icon name="plus" /></button>
						<button type="button" class={iconButton(v)} aria-label="{v} disabled" disabled
							><Icon name="plus" /></button
						>
					{/each}
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Fields</h2>
				<div>
					<label class={LABEL} for="k1">Name</label>
					<input id="k1" class={FIELD} placeholder="Placeholder" />
				</div>
				<div>
					<label class={LABEL} for="k2">Filled</label>
					<input id="k2" class={FIELD} value="Dile que no" />
				</div>
				<div>
					<label class={LABEL} for="k3">Error</label>
					<input id="k3" class={FIELD} value="Bad" aria-invalid="true" />
					<p class={FIELD_ERROR}><Icon name="warning" size={16} filled /> Name is taken</p>
				</div>
				<div>
					<label class={LABEL} for="k4">Disabled</label>
					<input id="k4" class={FIELD} value="Locked" disabled />
				</div>
				<div>
					<label class={LABEL} for="k6">Select</label>
					<button type="button" id="k6" class={SELECT}>
						<span class="min-w-0 flex-1 truncate font-medium text-muted">Choose a figure</span>
						<span class="flex text-muted"><Icon name="chevron-down" size={20} /></span>
					</button>
				</div>
				<div>
					<label class={LABEL} for="k5">Notes</label>
					<textarea id="k5" class={TEXTAREA} rows="3" placeholder="A longer note"></textarea>
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Many-value field</h2>
				<PickerMultiField
					name="kit-many"
					label="Starts in"
					title="Starts in"
					sub="Pick any number"
					placeholder="Search positions"
					empty="No position · fits anywhere"
					groups={manyGroups}
					clear={{ label: 'No position', meta: 'Fits anywhere · the default' }}
					bind:values={manyValues}
					create={{ label: 'Position', key: 'position' }}
					oncreate={kitCreate}
					nothingLeft="There are no positions yet."
				/>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Chips</h2>
				<div class="flex flex-wrap gap-1">
					{#each ['one', 'two', 'three'] as c (c)}
						<label class={CHIP}>
							<input type="radio" class="sr-only" name="kit-chip" value={c} bind:group={chip} />
							{c}
						</label>
					{/each}
					<label class={CHIP}>
						<input type="radio" class="sr-only" name="kit-chip" value="x" disabled />
						disabled
					</label>
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Segmented</h2>
				<Segmented
					label="Range"
					name="kit-seg"
					bind:value={seg}
					items={[
						{ value: 'a', label: 'Day' },
						{ value: 'b', label: 'Week' },
						{ value: 'c', label: 'Month' }
					]}
				/>
				<div class="rounded-2xl bg-band p-3">
					<Segmented
						onBand
						label="Count"
						name="kit-seg-band"
						bind:value={segBand}
						items={[
							{ value: 'a', label: 'One' },
							{ value: 'b', label: 'Two' }
						]}
					/>
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Switch</h2>
				<div class="flex items-center gap-3">
					<Switch label="On or off" bind:checked={on} />
					<Switch label="Off" checked={false} />
					<Switch label="Disabled on" checked disabled />
					<Switch label="Disabled off" checked={false} disabled />
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Banners</h2>
				{#each bannerKinds as k (k)}
					<Banner kind={k} title="{k} title">A line of detail for the {k} banner.</Banner>
				{/each}
				<Banner kind="warning" title="With action">
					Something needs a look.
					{#snippet action()}<button type="button" class={button('tertiary', 'sm')}>Fix</button
						>{/snippet}
				</Banner>
				<Banner kind="info">No title, just a line.</Banner>
				{#if bannerShown}
					<Banner
						kind="error"
						title="Those slots could not be put back."
						ondismiss={() => (bannerShown = false)}
					/>
				{:else}
					<button
						type="button"
						class={button('tertiary', 'sm')}
						onclick={() => (bannerShown = true)}>Show the dismissed banner</button
					>
				{/if}
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Badges</h2>
				<div class="flex flex-wrap gap-2">
					{#each tones as t (t)}<Badge tone={t}>{t}</Badge>{/each}
				</div>
				<div class="flex flex-wrap gap-2">
					{#each tones as t (t)}<Badge tone={t} solid>{t}</Badge>{/each}
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Group and rows</h2>
				<div class={GROUP}>
					<div class={ROW}>
						<Icon name="music" /> <span class="flex-1 font-semibold">First row</span>
						<Badge tone="accent">New</Badge>
					</div>
					<div class={ROW}>
						<Icon name="lessons" /> <span class="flex-1 font-semibold">Second row</span>
						<Icon name="chevron-right" />
					</div>
					<div class={ROW}>
						<span class="flex-1 font-semibold">Third row</span><Switch label="Row switch" />
					</div>
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Empty state and spinner</h2>
				<EmptyState icon="music" title="No songs yet" body="Add a song to practise to the beat.">
					{#snippet action()}<button type="button" class={button('primary', 'sm')}>Add song</button
						>{/snippet}
				</EmptyState>
				<EmptyState icon="calendar" title="Nothing here" />
				<div class="flex items-center gap-4 text-accent-text">
					<Spinner />
					<Spinner size={32} />
					<Spinner label="Loading" />
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Video frame, sections, links</h2>
				<div class="{CLIP} rounded-2xl bg-surface">
					<VideoFrame
						src="/recordings/none.mp4"
						owner={{ recordingId: 1 }}
						caption={{ title: 'Recording · 22 Oct', meta: '12.4 MB' }}
						onproblem={() => {}}
					/>
				</div>
				<div class="{CLIP} rounded-2xl bg-surface">
					<VideoFrame
						src="/recordings/none.mp4"
						owner={{ recordingId: 1 }}
						sourceUrl="https://youtu.be/9bZkp7q19f0"
						onproblem={() => {}}
					/>
				</div>
				<SectionCard section={kitSection('Clave on its own')} />
				<SectionCard section={kitSection(null)}>
					{#snippet unlink()}
						<button
							type="button"
							class={iconButton('bare', 'muted')}
							aria-label="Unlink this section"><Icon name="close" size={20} /></button
						>
					{/snippet}
				</SectionCard>
				<LinkList links={kitLinks} />
				<LinkList links={kitLinks}>
					{#snippet actions(link, kind)}
						{#if kind === 'youtube'}
							<span class="flex-1"></span>
							<button type="button" class={button('danger-text', 'sm')}
								><Icon name="trash" size={18} />Remove</button
							>
						{:else}
							<button
								type="button"
								class={iconButton('bare', 'muted')}
								aria-label="Remove {link.title ?? 'link'}"><Icon name="trash" size={20} /></button
							>
						{/if}
					{/snippet}
				</LinkList>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Stepper, slider, stars, bottom bar</h2>
				<div class="flex flex-col gap-3 rounded-2xl bg-surface p-4">
					<Stepper bind:value={bpm} min={60} max={240} label="Tempo" unit="BPM" />
					<Stepper bind:value={bpmMin} min={60} max={240} label="At min" unit="BPM" />
					<Slider bind:value={vol} label="Volume" />
				</div>
				<div class="flex flex-col gap-1 text-ink">
					{#each FEELS as f (f)}<Face feel={f} label />{/each}
				</div>
				<FaceRating
					question="How did it go?"
					value={kitFeel}
					onchange={(f) => (kitFeel = f)}
					preview={[
						{ feel: 'hard', gap: 1 },
						{ feel: 'getting', gap: 3 },
						{ feel: 'gotit', gap: 21 },
						{ feel: 'easy', gap: 70 }
					]}
					early="Done early: you last did it yesterday, it was due on Saturday 14 Nov."
				/>
				<div>
					<button
						type="button"
						class={button('secondary', 'sm')}
						onclick={() => (showBar = !showBar)}>Bottom bar</button
					>
					<button
						type="button"
						class={button('secondary', 'sm')}
						onclick={() => (showReload = !showReload)}>Reload bar</button
					>
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Sheet, dialog, toast</h2>
				<div class="flex flex-wrap gap-2">
					<button type="button" class={button('secondary', 'sm')} onclick={() => (sheetOpen = true)}
						>Sheet</button
					>
					<button
						type="button"
						class={button('secondary', 'sm')}
						onclick={() => ((sheetBack = true), (sheetOpen = true))}>Sheet with back</button
					>
					<button type="button" class={button('secondary', 'sm')} onclick={() => (tallOpen = true)}
						>Tall sheet</button
					>
					<button
						type="button"
						class={button('secondary', 'sm')}
						onclick={() => (dialogOpen = true)}>Dialog</button
					>
					<button
						type="button"
						class={button('secondary', 'sm')}
						onclick={() => (dangerOpen = true)}>Danger dialog</button
					>
					<button type="button" class={button('secondary', 'sm')} onclick={() => showToast(true)}
						>Toast with Undo</button
					>
					<button type="button" class={button('secondary', 'sm')} onclick={() => showToast(false)}
						>Toast</button
					>
				</div>
			</section>

			<section class="flex flex-col gap-3">
				<h2 class={SECTION_LABEL}>Icons ({names.length})</h2>
				<div class="grid grid-cols-4 gap-2 text-ink">
					{#each names as n (n)}
						<div class="flex flex-col items-center gap-1 rounded-xl bg-surface p-2">
							<div class="flex items-center gap-2">
								<Icon name={n} />
								{#if FILLED[n]}<Icon name={n} filled />{/if}
							</div>
							<span class="text-[11px] text-muted">{n}</span>
						</div>
					{/each}
				</div>
			</section>
		</div>
	</Screen>

	{#snippet sheetToast()}
		<Toast
			contained
			bottom="0"
			toast={sheetToastMsg}
			onaction={() => (sheetToastMsg = null)}
			ondismiss={() => (sheetToastMsg = null)}
		/>
	{/snippet}

	<Sheet
		title="A sheet"
		sub="With a muted line under the title"
		open={sheetOpen}
		onclose={() => ((sheetOpen = false), (sheetBack = false), (sheetToastMsg = null))}
		back={sheetBack}
		toast={sheetToast}
	>
		<div class="flex flex-col gap-3 p-4">
			<label class={LABEL} for="ks">Inside</label>
			<input id="ks" class={FIELD} placeholder="A field in a sheet" />
			<p class="text-ink-2">Some body text in the sheet.</p>
			<button
				type="button"
				class={button('secondary', 'sm')}
				onclick={() =>
					(sheetToastMsg = { id: ++toastId, message: 'Slot 4 deleted', action: 'Undo' })}
				>Delete (toast with Undo)</button
			>
		</div>
		{#snippet footer()}
			<button
				type="button"
				class={button('primary', 'md', true)}
				onclick={() => (sheetOpen = false)}>Save</button
			>
		{/snippet}
	</Sheet>

	{#snippet tallToastSnippet()}
		<Toast
			contained
			bottom="0"
			toast={tallToast}
			onaction={() => (tallToast = null)}
			ondismiss={() => (tallToast = null)}
		/>
	{/snippet}

	<Sheet
		title="Shines"
		tall
		open={tallOpen}
		onclose={() => ((tallOpen = false), (tallToast = null))}
		toast={tallToastSnippet}
	>
		{#snippet subtitle()}
			<span class="flex items-center gap-1.5 text-[14px] text-muted"
				>Last time: 3 days ago · <Face feel="gotit" size={16} label /></span
			>
		{/snippet}
		{#snippet actions()}
			<button
				type="button"
				class="flex h-11 items-center px-2 text-[15px] font-extrabold text-accent-text"
				>Details ›</button
			>
		{/snippet}
		<p class="text-ink-2">A short body.</p>
		{#snippet footer()}
			<button
				type="button"
				class={button('secondary', 'sm', true)}
				onclick={() => (tallToast = { id: ++toastId, message: 'Set deleted', action: 'Undo' })}
				>Show toast</button
			>
			<button type="button" class={button('primary', 'md', true)} onclick={() => (tallOpen = false)}
				>Log set</button
			>
		{/snippet}
	</Sheet>

	<Dialog
		open={dialogOpen}
		icon="info"
		title="Keep going?"
		body="A short question in a dialog."
		onclose={() => (dialogOpen = false)}
	>
		{#snippet actions()}
			<button
				type="button"
				class={button('primary', 'md', true)}
				onclick={() => (dialogOpen = false)}>Yes</button
			>
			<button
				type="button"
				class={button('tertiary', 'sm', true)}
				onclick={() => (dialogOpen = false)}>Cancel</button
			>
		{/snippet}
	</Dialog>

	<Dialog
		open={dangerOpen}
		tone="danger"
		icon="trash"
		title="Delete this?"
		body="It cannot be undone."
		onclose={() => (dangerOpen = false)}
	>
		{#snippet actions()}
			<button
				type="button"
				class={button('danger', 'md', true)}
				onclick={() => (dangerOpen = false)}>Delete</button
			>
			<button
				type="button"
				class={button('tertiary', 'sm', true)}
				onclick={() => (dangerOpen = false)}>Cancel</button
			>
		{/snippet}
	</Dialog>

	{#if showReload}<ReloadBar />{/if}

	{#if showBar}<BottomBar
			><button type="button" class={button('primary', 'md', true)}>Log set</button></BottomBar
		>{/if}

	<Toast
		{toast}
		onaction={() => (toast = null)}
		ondismiss={() => (toast = null)}
		bottom={showBar || showReload ? '5rem' : '1rem'}
	/>
</div>
