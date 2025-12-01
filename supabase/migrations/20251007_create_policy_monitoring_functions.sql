-- Create function to get all RLS policies for monitoring
CREATE OR REPLACE FUNCTION get_policies_info()
RETURNS TABLE (
  policyname text,
  tablename text,
  schemaname text,
  cmd text,
  permissive text,
  roles text[],
  qual text,
  with_check text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.policyname,
    p.tablename,
    p.schemaname,
    p.cmd,
    p.permissive,
    p.roles,
    p.qual,
    p.with_check
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  ORDER BY p.tablename, p.policyname;
$$;

-- Create function to analyze policy dependencies
CREATE OR REPLACE FUNCTION analyze_policy_dependencies()
RETURNS TABLE (
  policy_name text,
  table_name text,
  referenced_tables text[],
  potential_circular_dependency boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  policy_record RECORD;
  referenced_tables_array text[];
  has_circular_ref boolean;
BEGIN
  FOR policy_record IN 
    SELECT policyname, tablename, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    -- Initialize array
    referenced_tables_array := ARRAY[]::text[];
    has_circular_ref := false;
    
    -- Extract table references from policy definition
    -- This is a simplified analysis - in production you'd want more sophisticated parsing
    IF policy_record.qual IS NOT NULL THEN
      -- Look for common table references in WHERE clauses
      IF position('profiles' in lower(policy_record.qual)) > 0 THEN
        referenced_tables_array := array_append(referenced_tables_array, 'profiles');
      END IF;
      
      IF position('clinicians' in lower(policy_record.qual)) > 0 AND policy_record.tablename != 'clinicians' THEN
        referenced_tables_array := array_append(referenced_tables_array, 'clinicians');
      END IF;
      
      IF position('user_permissions' in lower(policy_record.qual)) > 0 THEN
        referenced_tables_array := array_append(referenced_tables_array, 'user_permissions');
      END IF;
      
      -- Check for potential circular dependency
      -- If a policy on table A references table B, and we know table B references table A
      IF policy_record.tablename = 'clinicians' AND 'profiles' = ANY(referenced_tables_array) THEN
        has_circular_ref := true;
      ELSIF policy_record.tablename = 'profiles' AND 'clinicians' = ANY(referenced_tables_array) THEN
        has_circular_ref := true;
      END IF;
    END IF;
    
    RETURN QUERY SELECT 
      policy_record.policyname,
      policy_record.tablename,
      referenced_tables_array,
      has_circular_ref;
  END LOOP;
END;
$$;

-- Create function to test policy performance
CREATE OR REPLACE FUNCTION test_policy_performance(
  target_table text,
  sample_size integer DEFAULT 1
)
RETURNS TABLE (
  table_name text,
  execution_time_ms integer,
  row_count integer,
  success boolean,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time timestamp;
  end_time timestamp;
  execution_ms integer;
  row_cnt integer;
  error_msg text;
  is_success boolean;
BEGIN
  -- Initialize
  start_time := clock_timestamp();
  is_success := true;
  error_msg := null;
  row_cnt := 0;
  
  BEGIN
    -- Execute a simple SELECT to test policy performance
    EXECUTE format('SELECT count(*) FROM %I LIMIT %s', target_table, sample_size) INTO row_cnt;
    
  EXCEPTION WHEN OTHERS THEN
    is_success := false;
    error_msg := SQLERRM;
  END;
  
  end_time := clock_timestamp();
  execution_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time))::integer;
  
  RETURN QUERY SELECT 
    target_table,
    execution_ms,
    row_cnt,
    is_success,
    error_msg;
END;
$$;

-- Create function to get policy performance metrics
CREATE OR REPLACE FUNCTION get_policy_performance_summary()
RETURNS TABLE (
  table_name text,
  policy_count integer,
  avg_execution_time_ms numeric,
  max_execution_time_ms integer,
  has_performance_issues boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_record RECORD;
  perf_result RECORD;
  total_time integer;
  max_time integer;
  policy_cnt integer;
  has_issues boolean;
BEGIN
  -- Get all tables with RLS policies
  FOR table_record IN 
    SELECT DISTINCT tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    -- Test performance for this table
    SELECT * INTO perf_result 
    FROM test_policy_performance(table_record.tablename, 1);
    
    -- Count policies for this table
    SELECT count(*) INTO policy_cnt
    FROM pg_policies 
    WHERE tablename = table_record.tablename AND schemaname = 'public';
    
    total_time := COALESCE(perf_result.execution_time_ms, 0);
    max_time := total_time;
    has_issues := (total_time > 2000 OR NOT perf_result.success);
    
    RETURN QUERY SELECT 
      table_record.tablename,
      policy_cnt,
      total_time::numeric,
      max_time,
      has_issues;
  END LOOP;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_policies_info() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_policy_dependencies() TO authenticated;
GRANT EXECUTE ON FUNCTION test_policy_performance(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_policy_performance_summary() TO authenticated;

-- Create a view for easy policy monitoring
CREATE OR REPLACE VIEW policy_monitoring_dashboard AS
SELECT 
  p.tablename,
  p.policyname,
  p.cmd as operation,
  p.permissive,
  CASE 
    WHEN length(p.qual) > 200 THEN 'Complex'
    WHEN p.qual LIKE '%SELECT%FROM%' THEN 'Has Subquery'
    ELSE 'Simple'
  END as complexity,
  CASE
    WHEN p.qual ILIKE '%' || p.tablename || '%' AND p.qual ILIKE '%SELECT%FROM%' THEN true
    ELSE false
  END as potential_recursion
FROM pg_policies p
WHERE p.schemaname = 'public'
ORDER BY p.tablename, p.policyname;

-- Grant access to the view
GRANT SELECT ON policy_monitoring_dashboard TO authenticated;