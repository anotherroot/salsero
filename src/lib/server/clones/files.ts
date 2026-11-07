/**
 * The files a clone brings: each one hard-linked under a new name of ours
 * (`linkCopy`), so a purge or a delete on one side unlinks that side's name
 * only and the other side's copy stays playable. Injected into `cloneInto`, so
 * specs never touch `$DATA_DIR`: they pass a fake, or `cloneFilesIn` on a
 * temporary folder.
 */
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
	AUDIO_FILE_RE,
	audioDir,
	countDir,
	LESSON_VIDEO_FILE_RE,
	lessonVideosDir,
	linkCopy,
	RECORDING_FILE_RE,
	recordingsDir
} from '../files';

export type CloneFileKind = 'recording' | 'lesson-video' | 'audio' | 'count';

export type CloneFiles = {
	/** The file under a new name in its kind's folder; returns the new name. */
	link(kind: CloneFileKind, file: string): Promise<string>;
	/** Remove a name `link` made (a clone that did not land). Never throws. */
	unlink(kind: CloneFileKind, file: string): Promise<void>;
};

const PATTERN: Record<CloneFileKind, RegExp> = {
	recording: RECORDING_FILE_RE,
	'lesson-video': LESSON_VIDEO_FILE_RE,
	audio: AUDIO_FILE_RE,
	// A count take is `<uuid>.wav`, the same shape.
	count: RECORDING_FILE_RE
};

/** The folders per kind. `count` only where count takes are copied (the dance split). */
export type CloneDirs = Omit<Record<CloneFileKind, string>, 'count'> & { count?: string };

/** `CloneFiles` over these folders, one per kind. */
export function cloneFilesIn(dirs: CloneDirs): CloneFiles {
	const dirOf = (kind: CloneFileKind): string => {
		const dir = dirs[kind];
		if (!dir) throw new Error(`no folder for ${kind} files`);
		return dir;
	};
	return {
		link: (kind, file) => linkCopy(dirOf(kind), file, PATTERN[kind]),
		async unlink(kind, file) {
			// Only our own names, in our own folder: never a path from elsewhere.
			if (!PATTERN[kind].test(file)) return;
			await unlink(join(dirOf(kind), file)).catch(() => {});
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
			audio: audioDir(),
			count: countDir()
		});
	return {
		link: (kind, file) => real().link(kind, file),
		unlink: (kind, file) => real().unlink(kind, file)
	};
}
