/**
 * PURE, client-safe: how a pasted playlist shows in Music (To pick, Being
 * added) and its source line ("Spotify playlist · 32 songs").
 */
import { t } from '$lib/i18n/catalog';
import type { SongImportKind } from '$lib/labels';
import type { SongImportRow } from '$lib/types';

export function sourceLine(kind: SongImportKind, count: number, truncated: boolean): string {
	const w = t().songs.imports;
	return [w.kinds[kind], w.songs(count), truncated ? w.firstN(count) : null]
		.filter(Boolean)
		.join(' · ');
}

export function importRowView(row: SongImportRow): {
	title: string;
	meta: string;
	tone: 'danger' | null;
	action: 'pick' | 'cancel' | 'retry-dismiss';
} {
	const w = t().songs.imports;
	if (row.status === 'reading')
		return {
			title: w.reading,
			meta: w.readingMeta(row.kind.startsWith('spotify') ? 'Spotify' : 'YouTube'),
			tone: null,
			action: 'cancel'
		};
	const title = row.name ?? w.kinds[row.kind];
	if (row.status === 'failed')
		return { title, meta: w.failed(row.error ?? ''), tone: 'danger', action: 'retry-dismiss' };
	return {
		title,
		meta: [sourceLine(row.kind, row.count, row.truncated), row.group?.name]
			.filter(Boolean)
			.join(' · '),
		tone: null,
		action: 'pick'
	};
}

/** Read lists wait under To pick; reading and failed ones sit in Being added. */
export function importSections(rows: SongImportRow[]): {
	toPick: SongImportRow[];
	adding: SongImportRow[];
} {
	return {
		toPick: rows.filter((r) => r.status === 'ready'),
		adding: rows.filter((r) => r.status !== 'ready')
	};
}
