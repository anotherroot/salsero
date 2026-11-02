<script lang="ts">
	let { data, children } = $props();
</script>

<!--
  Per-dance head tags only. The accent itself is NOT set here: the bottom nav
  lives in the ROOT layout (`src/routes/+layout.svelte`), above this one, so an
  accent wrapper here would leave it stuck on the wrong dance's colour while
  the page underneath changed. The root layout already derives the dance it
  needs and sets `data-dance` around all of it.
-->
<svelte:head>
	<!-- The band is the same colour in light and dark. -->
	<meta name="theme-color" content={data.dance.band} />
	<meta name="apple-mobile-web-app-title" content={data.dance.label} />
	<link rel="manifest" href="/manifest-{data.dance.slug}.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/{data.dance.slug}-192.png" />
</svelte:head>

{@render children()}
