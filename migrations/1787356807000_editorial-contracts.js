exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE dated_events ADD COLUMN description_hi text, ADD COLUMN fasting_guidelines_hi text,
      ADD COLUMN applicability text NOT NULL DEFAULT 'global' CHECK (applicability IN ('global','tradition','region','location')),
      ADD COLUMN scope_key text, ADD COLUMN timing_timezone text, ADD COLUMN timing_location text,
      ADD COLUMN timing_source text, ADD COLUMN cancelled boolean NOT NULL DEFAULT false;
    CREATE TABLE scripture_snapshots (
      scripture_id varchar(100) NOT NULL REFERENCES scriptures(id) ON DELETE RESTRICT,
      version integer NOT NULL, hash text NOT NULL, body jsonb NOT NULL, metadata jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(scripture_id,version)
    );
    CREATE FUNCTION hub_scripture_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.version=OLD.version AND (to_jsonb(NEW)-ARRAY['updated_at','revision','reviewer_notes'])
         IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','revision','reviewer_notes']) THEN
        NEW.version := OLD.version+1;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER scripture_version BEFORE UPDATE ON scriptures FOR EACH ROW EXECUTE FUNCTION hub_scripture_version();
    ALTER TABLE daily_assignments ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
    CREATE TRIGGER content_audit AFTER INSERT OR UPDATE OR DELETE ON daily_assignments FOR EACH ROW EXECUTE FUNCTION hub_audit();
  `);
};
exports.down = () => { throw new Error('Restore an approved backup. Published snapshot and source metadata must not be discarded.'); };
