<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in · Salsa</title></svelte:head>

<main class="grid h-dvh place-items-center overflow-y-auto px-5 py-12">
	<div class="w-full max-w-sm">
		<div class="mb-8">
			<h1 class="text-[17px] font-semibold tracking-tight">Salsa</h1>
			<p class="mt-1 text-[13px] text-muted">Sign in to continue.</p>
		</div>

		<form
			method="POST"
			class="rounded-xl border border-line bg-surface p-5"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<input type="hidden" name="next" value={data.next} />

			<label class="mb-4 block">
				<span class="mb-1.5 block text-[12px] font-medium text-ink-2">Email</span>
				<input
					name="email"
					type="email"
					autocomplete="username"
					required
					value={form?.email ?? ''}
					class="w-full rounded-lg border border-rule bg-raised px-3 py-2 text-[14px] outline-none focus:border-accent"
				/>
			</label>

			<label class="mb-5 block">
				<span class="mb-1.5 block text-[12px] font-medium text-ink-2">Password</span>
				<input
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class="w-full rounded-lg border border-rule bg-raised px-3 py-2 text-[14px] outline-none focus:border-accent"
				/>
			</label>

			{#if form?.message}
				<p
					class="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger"
					role="alert"
				>
					{form.message}
				</p>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-lg bg-accent py-2 text-[14px] font-medium text-accent-ink disabled:opacity-60"
			>
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>

		<p class="mt-4 text-center text-[12px] text-muted">Registration is closed.</p>
	</div>
</main>
