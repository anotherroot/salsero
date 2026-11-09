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
//   Start (Today's play)                  Začni (what it starts is never named on screen)
//   the day's practice                    vadba (Današnja vadba je končana)
//   Paused (an exercise)                  na premoru
//   Not today                             Ne danes
//   Done (the button, a day's entry)      Opravljeno; an entry is a vnos, never a "set"
//   an 8-count (call every 2)             osmica (napoved na 2 osmici)
//   Practice (the panel, practising)      vadenje (Vadi ob …); the day's practice stays vadba
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
//   a count (a figure's length)           doba ("8 dob"; the spoken count stays štetje)
//   slot (in a routine)                   mesto
//   sync (the device's changes reaching  sinhronizacija
//     the server)
//   break (a routine's)                   prekinitev (a timing break: časovna prekinitev)
//   link                                  povezava
//   owner / editor / member (a group's)   Vodja / Lahko ureja / Lahko bere
//   does not loop (a routine)             se ne sklene
//   Notes (a figure's, a lesson's)        opombe
//   Map (positions)                       Zemljevid
//   Walk (the map, to a routine)          sprehod (Sprehod od tu)
//   Sync (copies)                         Uskladi
//   Keep in step                          Samodejno usklajevanje
//   Drop my copy                          Opusti svojo kopijo
//   Detach                                Odklopi
//   Unlink (a link, on a row)             Odveži (in a sentence or a label: Odstrani povezavo: …)
//   Take (a field, a recording)           Prevzemi
//   Update mine                           Posodobi svojo
//   Make it mine                          Naredi svojo kopijo
//   Versions (the list) / Your version    Kopije / Vaša kopija
//   Twins (the chip)                      Dvojčka
//   the reminder (Android's channel)      Opomnik za vadenje
import type { Catalog } from '../catalog';
import { admin } from './admin';
import { clones } from './clones';
import { comments } from './comments';
import { common } from './common';
import { entry } from './entry';
import { exercise } from './exercise';
import { figure } from './figure';
import { format } from './format';
import { groups } from './groups';
import { lesson } from './lesson';
import { links } from './links';
import { map } from './map';
import { moves } from './moves';
import { nouns } from './nouns';
import { picker } from './picker';
import { player } from './player';
import { positions } from './positions';
import { refusals } from './refusals';
import { routine } from './routine';
import { settings } from './settings';
import { shell } from './shell';
import { songs } from './songs';
import { sync } from './sync';
import { today } from './today';
import { video } from './video';

export const sl: Catalog = {
	common,
	nouns,
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
	groups,
	moves,
	figure,
	routine,
	positions,
	picker,
	links,
	clones,
	refusals,
	map,
	sync
};
