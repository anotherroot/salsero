<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
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
