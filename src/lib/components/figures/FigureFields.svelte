<script lang="ts">
	import { PARTNER, PARTNER_LABEL, type Partner } from '$lib/labels';
	// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
	import { DANCES } from '$lib/dances/dances';

	interface Props {
		name?: string;
		partner?: Partner;
		style?: string;
		notes?: string | null;
		callable?: boolean;
		callText?: string | null;
	}

	let {
		name = '',
		partner = 'partner',
		style = 'salsa',
		notes = '',
		callable = true,
		callText = ''
	}: Props = $props();

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
	const chip =
		'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[14px] has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink border-rule bg-raised text-ink-2 has-focus-visible:outline-2 has-focus-visible:outline-accent';
</script>

<label class="block">
	<span class={label}>Name</span>
	<input
		name="name"
		required
		maxlength="200"
		placeholder="e.g. Dile que no, Enchufla"
		value={name}
		class={field}
	/>
</label>

<fieldset>
	<legend class={label}>Danced</legend>
	<div class="flex gap-2">
		{#each PARTNER as p (p)}
			<label class={chip}>
				<input type="radio" name="partner" value={p} checked={partner === p} class="sr-only" />
				{PARTNER_LABEL[p]}
			</label>
		{/each}
	</div>
</fieldset>

<fieldset>
	<legend class={label}>Style</legend>
	<div class="flex gap-2">
		{#each DANCES.salsa.styles as s (s)}
			<label class={chip}>
				<input type="radio" name="style" value={s} checked={style === s} class="sr-only" />
				{DANCES.salsa.styleLabel[s]}
			</label>
		{/each}
	</div>
</fieldset>

<label class="block">
	<span class={label}>Notes</span>
	<textarea
		name="notes"
		rows="3"
		maxlength="2000"
		placeholder="Count, hand holds, what the teacher said…"
		class={field}>{notes ?? ''}</textarea
	>
</label>

<label class="flex items-center gap-3 text-[14px]">
	<input type="checkbox" name="callable" checked={callable} class="size-5" />
	The player may call this figure
</label>

<label class="block">
	<span class={label}>Say it like</span>
	<input
		name="callText"
		maxlength="200"
		placeholder="only if the voice mispronounces the name"
		value={callText ?? ''}
		class={field}
	/>
</label>
