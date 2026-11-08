import type { Db } from './db';
import { deviceSettings } from './devices';
import { listCountTakes } from './countTakes';
import { dailyCountOf } from './today-picks';
import { levelOf } from './levels';
import { ownVoiceSummary } from '$lib/voice/grid';
import type { YouSettingsData } from '$lib/types';

/**
 * What the You page's settings rows show: the same values Settings reads, for
 * the few rows You carries (How much app?, Exercises a day, My count, the daily
 * reminder). Read by the Groups layout (You above Follow my class) and by
 * `/[dance]/you` (You at Follow my class).
 */
export function youSettingsOf(db: Db, userId: string): YouSettingsData {
	return {
		level: levelOf(db, userId),
		dailyCount: dailyCountOf(db, userId),
		ownVoice: ownVoiceSummary(listCountTakes(db, userId)),
		reminderMinute: deviceSettings(db, userId).reminderMinute
	};
}
