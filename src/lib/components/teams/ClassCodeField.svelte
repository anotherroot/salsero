<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, FIELD_INVALID, LABEL, button } from '$lib/components/ui/styles';
	import { JOIN_STEP } from '$lib/levels/first-run';

	/**
	 * The class code field (first run, Groups beside New group, My class when
	 * there is no class): type the code, Join. `action` is the explicit URL of
	 * the action that joins (field `code`); a refusal comes back in the result
	 * and shows under the field, so it works from a list column as well as from
	 * a page. `error` is a refusal the page already holds.
	 */
	let { action, error }: { action: string; error?: string } = $props();

	const id = $props.id();
	let busy = $state(false);
	let refused = $state<string | null>(null);
	const message = $derived(refused ?? error);
</script>

<form
	method="POST"
	{action}
	novalidate
	class="flex flex-col gap-3"
	use:guarded={{
		label: JOIN_STEP.label,
		submit: ({ cancel }) => {
			// One join per tap.
			if (busy) return cancel();
			busy = true;
			refused = null;
			return async ({ result, update }) => {
				try {
					if (result.type === 'failure') {
						refused = String(result.data?.message ?? '');
					} else await update();
				} finally {
					busy = false;
				}
			};
		}
	}}
>
	<label class="block">
		<span class={LABEL}>{JOIN_STEP.label}</span>
		<input
			name="code"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			class={message ? FIELD_INVALID : FIELD}
			aria-invalid={message ? 'true' : undefined}
			aria-describedby={message ? `${id}-error` : undefined}
			oninput={() => (refused = null)}
		/>
		{#if message}<FieldError id="{id}-error" {message} />{/if}
	</label>
	<button type="submit" class={button('primary', 'lg', true)} aria-busy={busy}>
		{#if busy}<Spinner size={24} /> Joining…{:else}{JOIN_STEP.join}{/if}
	</button>
</form>
