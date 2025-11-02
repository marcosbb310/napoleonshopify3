-- Create exec_sql RPC function for running dynamic SQL migrations
-- This must run before any other migrations that use the exec_sql function

CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS TEXT AS $$
BEGIN
  EXECUTE sql;
  RETURN 'OK';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

