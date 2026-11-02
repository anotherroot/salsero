<script lang="ts">
	import Screen from '$lib/components/ui/Screen.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, LABEL, button } from '$lib/components/ui/styles';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
	let timezone = $derived(
		typeof Intl === 'undefined' ? '' : (Intl.DateTimeFormat().resolvedOptions().timeZone ?? '')
	);
	const live = $derived(data.valid && !form?.dead);
</script>

<svelte:head><title>Join</title></svelte:head>

<div data-dance={data.dance} style:display="contents">
	<Screen title="Join" subtitle={live ? 'You were invited' : undefined}>
		{#if live}
			<form
				method="POST"
				class="flex flex-col gap-4 rounded-[22px] bg-surface px-4 pt-5 pb-4"
				use:guarded={{
					label: 'Your account',
					submit: ({ cancel }) => {
						if (submitting) return cancel();
						submitting = true;
						return async ({ update }) => {
							try {
								await update();
							} finally {
								submitting = false;
							}
						};
					}
				}}
			>
				<input type="hidden" name="code" value={data.code} />
				<input type="hidden" name="timezone" value={timezone} />

				<label class="block">
					<span class={LABEL}>Email</span>
					<input
						name="email"
						type="email"
						autocomplete="username"
						required
						value={form?.email ?? ''}
						class={FIELD}
					/>
				</label>

				<label class="block">
					<span class={LABEL}>Password</span>
					<input
						name="password"
						type="password"
						autocomplete="new-password"
						required
						minlength="12"
						class={FIELD}
					/>
				</label>

				{#if form?.message}
					<Banner kind="error" title={form.message} />
				{/if}

				<button type="submit" class={button('primary', 'lg', true)} aria-busy={submitting}>
					{#if submitting}
						<Spinner size={24} /> Creating…
					{:else}
						Create account
					{/if}
				</button>
			</form>

			<p class="mt-1.5 text-center text-[13px] text-muted">
				At least 12 characters, mixing three of lower, upper, digit and symbol.
			</p>
		{:else}
			<div class="rounded-[22px] bg-surface px-4 py-5">
				<Banner kind="error" title="This invite no longer works. Ask for a new one." />
			</div>
		{/if}
	</Screen>
</div>
