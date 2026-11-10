/**
 * Copy and link as the routes run it (the lesson page's `copyLink`, the Link
 * popup's `/api/video-spots/[id]/copy-link`): with the real files, the disk's
 * room and the server's clock. A `restore` asks Restore and link.
 */
import type { Db } from './db';
import type { TeamSpace } from './scope';
import { realCloneFiles } from './clones/files';
import { freeDisk } from './storage';
import { serverNow } from './server-clock';
import {
	copyAndLink,
	restoreAndLink,
	type CopyLinkRequest,
	type CopyLinkResult,
	type Linker
} from './link-elsewhere';

export async function runCopyLink(
	db: Db,
	group: TeamSpace,
	req: CopyLinkRequest,
	link: Linker
): Promise<CopyLinkResult> {
	const { kind, id, use, restore } = req;
	if (restore !== null)
		return restoreAndLink(db, group.actorId, kind, id, group, restore, use, link, serverNow());
	return copyAndLink(
		db,
		group.actorId,
		kind,
		id,
		group,
		use,
		link,
		realCloneFiles(),
		serverNow(),
		await freeDisk()
	);
}
