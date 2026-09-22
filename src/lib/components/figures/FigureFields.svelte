<script lang="ts">
	import {
		PARTNER,
		PARTNER_LABEL,
		STYLES,
		STYLE_LABEL,
		type Partner,
		type Style
	} from '$lib/labels';

	interface Props {
		name?: string;
		partner?: Partner;
		style?: Style;
		notes?: string | null;
	}

	let { name = '', partner = 'partner', style = 'salsa', notes = '' }: Props = $props();

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
		{#each STYLES as s (s)}
			<label class={chip}>
				<input type="radio" name="style" value={s} checked={style === s} class="sr-only" />
				{STYLE_LABEL[s]}
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
