<script lang="ts">
	import CardFrame from '$lib/components/shell/CardFrame.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import NameFields from '$lib/components/system/NameFields.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, LABEL, button } from '$lib/components/ui/styles';
	import { guarded, loadAgreed } from '$lib/unsaved/guard.svelte';
	import { t } from '$lib/i18n/catalog';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
	let timezone = $derived(
		typeof Intl === 'undefined' ? '' : (Intl.DateTimeFormat().resolvedOptions().timeZone ?? '')
	);
	const live = $derived(data.valid && !form?.dead);
	const w = $derived(t().entry);
</script>

<svelte:head><title>{w.join.title}</title></svelte:head>

<div data-dance={data.dance} style:display="contents">
	<CardFrame
		title={w.join.title}
		subtitle={live ? w.join.invited : undefined}
		note={live ? w.join.passwordRule : undefined}
	>
		{#if live}
			<form
				method="POST"
				class="flex flex-col gap-4 rounded-[22px] bg-surface px-4 pt-5 pb-4"
				use:guarded={{
					label: w.join.form,
					submit: ({ cancel }) => {
						if (submitting) return cancel();
						submitting = true;
						return async ({ result, update }) => {
							// Joined: a full load, so the app draws in the new account's
							// language, not the page's (a pre-invite-language link, the cookie).
							if (result.type === 'redirect') return loadAgreed(result.location);
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

				<NameFields
					firstName={form?.firstName ?? ''}
					lastName={form?.lastName ?? ''}
					field={form?.field}
					message={form?.message}
				/>

				<label class="block">
					<span class={LABEL}>{w.email}</span>
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
					<span class={LABEL}>{w.password}</span>
					<input
						name="password"
						type="password"
						autocomplete="new-password"
						required
						minlength="12"
						class={FIELD}
					/>
				</label>

				{#if form?.message && !form.field}
					<Banner kind="error" title={form.message} />
				{/if}

				<button type="submit" class={button('primary', 'lg', true)} aria-busy={submitting}>
					{#if submitting}
						<Spinner size={24} /> {w.join.creating}
					{:else}
						{w.join.create}
					{/if}
				</button>
			</form>
		{:else}
			<div class="rounded-[22px] bg-surface px-4 py-5">
				<Banner kind="error" title={w.join.dead} />
			</div>
		{/if}
	</CardFrame>
</div>
