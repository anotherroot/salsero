<script lang="ts">
	import { tick, untrack } from 'svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { button, CHIP, GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import type { ComesBack } from '$lib/schedule/comes-back';
	import {
		GOOD_DAYS,
		postedFields,
		RHYTHMS,
		learningNote,
		rhythmWords,
		teacherLine
	} from '$lib/exercises/comes-back-view';

	/**
	 * Comes back: "By how it went" (with "Every day until it feels good"), or "On a
	 * fixed rhythm". It posts hidden `comesBack`, `until`, `good` and `every` (the
	 * fields `readComesBack` reads); the radios and chips carry no form names. An
	 * entry that follows its class drill posts nothing until the person changes
	 * something, so saving the notes never turns the teacher's setting into theirs.
	 */
	interface Props {
		/** What it shows selected: its own, else the class drill's, else the faces. */
		value: ComesBack;
		/** The row's own; null when an entry follows its class drill. */
		own: ComesBack | null;
		/** An entry's class drill's setting. */
		teacher: ComesBack | null;
		/** A group drill's setting: "Comes back, for the class". */
		forClass: boolean;
		/** Good days since the switch ("2 of 3 so far"); null: no count. */
		good: number | null;
		/** The sheet's heading is a plain label; the page's is a section label. */
		sheet?: boolean;
	}
	let { value, own, teacher, forClass, good, sheet = false }: Props = $props();

	const id = $props.id();
	const start = untrack(() => value);
	let mode = $state<'faces' | 'every'>(start.kind === 'every' ? 'every' : 'faces');
	let until = $state(start.kind === 'until');
	let goodDays = $state<3 | 5>(start.kind === 'until' ? start.good : 3);
	let days = $state<1 | 2 | 3 | 7>(start.kind === 'every' ? start.days : 1);
	/** The person changed something (or asked for their teacher's): only then is the setting sent. */
	let touched = $state(false);
	let useTeacher = $state(false);

	const following = $derived(own === null && teacher !== null);
	const posted = $derived(
		Object.entries(
			postedFields({ following, touched, useTeacher, mode, until, good: goodDays, every: days })
		)
	);
	/** Their own and a class drill's both exist: the way back to the teacher's. */
	const canUseTeacher = $derived(own !== null && teacher !== null);

	let box: HTMLElement | undefined = $state();
	async function pickTeacher() {
		useTeacher = true;
		await tick();
		box?.closest('form')?.requestSubmit();
	}
</script>

<section class="flex flex-col gap-2 desk:min-w-0" bind:this={box}>
	<h2 class={sheet ? 'pl-1 text-[13px] font-bold text-ink-2' : SECTION_LABEL}>
		{forClass ? 'Comes back, for the class' : 'Comes back'}
	</h2>
	{#if teacher}
		<p class="px-4 text-[14px] leading-snug text-muted">{teacherLine(teacher)}</p>
	{/if}
	{#each posted as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}
	<div class={GROUP}>
		<div class="flex flex-col gap-3 px-4 py-3.5">
			<label class="flex cursor-pointer items-start gap-3.5">
				<input
					type="radio"
					name="cb-mode-{id}"
					checked={mode === 'faces'}
					class="mt-0.5 size-[22px] flex-none cursor-pointer"
					style="accent-color: var(--color-accent)"
					onchange={() => {
						mode = 'faces';
						touched = true;
					}}
				/>
				<span class="flex min-w-0 flex-col gap-0.5">
					<span class="text-[17px] leading-tight font-extrabold text-ink">By how it went</span>
					<span class="text-[14px] leading-snug text-muted"
						>The faces decide when it comes back.</span
					>
				</span>
			</label>
			{#if mode === 'faces'}
				<div class="flex flex-col gap-2.5 pl-9">
					<div class="flex min-h-[44px] items-center gap-3">
						<span class="flex min-w-0 flex-1 flex-col gap-px">
							<span class="text-[16px] font-extrabold text-ink">Every day until it feels good</span>
							<span class="text-[13px] text-muted">Then the faces take over.</span>
						</span>
						<Switch
							label="Every day until it feels good"
							bind:checked={until}
							onchange={() => (touched = true)}
						/>
					</div>
					{#if until}
						<div class="flex flex-wrap gap-x-2" role="group" aria-label="Good days">
							{#each GOOD_DAYS as g (g)}
								<label class={CHIP}>
									<input
										type="radio"
										class="sr-only"
										name="cb-good-{id}"
										checked={goodDays === g}
										onchange={() => {
											goodDays = g;
											touched = true;
										}}
									/>
									{g} good days
								</label>
							{/each}
						</div>
						<p class="text-[14px] leading-snug text-muted">{learningNote(good, goodDays)}</p>
					{/if}
				</div>
			{/if}
		</div>
		<div class="flex flex-col gap-3 px-4 py-3.5">
			<label class="flex cursor-pointer items-start gap-3.5">
				<input
					type="radio"
					name="cb-mode-{id}"
					checked={mode === 'every'}
					class="mt-0.5 size-[22px] flex-none cursor-pointer"
					style="accent-color: var(--color-accent)"
					onchange={() => {
						mode = 'every';
						touched = true;
					}}
				/>
				<span class="flex min-w-0 flex-col gap-0.5">
					<span class="text-[17px] leading-tight font-extrabold text-ink">On a fixed rhythm</span>
					<span class="text-[14px] leading-snug text-muted">Just Done, no faces.</span>
				</span>
			</label>
			{#if mode === 'every'}
				<div class="flex flex-wrap gap-x-2 pl-9" role="group" aria-label="How often">
					{#each RHYTHMS as r (r)}
						<label class={CHIP}>
							<input
								type="radio"
								class="sr-only"
								name="cb-every-{id}"
								checked={days === r}
								onchange={() => {
									days = r;
									touched = true;
								}}
							/>
							{rhythmWords(r)}
						</label>
					{/each}
				</div>
			{/if}
		</div>
	</div>
	{#if forClass}
		<p class="px-4 text-[14px] leading-snug text-muted">Members can change it for themselves.</p>
	{/if}
	{#if canUseTeacher}
		<div class="flex justify-center pt-1">
			<button type="button" class={button('tertiary', 'md')} onclick={pickTeacher}
				>Use my teacher's</button
			>
		</div>
	{/if}
</section>
