// The English catalog: the source every other language is typed against.
// One area per file; later areas are added beside `common`.
import { admin } from './admin';
import { common } from './common';
import { format } from './format';
import { settings } from './settings';
import { shell } from './shell';

export const en = { common, format, shell, admin, settings };
