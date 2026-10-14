<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { clockLabel } from '$lib/clock';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { VIDEO_SHORT_SIDES } from '$lib/video-sizes';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let busy = $state(false);

	const label = 'mb-1 block text-[13px] text-muted';
	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
</script>

<svelte:head><title>Settings · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 pb-3 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
>
	<h1 class="text-[17px] font-semibold">Settings</h1>
</header>

<main class="space-y-6 px-4 pt-4 pb-4">
	<section>
		<a
			href={resolve('/voice')}
			class="flex items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3"
		>
			<span class="flex-1">
				<span class="block text-[15px] font-medium text-ink">My count</span>
				<span class="block text-[13px] text-muted">
					Record yourself counting, for the player to use instead of the built-in voice
				</span>
			</span>
			<span class="text-[20px] text-muted" aria-hidden="true">›</span>
		</a>
	</section>

	<section class="space-y-3">
		<div>
			<h2 class="text-[15px] font-medium text-ink">Android app</h2>
			<p class="text-[13px] text-muted">Used by the phone app, not by this page.</p>
		</div>
		<form
			method="POST"
			action="?/app"
			class="space-y-3"
			use:guarded={{
				label: 'App settings',
				submit: () => {
					busy = true;
					return async ({ update }) => {
						await update({ reset: false });
						busy = false;
					};
				}
			}}
		>
			{#if form && 'message' in form && form.message}
				<p class="bg-danger-bg rounded-lg px-3 py-2 text-[13px] text-danger">{form.message}</p>
			{/if}
			<label class="block">
				<span class={label}>Daily reminder (empty = off)</span>
				<input
					type="time"
					name="reminder"
					class={field}
					value={clockLabel(data.device.reminderMinute)}
				/>
			</label>
			<label class="block">
				<span class={label}>Compress videos to</span>
				<select name="shortSide" class={field} value={data.device.shortSide}>
					{#each VIDEO_SHORT_SIDES as side (side)}
						<option value={side}>{side}p</option>
					{/each}
				</select>
			</label>
			<button
				disabled={busy}
				class="h-11 w-full rounded-lg bg-accent text-[15px] font-medium text-white disabled:opacity-60"
			>
				Save
			</button>
		</form>

		{#if data.devices.length > 0}
			<ul class="space-y-2">
				{#each data.devices as device (device.id)}
					<li class="flex items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3">
						<span class="flex-1">
							<span class="block text-[15px] text-ink">{device.label}</span>
							<span class="block text-[12px] text-muted">
								Paired {device.paired}{device.lastUsed ? ` · last used ${device.lastUsed}` : ''}
							</span>
						</span>
						<form method="POST" action="?/removeDevice" use:enhance>
							<input type="hidden" name="id" value={device.id} />
							<button class="text-[13px] text-danger">Remove</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="space-y-2">
		{#if data.user}
			<p class="text-[13px] text-muted">Signed in as {data.user.email}</p>
		{/if}
		<!--
			A POST, not a link: /logout has always been a POST so that a prefetch or
			a crawled link cannot sign you out from under you.
		-->
		<form method="POST" action="/logout">
			<button class="h-11 w-full rounded-lg border border-rule text-[15px] text-ink">
				Sign out
			</button>
		</form>
	</section>
</main>
