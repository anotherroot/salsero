// The Slovenian catalog, typed against the English one: a missing key fails svelte-check.
//
// Register: vikanje in sentences ("Vnesite kodo", "Ste prepričani?"), short
// imperatives on buttons ("Shrani", "Prekliči"). Plurals through `slCount`.
// Decimal comma. A person's name goes after a colon or a "·", never inside a
// phrase that declines it or a past tense that agrees with it.
//
// Glossary (spec 2026-11-07, "The language"). Use exactly these words; a change
// to one is made here first.
//
//   English (app)                         Slovenian
//   ------------------------------------  ------------------------------------
//   Today                                 Danes
//   Moves (tab)                           Figure
//   a move                                figura
//   a figure (a version of a move)        različica
//   Routine                               kombinacija
//   Drill, exercise                       vaja
//   Lesson                                lekcija
//   Group                                 skupina
//   class (Follow my class, My class)     tečaj
//   Music                                 Glasba
//   Song                                  skladba
//   Position                              položaj
//   Hold                                  drža
//   Section (of a video)                  odsek
//   Section (of a song: Intro, Mambo …)   del (Uvod, Kitica, Coro, Montuno, Mambo, Break, Zaključek)
//   Count off (a song's section)          brez štetja
//   Point (a saved moment)                točka
//   Recording                             posnetek
//   Set (a logged practice)               vnos
//   Practise                              vadi
//   Count, My count                       štetje, moje štetje
//   Copy, twins                           kopija, dvojčka
//   Levels: Follow my class               Sledim svojemu tečaju
//           Practise and keep my own      Vadim in imam svoje
//           Everything                    Vse
//   version (of the app)                  različica aplikacije (always with the noun:
//                                         a bare "različica" is a figure)
//   Session (Start session)               vadba (Začni vadbo)
//   Paused (an exercise)                  na premoru
//   Not today                             Ne danes
//   Log a set / a set's minutes, reps      Nov vnos, Shrani vnos / minute, ponovitve
//   an 8-count (call every 2)             osmica (napoved na 2 osmici)
//   Practice (the panel, practising)      vadenje (Vadi ob …); a session stays vadba
//   Class (a lesson's day, "Class · …")   lekcija (Lekcija · tor, 3. nov.); the group is tečaj
//   Teacher (a comment's tag)             vodja tečaja (right beside a woman's or a man's name)
//   a heart (on a comment)                srček
//   Draft (a group's lesson)              osnutek
//   Mark point / Start section (player)   Označi točko / Začni odsek
//   Loop, Looping (a section)             Ponavljaj, Se ponavlja
//   Mirror, Mirrored (the picture)        Zrcali, Zrcaljeno
//   You (the tab: settings, and groups)   Jaz
//   Full video / Lesson video             Cel video / Video lekcije (the default title: Videoposnetek)
//   a take (My count), a bar (of counts)  posnetek, takt (Takt 2 od 4)
//   Storage (Settings), the admin         prostor, skrbnik (the admin's section: Skrbništvo)
//   Paired phones                         Povezani telefoni (lines as nouns: "Povezava: …")
import type { Catalog } from '../catalog';
import { admin } from './admin';
import { comments } from './comments';
import { common } from './common';
import { entry } from './entry';
import { exercise } from './exercise';
import { format } from './format';
import { groups } from './groups';
import { lesson } from './lesson';
import { player } from './player';
import { settings } from './settings';
import { shell } from './shell';
import { songs } from './songs';
import { today } from './today';
import { video } from './video';

export const sl: Catalog = {
	common,
	format,
	shell,
	admin,
	settings,
	entry,
	today,
	exercise,
	songs,
	lesson,
	comments,
	video,
	player,
	groups
};
