/** Additive migration. Run only against a backed-up, explicitly approved environment. */
exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE admins ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE wallpapers ALTER COLUMN content_type SET DEFAULT 'wallpaper';
    ALTER TABLE daily_verses DROP CONSTRAINT daily_verses_verse_id_fkey;
    ALTER TABLE daily_verses ADD CONSTRAINT daily_verses_verse_id_fkey
      FOREIGN KEY (verse_id) REFERENCES scripture_verses(id) ON DELETE RESTRICT;
    CREATE TABLE content_audit (
      id bigserial PRIMARY KEY, actor_id uuid, entity_type text NOT NULL, entity_id text NOT NULL,
      action text NOT NULL, before_data jsonb, after_data jsonb,
      occurred_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX content_audit_entity ON content_audit(entity_type, entity_id, id);
    CREATE FUNCTION hub_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE prior jsonb; next_row jsonb; action_name text;
    BEGIN
      IF TG_OP <> 'INSERT' THEN prior := to_jsonb(OLD); END IF;
      IF TG_OP <> 'DELETE' THEN next_row := to_jsonb(NEW); END IF;
      IF prior IS NOT DISTINCT FROM next_row THEN RETURN NEW; END IF;
      action_name := CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'edited' END;
      IF TG_OP = 'UPDATE' AND prior->>'publication_state' IS DISTINCT FROM next_row->>'publication_state' THEN
        action_name := CASE next_row->>'publication_state' WHEN 'review' THEN 'reviewed'
          WHEN 'published' THEN 'published' WHEN 'archived' THEN 'archived' ELSE 'unpublished' END;
      END IF;
      INSERT INTO content_audit(actor_id, entity_type, entity_id, action, before_data, after_data)
      VALUES (nullif(current_setting('hub.actor_id', true), '')::uuid, TG_TABLE_NAME,
        coalesce(next_row->>'id', prior->>'id'), action_name, prior, next_row);
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$;
    CREATE FUNCTION hub_publication() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF NEW.publication_state IS DISTINCT FROM OLD.publication_state THEN
          IF NEW.publication_state = 'published' AND OLD.publication_state <> 'review' THEN
            RAISE EXCEPTION 'Review content before publishing';
          END IF;
        ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
          IF NEW.is_active AND OLD.publication_state <> 'review' THEN
            RAISE EXCEPTION 'Review content before publishing';
          END IF;
          NEW.publication_state := CASE WHEN NEW.is_active THEN 'published' ELSE 'draft' END;
        ELSIF OLD.publication_state = 'review' AND
          (to_jsonb(NEW) - ARRAY['updated_at','revision','reviewer_notes']) IS DISTINCT FROM
          (to_jsonb(OLD) - ARRAY['updated_at','revision','reviewer_notes']) THEN
          NEW.publication_state := 'draft';
        END IF;
        NEW.revision := OLD.revision + 1;
      END IF;
      NEW.is_active := NEW.publication_state = 'published';
      RETURN NEW;
    END $$;
  `);
  for (const table of ['wallpapers', 'books', 'dated_events', 'scriptures', 'daily_verses']) {
    pgm.sql(`
      ALTER TABLE ${table}
        ADD COLUMN publication_state text NOT NULL DEFAULT 'draft' CHECK (publication_state IN ('draft','review','published','archived')),
        ADD COLUMN revision integer NOT NULL DEFAULT 1,
        ADD COLUMN source_name text,
        ADD COLUMN source_url text,
        ADD COLUMN translator text,
        ADD COLUMN edition text,
        ADD COLUMN provenance text,
        ADD COLUMN rights_status text NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown','licensed','public_domain','original')),
        ADD COLUMN reviewer_notes text;
      UPDATE ${table} SET publication_state = CASE WHEN is_active THEN 'published' ELSE 'archived' END;
      ALTER TABLE ${table} ALTER COLUMN is_active SET DEFAULT false;
      CREATE TRIGGER publication BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION hub_publication();
    `);
  }
  for (const table of ['wallpapers', 'categories', 'books', 'book_pages', 'dated_events', 'scriptures', 'scripture_verses', 'daily_verses']) {
    pgm.sql(`CREATE TRIGGER content_audit AFTER INSERT OR UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION hub_audit();`);
  }
  pgm.sql(`
    DROP INDEX daily_verses_one_scheduled_per_locale;
    CREATE UNIQUE INDEX daily_verses_one_scheduled_per_locale ON daily_verses(display_date, locale)
      WHERE display_date IS NOT NULL AND publication_state = 'published';
    ALTER TABLE scripture_verses ADD COLUMN translation_locale text NOT NULL DEFAULT 'en';
    ALTER TABLE daily_verses ADD COLUMN translation_locale text NOT NULL DEFAULT 'en';
    ALTER TABLE categories ADD COLUMN is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN is_selectable boolean NOT NULL DEFAULT true, ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
    ALTER TABLE wallpapers ADD COLUMN description text, ADD COLUMN deity text, ADD COLUMN temple text,
      ADD COLUMN location text, ADD COLUMN credit text, ADD COLUMN locale text NOT NULL DEFAULT 'en',
      ADD COLUMN alt_text text, ADD COLUMN image_width integer, ADD COLUMN image_height integer,
      ADD COLUMN crop jsonb, ADD COLUMN upload_key text UNIQUE;
    CREATE TABLE media_uploads (
      id text PRIMARY KEY, actor_id uuid NOT NULL REFERENCES admins(id), fingerprint text NOT NULL,
      state text NOT NULL CHECK (state IN ('pending','complete','cleanup_required','failed')),
      public_ids jsonb NOT NULL DEFAULT '[]', result jsonb, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE media_cleanup (
      public_id text PRIMARY KEY, reason text NOT NULL, attempts integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE daily_assignments (
      day date NOT NULL, requested_locale text NOT NULL, selection_id uuid NOT NULL REFERENCES daily_verses(id) ON DELETE RESTRICT,
      payload jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, assigned_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(day, requested_locale)
    );
    CREATE TABLE editorial_contributions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid NOT NULL REFERENCES admins(id),
      content_type text NOT NULL, title text NOT NULL, locale text NOT NULL, body text NOT NULL,
      source_url text, state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','submitted')),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TRIGGER content_audit AFTER INSERT OR UPDATE OR DELETE ON editorial_contributions FOR EACH ROW EXECUTE FUNCTION hub_audit();
  `);
};

exports.down = () => { throw new Error('Content integrity is forward-only. Restore a verified backup; do not discard audit or editorial data.'); };
