/**
 * Where a drag's auto-scroll zones start and end, in viewport px: the part of
 * the window the list is actually seen in. PURE: the caller passes the rects.
 *
 * Top: below the fixed slim band (a pushed screen's only header on the phone),
 * else below the desktop's band row (`--band-row-h`, 0 on the phone). Bottom:
 * the tab bar's top when it shows, else the window's bottom. On the desktop
 * the slim band and the tab bar are `display: none`, so their rects are all
 * zeros: a rect of height 0 counts as absent, or the zone would be the band
 * row's foot and the window's top, and the list would scroll by itself.
 */
export function dragEdges(
	slim: { top: number; bottom: number; height: number } | null,
	tabBar: { top: number; height: number } | null,
	bandRowPx: number,
	innerHeight: number
): { top: number; bottom: number } {
	return {
		top: slim && slim.height > 0 ? slim.bottom : bandRowPx,
		bottom: tabBar && tabBar.height > 0 ? tabBar.top : innerHeight
	};
}
