/**
 * What the Android app compresses a video to: the output's short side, in
 * pixels. A user setting, read by the app from `/api/device/config`; the
 * server itself never re-encodes anything.
 */
export const VIDEO_SHORT_SIDES = [480, 720, 1080] as const;
export type VideoShortSide = (typeof VIDEO_SHORT_SIDES)[number];
export const DEFAULT_VIDEO_SHORT_SIDE: VideoShortSide = 480;

export function isVideoShortSide(n: unknown): n is VideoShortSide {
	return VIDEO_SHORT_SIDES.includes(n as VideoShortSide);
}
