import { putLoopFile } from '../../put';
import type { RequestHandler } from './$types';

/** The loop's clip: the section as a tiny muted H.264 video. */
export const PUT: RequestHandler = ({ params, request }) => putLoopFile(params.id, request, 'clip');
