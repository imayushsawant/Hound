-- Align columns with exact spec:
-- Rename manual_next_action to next_action_override on applications
ALTER TABLE applications RENAME COLUMN manual_next_action TO next_action_override;

-- Rename columns on rounds: custom_name -> title, date -> scheduled_date, prep_notes -> prep_notes_md, interview_notes -> interview_notes_md, technical_topics / topics_asked
ALTER TABLE rounds RENAME COLUMN custom_name TO title;
ALTER TABLE rounds RENAME COLUMN date TO scheduled_date;
ALTER TABLE rounds RENAME COLUMN prep_notes TO prep_notes_md;
ALTER TABLE rounds RENAME COLUMN interview_notes TO interview_notes_md;
ALTER TABLE rounds ADD COLUMN topics_asked TEXT;

-- Rename check_frequency_days to check_every_days on boards
ALTER TABLE boards RENAME COLUMN check_frequency_days TO check_every_days;

-- Trigger to update applications.updated_at when application is updated directly
-- WHEN OLD.updated_at IS NEW.updated_at prevents infinite trigger recursion
CREATE TRIGGER applications_update_timestamp
AFTER UPDATE ON applications
FOR EACH ROW
WHEN OLD.updated_at IS NEW.updated_at
BEGIN
  UPDATE applications
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;

-- Trigger to update applications.updated_at when a round is inserted
CREATE TRIGGER rounds_insert_update_app_timestamp
AFTER INSERT ON rounds
FOR EACH ROW
BEGIN
  UPDATE applications
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.application_id;
END;

-- Trigger to update applications.updated_at when a round is updated
CREATE TRIGGER rounds_update_update_app_timestamp
AFTER UPDATE ON rounds
FOR EACH ROW
BEGIN
  UPDATE applications
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.application_id;
END;

-- Trigger to update applications.updated_at when a round is deleted
CREATE TRIGGER rounds_delete_update_app_timestamp
AFTER DELETE ON rounds
FOR EACH ROW
BEGIN
  UPDATE applications
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = OLD.application_id;
END;
