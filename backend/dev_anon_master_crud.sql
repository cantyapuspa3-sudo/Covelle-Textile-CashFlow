-- Development only: anon can write master data without signing in.
-- RLS is not disabled and existing policies are left unchanged.
-- Do not use this policy set with sensitive or production data.
DO $$
DECLARE
  policy_row RECORD;
  policy_name TEXT;
BEGIN
  FOR policy_row IN
    SELECT * FROM (VALUES
      ('chart_of_accounts', 'insert', 'WITH CHECK (true)'),
      ('chart_of_accounts', 'update', 'USING (true) WITH CHECK (true)'),
      ('chart_of_accounts', 'delete', 'USING (true)'),
      ('departments', 'insert', 'WITH CHECK (true)'),
      ('departments', 'update', 'USING (true) WITH CHECK (true)'),
      ('departments', 'delete', 'USING (true)'),
      ('categories', 'insert', 'WITH CHECK (true)'),
      ('categories', 'update', 'USING (true) WITH CHECK (true)'),
      ('categories', 'delete', 'USING (true)'),
      ('cash_accounts', 'insert', 'WITH CHECK (true)'),
      ('cash_accounts', 'update', 'USING (true) WITH CHECK (true)'),
      ('cash_accounts', 'delete', 'USING (true)')
    ) AS policies(table_name, command_name, clause)
  LOOP
    policy_name := 'cashflow_dev_anon_' || policy_row.table_name || '_' || policy_row.command_name || '_v1';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = policy_row.table_name
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR %s TO anon %s',
        policy_name,
        policy_row.table_name,
        upper(policy_row.command_name),
        policy_row.clause
      );
    END IF;
  END LOOP;
END;
$$;