<script lang="ts">
	let { data, children } = $props();
</script>

<!--
  Per-dance head tags only. The accent itself is NOT set here: the bottom nav
  and the dance switcher live in the ROOT layout (`src/routes/+layout.svelte`),
  above this one, so an accent wrapper here would leave both of them stuck on
  salsa's colour while the page underneath went teal. The root layout already
  derives the dance it needs and sets `data-dance` around all of it.
-->
<svelte:head>
	<meta name="theme-color" content={data.dance.accent} />
	<meta name="apple-mobile-web-app-title" content={data.dance.label} />
	<link rel="manifest" href="/manifest-{data.dance.slug}.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/{data.dance.slug}-192.png" />
</svelte:head>

{@render children()}
