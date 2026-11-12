import { putLoopFile } from '../../put';
import type { RequestHandler } from './$types';

/** The loop's strip: 12 frames side by side. */
export const PUT: RequestHandler = ({ params, request }) =>
	putLoopFile(params.id, request, 'strip');
