<script lang="ts">
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { clock } from '$lib/format';

	interface Props {
		/** The exercise the run was opened from, or null when opened from a song with none. */
		exercise: { id: number; name: string } | null;
		exercises: { id: number; name: string }[];
		durationS: number;
		calledCount: number;
		/** `JSON.stringify({ speed, count, clave, callEvery, called })`. */
		run: string;
		/** A failure from the last save attempt, with what was entered. */
		fail: {
			message: string;
			exerciseId: number | null;
			rating: number | null;
			note: string;
		} | null;
		/** "Don't save": leaves without logging anything. */
		onclose: () => void;
	}

	let { exercise, exercises, durationS, calledCount, run, fail, onclose }: Props = $props();

	let rating = $state<number | null>(fail?.rating ?? null);
	let busy = $state(false);

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
</script>

<Sheet title="Save this run" open={true} {onclose}>
	<p class="mb-4 text-[13px] text-muted">
		{clock(durationS)} · {calledCount} figure{calledCount === 1 ? '' : 's'} called
	</p>

	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<input type="hidden" name="durationS" value={Math.round(durationS)} />
		<input type="hidden" name="run" value={run} />

		{#if exercise}
			<input type="hidden" name="exerciseId" value={exercise.id} />
			<p class="text-[15px] font-medium">{exercise.name}</p>
		{:else}
			<label class="block">
				<span class={label}>Exercise</span>
				<select name="exerciseId" required class={field} value={fail?.exerciseId ?? ''}>
					<option value="" disabled>Choose an exercise</option>
					{#each exercises as e (e.id)}
						<option value={e.id}>{e.name}</option>
					{/each}
				</select>
			</label>
		{/if}

		<fieldset class="mt-3">
			<legend class={label}>How did it go?</legend>
			<input type="hidden" name="rating" value={rating ?? ''} />
			<div class="flex gap-2">
				{#each [1, 2, 3, 4, 5] as n (n)}
					<button
						type="button"
						aria-pressed={rating === n}
						onclick={() => (rating = rating === n ? null : n)}
						class="h-11 flex-1 rounded-lg border text-[15px] {rating !== null && n <= rating
							? 'border-accent bg-accent text-accent-ink'
							: 'border-rule bg-raised text-ink-2'}">{n}</button
					>
				{/each}
			</div>
		</fieldset>

		<label class="mt-3 block">
			<span class={label}>Note</span>
			<textarea name="note" rows="2" maxlength="2000" class={field}>{fail?.note ?? ''}</textarea>
		</label>

		{#if fail}
			<p class="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{fail.message}
			</p>
		{/if}

		<div class="mt-4 flex gap-2">
			<button
				type="button"
				onclick={onclose}
				class="h-12 flex-1 rounded-xl border border-rule text-[15px] font-medium text-ink-2"
			>
				Don't save
			</button>
			<button
				type="submit"
				disabled={busy}
				class="h-12 flex-[2] rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-60"
			>
				Save
			</button>
		</div>
	</form>
</Sheet>
