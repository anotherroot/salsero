/**
 * Whether a person set a song's count (`anchors_json` holds at least one 1).
 * PURE. Only such a song may grade a hearing round: Beat This!'s guess alone
 * never marks anyone wrong (spec 2026-11-10, "Anti-goals").
 */
export function counted(song: { anchorsJson: string | null }): boolean {
	try {
		const anchors: unknown = JSON.parse(song.anchorsJson || '[]');
		return Array.isArray(anchors) && anchors.length > 0;
	} catch {
		return false;
	}
}
