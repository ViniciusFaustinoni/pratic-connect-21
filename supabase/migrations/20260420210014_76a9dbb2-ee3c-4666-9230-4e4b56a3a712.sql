BEGIN;
LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE
  r RECORD;
  col_name TEXT;
  is_notnull BOOLEAN;
BEGIN
  FOR r IN
    SELECT conrelid::regclass::text AS table_name,
           conname,
           pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.profiles'::regclass
      AND confdeltype = 'a'
    ORDER BY conrelid::regclass::text
  LOOP
    col_name := substring(r.def from 'FOREIGN KEY \(([^)]+)\)');
    col_name := trim(both ' "' from col_name);

    EXECUTE format(
      'SELECT attnotnull FROM pg_attribute WHERE attrelid = %L::regclass AND attname = %L',
      r.table_name, col_name
    ) INTO is_notnull;

    IF is_notnull THEN
      EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', r.table_name, col_name);
    END IF;

    -- Limpa órfãos: seta NULL onde o profile referenciado não existe mais
    EXECUTE format(
      'UPDATE %s SET %I = NULL WHERE %I IS NOT NULL AND %I NOT IN (SELECT id FROM public.profiles)',
      r.table_name, col_name, col_name, col_name
    );

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
      r.table_name, r.conname, col_name
    );
  END LOOP;
END $$;
COMMIT;