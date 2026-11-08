-- Ids from slots (src/lib/server/db/ids.ts): seed each table's slot-0 mark from
-- AUTOINCREMENT's high-water mark, so an id deleted before now is never reused,
-- then keep the marks with one AFTER INSERT trigger per id table.
INSERT INTO id_marks (tbl, slot, hi) SELECT name, 0, seq FROM sqlite_sequence WHERE seq < 4294967296 AND name IN ('today_picks', 'device_tokens', 'login_attempts', 'figure_groups', 'figures', 'recordings', 'positions', 'spot_position_links', 'routines', 'routine_steps', 'songs', 'exercises', 'sets', 'lessons', 'lesson_videos', 'video_spots', 'spot_links', 'links', 'song_links', 'video_downloads', 'count_takes', 'storage_requests', 'teams', 'lesson_comments', 'team_changes', 'team_trash');
--> statement-breakpoint
CREATE TRIGGER today_picks_id_mark AFTER INSERT ON today_picks BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('today_picks', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'today_picks' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER device_tokens_id_mark AFTER INSERT ON device_tokens BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('device_tokens', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'device_tokens' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER login_attempts_id_mark AFTER INSERT ON login_attempts BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('login_attempts', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'login_attempts' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER figure_groups_id_mark AFTER INSERT ON figure_groups BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('figure_groups', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'figure_groups' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER figures_id_mark AFTER INSERT ON figures BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('figures', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'figures' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER recordings_id_mark AFTER INSERT ON recordings BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('recordings', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'recordings' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER positions_id_mark AFTER INSERT ON positions BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('positions', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'positions' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER spot_position_links_id_mark AFTER INSERT ON spot_position_links BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('spot_position_links', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'spot_position_links' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER routines_id_mark AFTER INSERT ON routines BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('routines', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'routines' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER routine_steps_id_mark AFTER INSERT ON routine_steps BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('routine_steps', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'routine_steps' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER songs_id_mark AFTER INSERT ON songs BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('songs', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'songs' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER exercises_id_mark AFTER INSERT ON exercises BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('exercises', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'exercises' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER sets_id_mark AFTER INSERT ON sets BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('sets', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'sets' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER lessons_id_mark AFTER INSERT ON lessons BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('lessons', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'lessons' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER lesson_videos_id_mark AFTER INSERT ON lesson_videos BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('lesson_videos', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'lesson_videos' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER video_spots_id_mark AFTER INSERT ON video_spots BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('video_spots', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'video_spots' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER spot_links_id_mark AFTER INSERT ON spot_links BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('spot_links', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'spot_links' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER links_id_mark AFTER INSERT ON links BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('links', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'links' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER song_links_id_mark AFTER INSERT ON song_links BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('song_links', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'song_links' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER video_downloads_id_mark AFTER INSERT ON video_downloads BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('video_downloads', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'video_downloads' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER count_takes_id_mark AFTER INSERT ON count_takes BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('count_takes', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'count_takes' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER storage_requests_id_mark AFTER INSERT ON storage_requests BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('storage_requests', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'storage_requests' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER teams_id_mark AFTER INSERT ON teams BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('teams', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'teams' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER lesson_comments_id_mark AFTER INSERT ON lesson_comments BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('lesson_comments', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'lesson_comments' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER team_changes_id_mark AFTER INSERT ON team_changes BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('team_changes', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'team_changes' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER team_trash_id_mark AFTER INSERT ON team_trash BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('team_trash', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'team_trash' AND slot = NEW.id >> 32;
END;
