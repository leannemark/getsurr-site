-- The list form's server function, abused (W11) — STAGING ONLY. Run from the app repo:
--   npm run db:query -- -f <path to this file>        (db:query is staging; there is no :prod way to run it, on purpose)
-- Every test address ends in @launch-test.getsurr.test and is deleted again at the end of the run.
-- The calls arrive as if from one connection (a made-up cf-connecting-ip, the header Supabase passes in), so the
-- spam guard's cap of 20 per 10 minutes applies; that connection's counter rows are deleted at the end too.
create temp table t_out (n int, case_name text, result text);
do $$
declare
  r text;
  tries text[][] := array[
    ['empty', '', ''],
    ['bad email', 'not-an-email', 'berlin'],
    ['no city', 'nocity@launch-test.getsurr.test', ''],
    ['300 characters', repeat('a', 280) || '@launch-test.getsurr.test', repeat('b', 300)],
    ['emoji', 'emoji@launch-test.getsurr.test', 'berlin 🌈🏳️‍🌈'],
    ['sql in the city', 'sql@launch-test.getsurr.test', 'berlin''); drop table public.applications; --'],
    ['same address twice (1)', 'twice@launch-test.getsurr.test', 'berlin'],
    ['same address twice (2)', 'TWICE@launch-test.getsurr.test ', 'hamburg']
  ];
  i int;
begin
  perform set_config('request.headers', '{"cf-connecting-ip": "203.0.113.77"}', true);
  delete from private.rate_hits where key = private.rate_key();
  for i in 1 .. array_length(tries, 1) loop
    begin
      perform public.join_waitlist(tries[i][2], tries[i][3], case when i = 5 then '@💋' else null end);
      r := 'accepted';
    exception when others then r := 'refused: ' || sqlerrm;
    end;
    insert into t_out values (i, tries[i][1], r);
  end loop;
  -- a robot filling the hidden trap: the usual answer, nothing written, not counted
  begin
    perform public.join_waitlist('robot@launch-test.getsurr.test', 'berlin', null, 'http://spam.example');
    r := 'accepted';
  exception when others then r := 'refused: ' || sqlerrm;
  end;
  insert into t_out values (50, 'robot fills the trap', r);
  insert into t_out select 51, 'rows for the robot', count(*)::text from public.applications where email = 'robot@launch-test.getsurr.test';
  -- the counter starts again, then fifty different addresses in a row, as fast as the database can take them:
  -- 20 are taken, the rest refused
  delete from private.rate_hits where key = private.rate_key();
  for i in 1 .. 50 loop
    begin
      perform public.join_waitlist('burst' || i || '@launch-test.getsurr.test', 'berlin', null);
      r := 'accepted';
    exception when others then r := 'refused: ' || sqlerrm;
    end;
    insert into t_out values (100 + i, 'burst', r);
  end loop;
  insert into t_out select 200, 'rows for the twice address', count(*)::text from public.applications where email = 'twice@launch-test.getsurr.test';
  insert into t_out select 201, 'city kept for the twice address', max(payload->>'city') from public.applications where email = 'twice@launch-test.getsurr.test';
  insert into t_out select 202, 'longest city stored', max(length(payload->>'city'))::text from public.applications where email like '%@launch-test.getsurr.test';
  insert into t_out select 203, 'burst rows written (want 20)', count(*)::text from public.applications where email like 'burst%@launch-test.getsurr.test';
  insert into t_out select 204, 'applications table still there', to_regclass('public.applications')::text;
  delete from public.applications where email like '%@launch-test.getsurr.test';
  insert into t_out select 205, 'test rows left after cleanup', count(*)::text from public.applications where email like '%@launch-test.getsurr.test';
  delete from private.rate_hits where key = private.rate_key();
end $$;
select case_name, case when case_name = 'burst' then count(*)::text || '× ' || result else max(result) end as result
from t_out group by case_name, result order by min(n);
