/*
 * The shell (offline phase 2): the page the service worker caches at install
 * and serves for any page load the network cannot answer. No SSR, so its HTML
 * holds no page and no data: SvelteKit's client starts at `location.href` (the
 * path that was asked for) and reads that page's data, which the device
 * answers. Public (`PUBLIC_PATHS`) and past the name gate (`names.ts`), so it
 * caches signed out, with no redirect.
 */
export const ssr = false;
export const prerender = false;
