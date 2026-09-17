select cron.schedule(
  'daily-sync',
  '7 8 * * *', -- 08:07 UTC daily (~3am ET) so the day's slate/odds are fresh before morning
  $$
  select net.http_post(
    url := 'https://smtpfhinrmjpxxthqnie.functions.supabase.co/daily-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
