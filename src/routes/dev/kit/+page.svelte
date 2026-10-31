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
	import Icon from '$lib/components/ui/Icon.svelte';
	import TypeTile from '$lib/components/ui/TypeTile.svelte';
	import {
		button,
		iconButton,
		FIELD,
		TEXTAREA,
		FIELD_ERROR,
		LABEL,
		CHIP,
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
	let sheetOpen = $state(false);
	let sheetBack = $state(false);
	let dialogOpen = $state(false);
	let dangerOpen = $state(false);
	let toast = $state<{ id: number; message: string; action?: string } | null>(null);
	let toastId = 0;
	let sheetToastMsg = $state<{ id: number; message: string; action?: string } | null>(null);

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

	<Toast {toast} onaction={() => (toast = null)} ondismiss={() => (toast = null)} bottom="1rem" />
</div>
