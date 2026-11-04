/**
 * The files a clone brings: each one hard-linked under a new name of ours
 * (`linkCopy`), so a purge or a delete on one side unlinks that side's name
 * only and the other side's copy stays playable. Injected into `cloneInto`, so
 * specs never touch `$DATA_DIR`: they pass a fake, or `cloneFilesIn` on a
 * temporary folder.
 */
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
	AUDIO_FILE_RE,
	audioDir,
	LESSON_VIDEO_FILE_RE,
	lessonVideosDir,
	linkCopy,
	RECORDING_FILE_RE,
	recordingsDir
} from '../files';

export type CloneFileKind = 'recording' | 'lesson-video' | 'audio';

export type CloneFiles = {
	/** The file under a new name in its kind's folder; returns the new name. */
	link(kind: CloneFileKind, file: string): Promise<string>;
	/** Remove a name `link` made (a clone that did not land). Never throws. */
	unlink(kind: CloneFileKind, file: string): Promise<void>;
};

const PATTERN: Record<CloneFileKind, RegExp> = {
	recording: RECORDING_FILE_RE,
	'lesson-video': LESSON_VIDEO_FILE_RE,
	audio: AUDIO_FILE_RE
};

/** `CloneFiles` over these folders, one per kind. */
export function cloneFilesIn(dirs: Record<CloneFileKind, string>): CloneFiles {
	return {
		link: (kind, file) => linkCopy(dirs[kind], file, PATTERN[kind]),
		async unlink(kind, file) {
			// Only our own names, in our own folder: never a path from elsewhere.
			if (!PATTERN[kind].test(file)) return;
			await unlink(join(dirs[kind], file)).catch(() => {});
		}
	};
}

/**
 * The real folders under `$DATA_DIR`, as the routes use them. Read on each
 * call, not here: making one touches nothing, so a route spec whose leaver
 * has no files never reaches `$DATA_DIR` (the folder helpers create it).
 */
export function realCloneFiles(): CloneFiles {
	const real = () =>
		cloneFilesIn({
			recording: recordingsDir(),
			'lesson-video': lessonVideosDir(),
			audio: audioDir()
		});
	return {
		link: (kind, file) => real().link(kind, file),
		unlink: (kind, file) => real().unlink(kind, file)
	};
}

/**
 * The same `CloneFiles`, except that a source already gone from disk gets a
 * fresh name with nothing behind it instead of a throw: the copy is no more
 * broken than the group's row was, and one lost file must not stop a person
 * leaving, or a deleted group's purge. Keep uses it (leaving, removal, the
 * purge, settling former members); a copy someone asks for still refuses.
 */
export function missingOk(files: CloneFiles): CloneFiles {
	return {
		async link(kind, file) {
			try {
				return await files.link(kind, file);
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
				return `${randomUUID()}${file.slice(file.lastIndexOf('.'))}`;
			}
		},
		unlink: (kind, file) => files.unlink(kind, file)
	};
}
