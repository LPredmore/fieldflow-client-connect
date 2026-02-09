
-- Create the trigger function
-- Uses the anon key for pg_net since verify_jwt = false on the edge function.
-- The edge function itself uses SUPABASE_SERVICE_ROLE_KEY internally via Deno.env.
CREATE OR REPLACE FUNCTION public.notify_new_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _function_url text := 'https://ahqauomkgflopxgnlndd.supabase.co/functions/v1/notify-new-message';
  _request_id bigint;
BEGIN
  -- Async HTTP POST via pg_net (non-blocking, does not slow down the INSERT)
  SELECT net.http_post(
    url := _function_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('message_id', NEW.id)
  ) INTO _request_id;

  RETURN NEW;
END;
$$;

-- Attach the trigger to the messages table
-- WHEN clause ensures it only fires for client-sent messages
DROP TRIGGER IF EXISTS trg_notify_new_client_message ON public.messages;

CREATE TRIGGER trg_notify_new_client_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.sender_type = 'client')
  EXECUTE FUNCTION public.notify_new_client_message();
