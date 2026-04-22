create or replace function public.exec_sql(sql text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  execute sql;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.exec_sql(text) from public;
grant execute on function public.exec_sql(text) to service_role;
