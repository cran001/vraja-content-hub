exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE books ADD COLUMN is_story boolean NOT NULL DEFAULT false,
      ADD COLUMN title_hi text, ADD COLUMN summary text, ADD COLUMN summary_hi text,
      ADD COLUMN story_body text, ADD COLUMN story_body_hi text,
      ADD COLUMN themes text[] NOT NULL DEFAULT '{}', ADD COLUMN deities text[] NOT NULL DEFAULT '{}',
      ADD COLUMN scripture_references text[] NOT NULL DEFAULT '{}', ADD COLUMN published_on date;
    ALTER TABLE book_pages ADD COLUMN title_hi text, ADD COLUMN body_text_hi text;
    CREATE FUNCTION hub_book_page_changed() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='DELETE' THEN UPDATE books SET updated_at=now(),publication_state=CASE WHEN publication_state='review' THEN 'draft' ELSE publication_state END WHERE id=OLD.book_id; RETURN OLD; END IF;
      UPDATE books SET updated_at=now(),publication_state=CASE WHEN publication_state='review' THEN 'draft' ELSE publication_state END WHERE id=NEW.book_id;
      RETURN NEW;
    END $$;
    CREATE TRIGGER book_page_changed AFTER INSERT OR UPDATE OR DELETE ON book_pages FOR EACH ROW EXECUTE FUNCTION hub_book_page_changed();
    CREATE TABLE quotes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('exact_quote','translated_scripture','original_reflection')),
      text text NOT NULL CHECK (length(btrim(text)) BETWEEN 12 AND 1200), locale varchar(16) NOT NULL DEFAULT 'en',
      attribution text NOT NULL, reference text, verse_id uuid REFERENCES scripture_verses(id) ON DELETE RESTRICT,
      theme text NOT NULL, display_date date, lock_screen_eligible boolean NOT NULL DEFAULT true,
      publication_state text NOT NULL DEFAULT 'draft' CHECK (publication_state IN ('draft','review','published','archived')),
      is_active boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1,
      source_name text, source_url text, translator text, edition text, provenance text,
      rights_status text NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown','licensed','public_domain','original')),
      reviewer_notes text, author_id uuid REFERENCES admins(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TRIGGER publication BEFORE INSERT OR UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION hub_publication();
    CREATE TRIGGER content_audit AFTER INSERT OR UPDATE OR DELETE ON quotes FOR EACH ROW EXECUTE FUNCTION hub_audit();
    CREATE UNIQUE INDEX quotes_scheduled_locale ON quotes(display_date,locale) WHERE publication_state='published' AND display_date IS NOT NULL;
  `);
};
exports.down = () => { throw new Error('Restore an approved backup; do not discard story or quote curation.'); };
