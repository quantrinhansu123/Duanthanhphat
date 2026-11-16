-- Document ETL and reviewed financial facts. Additive; never alters production weld data.
-- Run as database owner. Source files use a PRIVATE bucket; workers require service_role.
begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists unaccent with schema extensions;
grant usage on schema extensions to authenticated,service_role;
create or replace function public.dk_fold(p_text text) returns text language sql immutable set search_path = '' as $$
  select lower(extensions.unaccent(replace(replace(p_text,'đ','d'),'Đ','D')))
$$;

create table if not exists public.dk_projects (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 200),
  owner_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.dk_members (
  project_id uuid not null references public.dk_projects(id), user_id uuid not null references auth.users(id),
  role text not null check(role in ('owner','editor','viewer')), primary key(project_id,user_id)
);
create or replace function public.dk_access(p_project uuid, p_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.dk_members
    where project_id=p_project and user_id=auth.uid() and (not p_write or role in ('owner','editor')))
$$;
create table if not exists public.dk_documents (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.dk_projects(id),
  source_key text not null check(length(source_key) between 1 and 1200), name text not null,
  source_kind text not null check(source_kind in ('upload','local')), source_ref text not null,
  content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'), pipeline_version text not null,
  revision integer not null default 1, size_bytes bigint not null check(size_bytes>=0),
  state text not null default 'queued' check(state in ('queued','running','ready','failed','removed')),
  review_state text not null default 'pending' check(review_state in ('pending','verified')),
  page_count integer, error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id,source_key)
);
create table if not exists public.dk_jobs (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.dk_documents(id),
  revision integer not null, state text not null default 'queued' check(state in ('queued','running','done','failed','superseded')),
  attempts integer not null default 0, lease_token uuid, lease_until timestamptz,
  error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(document_id,revision)
);
alter table public.dk_documents add column if not exists automatic_check jsonb not null default '{"issues":["not_assessed"]}';
create table if not exists public.dk_pages (
  document_id uuid not null references public.dk_documents(id), revision integer not null,
  page integer not null check(page>0), text text not null, method text not null,
  primary key(document_id,revision,page)
);
alter table public.dk_pages add column if not exists ocr_meta jsonb not null default '{}';
create table if not exists public.dk_chunks (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.dk_documents(id),
  revision integer not null, page integer not null, ordinal integer not null,
  content text not null check(length(content) between 1 and 2400),
  embedding extensions.vector(768), embedding_model text not null,
  fts tsvector generated always as (to_tsvector('simple',public.dk_fold(content))) stored,
  unique(document_id,revision,ordinal),
  foreign key(document_id,revision,page) references public.dk_pages(document_id,revision,page)
);
create index if not exists dk_chunks_fts on public.dk_chunks using gin(fts);
create index if not exists dk_docs_project on public.dk_documents(project_id,state);
create index if not exists dk_jobs_pending on public.dk_jobs(state,created_at);
create table if not exists public.dk_contracts (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.dk_projects(id),
  code text not null, currency text not null default 'VND' check(currency='VND'), unique(project_id,code)
);
create table if not exists public.dk_facts (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.dk_projects(id),
  document_id uuid not null references public.dk_documents(id), revision integer not null,
  contract_id uuid references public.dk_contracts(id), contract_code text not null default '', kind text not null check(kind in
    ('contract_base','contract_adjustment','accepted_increment','accepted_cumulative','payment','payment_request','advance')),
  amount numeric(24,0), currency text not null default 'VND' check(currency='VND'),
  event_date date, period_index integer check(period_index>0), business_key text not null default '',
  source_page integer not null check(source_page>0), quote text not null check(length(quote) between 1 and 2000),
  status text not null default 'pending' check(status in ('pending','approved','rejected','obsolete')),
  review_version integer not null default 0, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  foreign key(document_id,revision,source_page) references public.dk_pages(document_id,revision,page)
);
alter table public.dk_facts add column if not exists automatic_check jsonb not null default '{"eligible":false,"issues":["not_assessed"]}';
-- Business identifiers, not file names, prevent the same event being approved twice.
create unique index if not exists dk_fact_business_identity on public.dk_facts(project_id,business_key) where status='approved';
create unique index if not exists dk_one_contract_base on public.dk_facts(project_id,contract_code) where status='approved' and kind='contract_base';
create unique index if not exists dk_one_cumulative_period on public.dk_facts(project_id,contract_code,period_index)
  where status='approved' and kind='accepted_cumulative';
create table if not exists public.dk_audit (
  id bigint generated always as identity primary key, project_id uuid not null references public.dk_projects(id),
  actor uuid, action text not null, entity_id uuid, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.dk_usage (
  id bigint generated always as identity primary key, project_id uuid not null references public.dk_projects(id),
  actor uuid not null references auth.users(id), phase text not null, model text not null,
  usage jsonb not null, elapsed_ms integer not null, created_at timestamptz not null default now()
);

-- Closed by default. Only verified project members can read. All writes go through scoped RPCs.
do $$ declare t text; begin
  foreach t in array array['dk_projects','dk_members','dk_documents','dk_jobs','dk_pages','dk_chunks','dk_contracts','dk_facts','dk_audit','dk_usage'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('drop policy if exists dk_read on public.%I',t);
    if t='dk_projects' then
      execute 'create policy dk_read on public.dk_projects for select to authenticated using(public.dk_access(id))';
    elsif t in ('dk_pages','dk_chunks','dk_jobs') then
      execute format('create policy dk_read on public.%I for select to authenticated using(exists(select 1 from public.dk_documents d where d.id=document_id and public.dk_access(d.project_id)))',t);
    else
      execute format('create policy dk_read on public.%I for select to authenticated using(public.dk_access(project_id))',t);
    end if;
  end loop;
end $$;
create or replace function public.dk_record_usage(p_project uuid,p_phase text,p_model text,p_usage jsonb,p_ms integer) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if not public.dk_access(p_project) then raise exception 'DK_FORBIDDEN'; end if;
  if p_phase not in ('plan','answer') or length(p_model)>100 or p_ms not between 0 and 180000 or pg_column_size(p_usage)>1000 then raise exception 'DK_INVALID_QUERY'; end if;
  insert into public.dk_usage(project_id,actor,phase,model,usage,elapsed_ms) values(p_project,auth.uid(),p_phase,p_model,p_usage,p_ms);
end $$;

create or replace function public.dk_create_project(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; begin
  if auth.uid() is null then raise exception 'DK_UNAUTHORIZED'; end if;
  insert into public.dk_projects(name,owner_id) values(trim(p_name),auth.uid()) returning id into pid;
  insert into public.dk_members values(pid,auth.uid(),'owner');
  return pid;
end $$;
create or replace function public.dk_grant_member(p_project uuid,p_user uuid,p_role text) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if not exists(select 1 from public.dk_projects where id=p_project and owner_id=auth.uid()) then raise exception 'DK_FORBIDDEN'; end if;
  if p_role not in ('viewer','editor') or p_user=auth.uid() then raise exception 'DK_INVALID_ROLE'; end if;
  insert into public.dk_members values(p_project,p_user,p_role) on conflict(project_id,user_id) do update set role=excluded.role;
  insert into public.dk_audit(project_id,actor,action,entity_id) values(p_project,auth.uid(),'grant_'||p_role,p_user);
end $$;

-- Called only by the backend after upload, or by the trusted local scanner.
create or replace function public.dk_register_document(p_project uuid,p_key text,p_name text,p_kind text,p_ref text,p_hash text,p_pipeline text,p_size bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dk_documents; jid uuid; begin
  -- Serialize registration of the same logical source, including its first insert.
  perform pg_advisory_xact_lock(hashtextextended(p_project::text||p_key,0));
  perform 1 from public.dk_jobs where document_id=(select id from public.dk_documents where project_id=p_project and source_key=p_key) order by id for update;
  select * into d from public.dk_documents where project_id=p_project and source_key=p_key for update;
  if found and d.content_hash=p_hash and d.pipeline_version=p_pipeline and d.state<>'removed' then
    return jsonb_build_object('document_id',d.id,'revision',d.revision,'unchanged',true);
  end if;
  if d.id is null then
    insert into public.dk_documents(project_id,source_key,name,source_kind,source_ref,content_hash,pipeline_version,size_bytes)
      values(p_project,p_key,p_name,p_kind,p_ref,p_hash,p_pipeline,p_size) returning * into d;
  else
    update public.dk_facts set status='obsolete' where document_id=d.id and status<>'obsolete';
    update public.dk_jobs set state='superseded',lease_token=null where document_id=d.id and state in ('queued','running','failed');
    update public.dk_documents set name=p_name,source_kind=p_kind,source_ref=p_ref,content_hash=p_hash,
      pipeline_version=p_pipeline,size_bytes=p_size,revision=revision+1,state='queued',review_state='pending',
      error_code=null,page_count=null,updated_at=now() where id=d.id returning * into d;
  end if;
  insert into public.dk_jobs(document_id,revision) values(d.id,d.revision) returning id into jid;
  return jsonb_build_object('document_id',d.id,'revision',d.revision,'job_id',jid,'unchanged',false);
end $$;

create or replace function public.dk_claim_job() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j public.dk_jobs; d public.dk_documents; begin
  with expired as (update public.dk_jobs set state='failed',error_code='DK_LEASE_EXHAUSTED',updated_at=now()
    where state='running' and lease_until<now() and attempts>=4 returning document_id,revision)
  update public.dk_documents docrow set state='failed',error_code='DK_LEASE_EXHAUSTED',updated_at=now()
    from expired e where docrow.id=e.document_id and docrow.revision=e.revision and docrow.state='running';
  select * into j from public.dk_jobs where (state='queued' or (state='running' and lease_until<now())
    or (state='failed' and error_code in ('DK_AI_TIMEOUT','DK_AI_UNAVAILABLE','DK_AI_HTTP_429','DK_AI_HTTP_500','DK_AI_HTTP_502','DK_AI_HTTP_503','DK_AI_HTTP_504')
      and updated_at<now()-interval '2 minutes'*power(2,least(greatest(attempts-1,0),3)))) and attempts<4
    order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  select * into d from public.dk_documents where id=j.document_id for update;
  if d.revision<>j.revision or d.state='removed' then
    update public.dk_jobs set state='superseded' where id=j.id; return null;
  end if;
  update public.dk_jobs set state='running',attempts=attempts+1,lease_token=gen_random_uuid(),
    lease_until=now()+interval '10 minutes',updated_at=now() where id=j.id returning * into j;
  update public.dk_documents set state='running',error_code=null,updated_at=now() where id=d.id;
  return jsonb_build_object('job',to_jsonb(j),'document',to_jsonb(d));
end $$;
create or replace function public.dk_mark_missing(p_project uuid,p_prefix text,p_keys jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_prefix is null or p_prefix not like 'local/%' or jsonb_typeof(p_keys) is distinct from 'array' or jsonb_array_length(p_keys)>10000 then raise exception 'DK_INVALID_SCAN'; end if;
  -- Lock jobs before documents, consistently with worker completion/registration.
  perform 1 from public.dk_jobs where document_id in (select id from public.dk_documents
    where project_id=p_project and source_kind='local' and starts_with(source_key,p_prefix)
    and not exists(select 1 from jsonb_array_elements_text(p_keys) k where k=source_key)) order by id for update;
  with removed as (update public.dk_documents d set state='removed',review_state='pending',updated_at=now()
    where project_id=p_project and source_kind='local' and starts_with(source_key,p_prefix)
      and not exists(select 1 from jsonb_array_elements_text(p_keys) k where k=d.source_key) returning id)
  update public.dk_jobs set state='superseded',lease_token=null where document_id in(select id from removed) and state in ('queued','running','failed');
  update public.dk_facts f set status='obsolete' where project_id=p_project
    and exists(select 1 from public.dk_documents d where d.id=f.document_id and d.state='removed');
end $$;
create or replace function public.dk_heartbeat(p_job uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer; begin
  update public.dk_jobs set lease_until=now()+interval '10 minutes',updated_at=now()
    where id=p_job and state='running' and lease_token=p_token and lease_until>now();
  get diagnostics changed = row_count; return changed=1;
end $$;
create or replace function public.dk_fail_job(p_job uuid,p_token uuid,p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.dk_jobs; begin
  update public.dk_jobs set state='failed',error_code=left(p_code,100),updated_at=now()
    where id=p_job and state='running' and lease_token=p_token returning * into j;
  if found then update public.dk_documents set state='failed',error_code=left(p_code,100),updated_at=now()
    where id=j.document_id and revision=j.revision; end if;
end $$;
drop function if exists public.dk_complete_job(uuid,uuid,jsonb,jsonb,jsonb,text);
create or replace function public.dk_complete_job(p_job uuid,p_token uuid,p_pages jsonb,p_chunks jsonb,p_facts jsonb,p_model text,p_automatic jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare j public.dk_jobs; d public.dk_documents; v jsonb; a jsonb; ai integer:=0; begin
  select * into j from public.dk_jobs where id=p_job for update;
  if j.id is null or j.state<>'running' or j.lease_token is distinct from p_token or j.lease_until<now() then raise exception 'DK_LEASE_LOST'; end if;
  select * into d from public.dk_documents where id=j.document_id for update;
  if d.revision<>j.revision or d.state='removed' then raise exception 'DK_STALE_DOCUMENT'; end if;
  if jsonb_typeof(p_pages) is distinct from 'array' or jsonb_typeof(p_chunks) is distinct from 'array' or jsonb_typeof(p_facts) is distinct from 'array'
     or jsonb_array_length(p_pages) not between 1 and 500 or jsonb_array_length(p_chunks)>3000
     or jsonb_array_length(p_facts)>500 then raise exception 'DK_EXTRACTION_LIMIT'; end if;
  if (select count(distinct (x->>'page')::integer) from jsonb_array_elements(p_pages) x) <> jsonb_array_length(p_pages)
     or (select min((x->>'page')::integer) from jsonb_array_elements(p_pages) x)<>1
     or (select max((x->>'page')::integer) from jsonb_array_elements(p_pages) x)<>jsonb_array_length(p_pages)
    then raise exception 'DK_INCOMPLETE_PAGES'; end if;
  if p_automatic is not null and (jsonb_typeof(p_automatic) is distinct from 'object'
    or jsonb_typeof(p_automatic->'facts') is distinct from 'array'
    or jsonb_array_length(p_automatic->'facts')<>jsonb_array_length(p_facts)
    or jsonb_typeof(p_automatic->'document') is distinct from 'object'
    or p_automatic->'document'->>'version' is distinct from 'dk-auto-v1'
    or jsonb_typeof(p_automatic->'document'->'issues') is distinct from 'array'
    or pg_column_size(p_automatic)>1000000) then raise exception 'DK_INVALID_AUTOMATIC_CHECK'; end if;
  for v in select * from jsonb_array_elements(p_pages) loop
    if jsonb_typeof(coalesce(v->'ocr_meta','{}'::jsonb)) is distinct from 'object'
      or pg_column_size(v->'ocr_meta')>500000 then raise exception 'DK_INVALID_PAGE'; end if;
    insert into public.dk_pages(document_id,revision,page,text,method,ocr_meta)
      values(d.id,d.revision,(v->>'page')::integer,v->>'text',v->>'method',coalesce(v->'ocr_meta','{}'::jsonb));
  end loop;
  for v in select * from jsonb_array_elements(p_chunks) loop
    insert into public.dk_chunks(document_id,revision,page,ordinal,content,embedding,embedding_model)
      values(d.id,d.revision,(v->>'page')::integer,(v->>'ordinal')::integer,v->>'content',
        case when v->'embedding'='null'::jsonb then null else (v->>'embedding')::extensions.vector end,p_model);
  end loop;
  for v in select * from jsonb_array_elements(p_facts) loop
    if not exists(select 1 from public.dk_pages where document_id=d.id and revision=d.revision and page=(v->>'source_page')::integer
      and position(v->>'quote' in text)>0) then raise exception 'DK_EVIDENCE_NOT_FOUND'; end if;
    a:=coalesce(p_automatic->'facts'->ai,'{"eligible":false,"issues":["not_assessed"]}'::jsonb);
    if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(a->'eligible') is distinct from 'boolean'
      or jsonb_typeof(a->'issues') is distinct from 'array'
      or ((a->>'eligible')::boolean and (a->>'version' is distinct from 'dk-auto-v1'
        or coalesce(length(a->>'identity'),0) not between 3 and 500 or jsonb_array_length(a->'issues')<>0))
      then raise exception 'DK_INVALID_AUTOMATIC_CHECK'; end if;
    insert into public.dk_facts(project_id,document_id,revision,contract_code,kind,amount,event_date,period_index,source_page,quote,automatic_check)
      values(d.project_id,d.id,d.revision,upper(trim(coalesce(v->>'contract_code',''))),v->>'kind',nullif(v->>'amount','')::numeric,
        nullif(v->>'event_date','')::date,nullif(v->>'period_index','')::integer,(v->>'source_page')::integer,v->>'quote',a);
    ai:=ai+1;
  end loop;
  update public.dk_documents set state='ready',page_count=jsonb_array_length(p_pages),review_state='pending',
    automatic_check=coalesce(p_automatic->'document','{"issues":["not_assessed"]}'::jsonb),updated_at=now() where id=d.id;
  update public.dk_jobs set state='done',lease_token=null,lease_until=null,updated_at=now() where id=j.id;
end $$;

create or replace function public.dk_review_fact(p_id uuid,p_version integer,p_decision text,p_fields jsonb,p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.dk_facts; d public.dk_documents; previous jsonb; begin
  select * into f from public.dk_facts where id=p_id;
  if f.id is null or not public.dk_access(f.project_id,true) then raise exception 'DK_FORBIDDEN'; end if;
  select * into d from public.dk_documents where id=f.document_id for update;
  select * into f from public.dk_facts where id=p_id for update;
  if f.revision<>d.revision or d.state<>'ready' or f.status='obsolete' then raise exception 'DK_STALE_DOCUMENT'; end if;
  if f.review_version is distinct from p_version then raise exception 'DK_REVIEW_CONFLICT'; end if;
  previous:=to_jsonb(f)||jsonb_build_object('amount',f.amount::text);
  if p_decision is null or p_decision not in ('approved','rejected') or coalesce(length(trim(p_note)),0)<3 then raise exception 'DK_REVIEW_NOTE_REQUIRED'; end if;
  if p_decision='approved' then
    if coalesce(p_fields->>'amount','') !~ '^-?[0-9]{1,24}$' then raise exception 'DK_INVALID_AMOUNT'; end if;
    f.contract_code:=upper(trim(p_fields->>'contract_code')); f.business_key:=upper(trim(p_fields->>'business_key'));
    f.kind:=p_fields->>'kind'; f.amount:=(p_fields->>'amount')::numeric;
    f.event_date:=(p_fields->>'event_date')::date; f.period_index:=nullif(p_fields->>'period_index','')::integer;
    if coalesce(length(f.contract_code),0)=0 or coalesce(length(f.business_key),0) not between 3 and 200
      or f.amount is null or f.amount<>trunc(f.amount) or f.event_date is null
      or (f.amount<0 and f.kind<>'contract_adjustment')
      or (f.kind in ('accepted_increment','accepted_cumulative') and f.period_index is null)
      then raise exception 'DK_INVALID_FACT'; end if;
    insert into public.dk_contracts(project_id,code) values(f.project_id,f.contract_code) on conflict(project_id,code) do nothing;
    select id into f.contract_id from public.dk_contracts where project_id=f.project_id and code=f.contract_code;
  end if;
  update public.dk_facts set contract_id=f.contract_id,contract_code=f.contract_code,business_key=f.business_key,kind=f.kind,amount=f.amount,
    event_date=f.event_date,period_index=f.period_index,status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_version=review_version+1 where id=p_id;
  update public.dk_documents set review_state='pending',updated_at=now() where id=f.document_id;
  insert into public.dk_audit(project_id,actor,action,entity_id,detail) values(f.project_id,auth.uid(),p_decision,p_id,
    jsonb_build_object('note',p_note,'previous',previous,'fields',p_fields));
end $$;
create or replace function public.dk_add_fact(p_document uuid,p_revision integer,p_page integer,p_quote text,p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.dk_documents; fid uuid; begin
  select * into d from public.dk_documents where id=p_document for update;
  if d.id is null or not public.dk_access(d.project_id,true) then raise exception 'DK_FORBIDDEN'; end if;
  if d.revision is distinct from p_revision or d.state<>'ready' then raise exception 'DK_STALE_DOCUMENT'; end if;
  if coalesce(length(p_quote),0) not between 1 and 2000 or not exists(select 1 from public.dk_pages
    where document_id=d.id and revision=d.revision and page=p_page and position(p_quote in text)>0) then raise exception 'DK_EVIDENCE_NOT_FOUND'; end if;
  insert into public.dk_facts(project_id,document_id,revision,kind,source_page,quote) values(d.project_id,d.id,d.revision,p_kind,p_page,p_quote) returning id into fid;
  update public.dk_documents set review_state='pending',updated_at=now() where id=d.id;
  insert into public.dk_audit(project_id,actor,action,entity_id) values(d.project_id,auth.uid(),'add_fact',fid);
  return fid;
end $$;
create or replace function public.dk_document_detail(p_document uuid,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.dk_documents; result jsonb; begin
  select * into d from public.dk_documents where id=p_document;
  if d.id is null or not public.dk_access(d.project_id) then raise exception 'DK_FORBIDDEN'; end if;
  if p_offset<0 then raise exception 'DK_INVALID_QUERY'; end if;
  select jsonb_build_object('document',to_jsonb(d)-'source_ref','facts',coalesce(jsonb_agg(x),'[]'::jsonb),
    'facts_total',(select count(*) from public.dk_facts where document_id=d.id and revision=d.revision)) into result
    from (select id,contract_code,kind,amount::text as amount,event_date,period_index,business_key,source_page,quote,status,review_version,automatic_check
      from public.dk_facts where document_id=d.id and revision=d.revision order by source_page,id offset p_offset limit 100) x;
  return result;
end $$;
create or replace function public.dk_document_action(p_id uuid,p_revision integer,p_action text,p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.dk_documents; begin
  -- Queue operations consistently lock job before document, like worker/registration.
  perform 1 from public.dk_jobs where document_id=p_id order by id for update;
  select * into d from public.dk_documents where id=p_id for update;
  if d.id is null or not public.dk_access(d.project_id,true) then raise exception 'DK_FORBIDDEN'; end if;
  if d.revision is distinct from p_revision then raise exception 'DK_STALE_DOCUMENT'; end if;
  if coalesce(length(trim(p_note)),0)<3 then raise exception 'DK_REVIEW_NOTE_REQUIRED'; end if;
  if p_action='verify' then
    if d.state<>'ready' or exists(select 1 from public.dk_facts where document_id=d.id and revision=d.revision and status='pending')
      then raise exception 'DK_REVIEW_INCOMPLETE'; end if;
    update public.dk_documents set review_state='verified',updated_at=now() where id=d.id;
  elsif p_action='retry' then
    if d.state<>'failed' then raise exception 'DK_NOT_FAILED'; end if;
    update public.dk_jobs set state='queued',attempts=0,error_code=null,lease_token=null,updated_at=now() where document_id=d.id and revision=d.revision;
    update public.dk_documents set state='queued',error_code=null,updated_at=now() where id=d.id;
  elsif p_action='remove' then
    update public.dk_documents set state='removed',review_state='pending',updated_at=now() where id=d.id;
    update public.dk_jobs set state='superseded',lease_token=null where document_id=d.id and state in ('queued','running');
    update public.dk_facts set status='obsolete' where document_id=d.id;
  else raise exception 'DK_INVALID_ACTION'; end if;
  insert into public.dk_audit(project_id,actor,action,entity_id,detail) values(d.project_id,auth.uid(),p_action,d.id,jsonb_build_object('note',p_note));
end $$;

drop function if exists public.dk_financial_summary(uuid,text,date);
create or replace function public.dk_financial_summary(p_project uuid,p_metric text,p_as_of date default current_date,p_contract text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare total numeric; conflicts integer; docs integer; ready integer; verified integer; pending integer; events integer; contracts integer; sources jsonb; begin
  if not public.dk_access(p_project) then raise exception 'DK_FORBIDDEN'; end if;
  if p_metric is null or p_metric not in ('contract_total','accepted_total','paid_total','payment_requested_total','advance_total') then raise exception 'DK_INVALID_METRIC'; end if;
  if p_as_of is null then raise exception 'DK_INVALID_DATE'; end if;
  if p_contract is not null and length(trim(p_contract)) not between 1 and 200 then raise exception 'DK_INVALID_QUERY'; end if;
  select count(*),count(*) filter(where state='ready'),count(*) filter(where state='ready' and review_state='verified')
    into docs,ready,verified from public.dk_documents where project_id=p_project and state<>'removed';
  select count(*) into pending from public.dk_facts f join public.dk_documents d on d.id=f.document_id
    where f.project_id=p_project and d.state<>'removed' and f.revision=d.revision and f.status='pending';
  -- A cumulative snapshot includes all earlier periods. Only later incremental periods can be added.
  -- If an incremental event in a later period predates the snapshot, require reconciliation.
  with approved as (select f.* from public.dk_facts f join public.dk_documents d on d.id=f.document_id
    where f.project_id=p_project and f.status='approved' and f.revision=d.revision and d.state='ready' and f.event_date<=p_as_of
      and (p_contract is null or f.contract_code=upper(trim(p_contract)))),
  snapshots as (select distinct on(contract_code) * from approved where kind='accepted_cumulative' order by contract_code,period_index desc,event_date desc)
  select count(*) into conflicts from approved f join snapshots s using(contract_code)
    where p_metric='accepted_total' and f.kind='accepted_increment' and f.period_index>s.period_index and f.event_date<s.event_date;
  if p_metric='contract_total' then
    select count(distinct f.contract_code) into conflicts from public.dk_facts f join public.dk_documents d on d.id=f.document_id
      where f.project_id=p_project and f.status='approved' and f.kind='contract_adjustment' and f.revision=d.revision and d.state='ready' and f.event_date<=p_as_of
      and (p_contract is null or f.contract_code=upper(trim(p_contract)))
      and not exists(select 1 from public.dk_facts b join public.dk_documents bd on bd.id=b.document_id
        where b.project_id=p_project and b.contract_code=f.contract_code and b.kind='contract_base' and b.status='approved'
          and b.revision=bd.revision and bd.state='ready' and b.event_date<=p_as_of);
  end if;
  with approved as (select f.* from public.dk_facts f join public.dk_documents d on d.id=f.document_id
    where f.project_id=p_project and f.status='approved' and f.revision=d.revision and d.state='ready' and f.event_date<=p_as_of
      and (p_contract is null or f.contract_code=upper(trim(p_contract)))),
  snapshots as (select distinct on(contract_code) * from approved where kind='accepted_cumulative' order by contract_code,period_index desc,event_date desc),
  included as (select f.* from approved f where
    (p_metric='contract_total' and f.kind in ('contract_base','contract_adjustment')) or
    (p_metric='paid_total' and f.kind='payment') or (p_metric='payment_requested_total' and f.kind='payment_request') or
    (p_metric='advance_total' and f.kind='advance') or
    (p_metric='accepted_total' and ((f.kind='accepted_cumulative' and f.id in(select id from snapshots)) or
      (f.kind='accepted_increment' and not exists(select 1 from snapshots s where s.contract_code=f.contract_code and s.period_index>=f.period_index)))))
  select sum(amount),count(*),count(distinct contract_code),coalesce((select jsonb_agg(x) from
    (select id,document_id,source_page,contract_code,kind,amount::text as amount_vnd from included order by contract_code,id limit 20) x),'[]'::jsonb)
    into total,events,contracts,sources from included;
  return jsonb_build_object('metric',p_metric,'currency','VND','as_of_date',p_as_of,'contract_filter',p_contract,
    'total_vnd',case when conflicts>0 then null else total::text end,'event_count',events,'contract_count',contracts,
    'documents_total',docs,'documents_ready',ready,'documents_verified',verified,'facts_pending',pending,'conflicts',conflicts,
    'complete',docs>0 and docs=verified and conflicts=0,'sources',sources,'sources_truncated',events>20);
end $$;

-- Provisional automatic totals. Never change a fact into human-approved or mark a document verified.
create or replace function public.dk_automatic_summary(p_project uuid,p_metric text,p_as_of date default current_date,p_contract text default null,p_expected_documents integer default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; docs integer; ready integer; verified integer; document_issues integer; begin
  if not public.dk_access(p_project) then raise exception 'DK_FORBIDDEN'; end if;
  if p_metric is null or p_metric not in ('contract_total','accepted_total','paid_total','payment_requested_total','advance_total') then raise exception 'DK_INVALID_METRIC'; end if;
  if p_as_of is null then raise exception 'DK_INVALID_DATE'; end if;
  if (p_contract is not null and length(trim(p_contract)) not between 1 and 200)
    or (p_expected_documents is not null and p_expected_documents not between 1 and 1000000) then raise exception 'DK_INVALID_QUERY'; end if;
  select count(*),count(*) filter(where state='ready'),count(*) filter(where state='ready' and review_state='verified'),
    count(*) filter(where state='ready' and review_state<>'verified' and jsonb_array_length(coalesce(automatic_check->'issues','["not_assessed"]'::jsonb))>0)
    into docs,ready,verified,document_issues from public.dk_documents where project_id=p_project and state<>'removed';
  with raw as (
    select f.*,d.name,
      (f.status='approved' or (f.automatic_check->>'eligible'='true' and f.automatic_check->>'version'='dk-auto-v1'))
        and f.amount is not null and f.event_date is not null and length(f.contract_code)>0 as eligible,
      case when f.kind='contract_base' then 'CONTRACT:'||f.contract_code
        when f.kind in ('accepted_increment','accepted_cumulative') then upper(f.kind)||':'||f.contract_code||':'||f.period_index::text
        when coalesce(f.automatic_check->>'reference','')<>'' then
          (case when f.kind in ('payment','advance') then 'TRANSFER' else upper(f.kind) end)||':'||f.contract_code||':'||(f.automatic_check->>'reference')
        else coalesce(nullif(f.business_key,''),f.id::text) end as identity_key,
      case p_metric when 'contract_total' then f.kind in ('contract_base','contract_adjustment')
        when 'accepted_total' then f.kind in ('accepted_increment','accepted_cumulative')
        when 'paid_total' then f.kind='payment' when 'payment_requested_total' then f.kind='payment_request'
        when 'advance_total' then f.kind='advance' else false end as relevant
    from public.dk_facts f join public.dk_documents d on d.id=f.document_id
    where f.project_id=p_project and d.state='ready' and f.revision=d.revision and f.status in ('pending','approved')
      and (f.event_date is null or f.event_date<=p_as_of)
      and (p_contract is null or f.contract_code=upper(trim(p_contract)) or f.contract_code='')
  ), groups as (
    select identity_key,count(*) as copies,
      count(distinct jsonb_build_array(kind,amount,event_date,period_index,contract_code)::text) as variants,
      bool_or(relevant) as relevant from raw where eligible group by identity_key
  ), ranked as (
    select r.*,g.variants,row_number() over(partition by r.identity_key order by (r.status='approved') desc,r.document_id,r.source_page,r.id) as rn
    from raw r join groups g using(identity_key) where r.eligible
  ), unique_events as (select * from ranked where rn=1 and variants=1),
  snapshots as (select distinct on(contract_code) * from unique_events where kind='accepted_cumulative' order by contract_code,period_index desc,event_date desc),
  included as (select f.* from unique_events f where f.relevant and (
    p_metric<>'accepted_total' or (f.kind='accepted_cumulative' and f.id in(select id from snapshots)) or
      (f.kind='accepted_increment' and not exists(select 1 from snapshots s where s.contract_code=f.contract_code and s.period_index>=f.period_index))
  )), logical_conflicts as (
    select f.id from unique_events f join snapshots s using(contract_code)
      where p_metric='accepted_total' and f.kind='accepted_increment' and f.period_index>s.period_index and f.event_date<s.event_date
    union all
    select f.id from unique_events f where p_metric='contract_total' and f.kind='contract_adjustment'
      and not exists(select 1 from unique_events b where b.contract_code=f.contract_code and b.kind='contract_base')
    union all
    select f.id from unique_events f join unique_events other on f.contract_code=other.contract_code and f.kind=other.kind
      and f.event_date=other.event_date and f.identity_key<>other.identity_key
      where f.relevant and f.status='approved' and other.status='pending'
        and f.kind in ('payment','advance','payment_request','contract_adjustment') and coalesce(f.automatic_check->>'reference','')=''
    union all
    select min(f.id::text)::uuid from unique_events f where f.relevant and f.kind in ('payment','advance')
      and coalesce(f.automatic_check->>'reference','')<>'' group by f.automatic_check->>'reference'
      having count(distinct f.contract_code)>1
  ), counters as (
    select (select count(*) from groups where relevant and variants>1)+(select count(*) from logical_conflicts) as conflicts,
      (select count(*) from raw where relevant and not eligible) as blocked,
      coalesce((select sum(copies-1) from groups where relevant and variants=1),0) as duplicate_copies,
      (select count(*) from included where status<>'approved') as automatic_events
  )
  select jsonb_build_object('basis','automatic','metric',p_metric,'currency','VND','as_of_date',p_as_of,'contract_filter',p_contract,
    'expected_documents',p_expected_documents,'selection_matches',p_expected_documents is null or p_expected_documents=docs,
    'total_vnd',case when c.conflicts>0 or (p_expected_documents is not null and p_expected_documents<>docs) then null else (select sum(amount)::text from included) end,
    'event_count',(select count(*) from included),'contract_count',(select count(distinct contract_code) from included),
    'documents_total',docs,'documents_ready',ready,'documents_verified',verified,'documents_with_issues',document_issues,
    'facts_pending',(select count(*) from raw where status='pending'),'facts_unresolved',c.blocked,'automatic_events',c.automatic_events,
    'duplicates_ignored',c.duplicate_copies,'conflicts',c.conflicts,
    'complete',docs>0 and docs=ready and document_issues=0 and c.blocked=0 and c.conflicts=0 and (p_expected_documents is null or p_expected_documents=docs),
    'human_verified',docs>0 and docs=verified and c.automatic_events=0 and c.blocked=0 and c.conflicts=0,
    'sources',coalesce((select jsonb_agg(x) from (select id,document_id,source_page,contract_code,kind,amount::text as amount_vnd from included order by contract_code,id limit 20) x),'[]'::jsonb),
    'sources_truncated',(select count(*)>20 from included),
    'issues',coalesce((select jsonb_agg(x) from (
      select r.document_id,r.source_page,r.name,r.kind,
        case when not r.eligible then 'insufficient_evidence' else 'conflicting_event' end as code,
        r.automatic_check->'issues' as reasons
      from raw r left join groups g using(identity_key) where r.relevant and (not r.eligible or g.variants>1)
      order by r.document_id,r.source_page limit 20
    ) x),'[]'::jsonb)
  ) into result from counters c;
  return result;
end $$;

create or replace function public.dk_search(p_project uuid,p_query text,p_vector extensions.vector(768) default null,p_model text default 'gemini-embedding-001',p_limit integer default 6)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; begin
  if not public.dk_access(p_project) then raise exception 'DK_FORBIDDEN'; end if;
  if length(p_query) not between 1 and 2000 or p_limit not between 1 and 10 then raise exception 'DK_INVALID_QUERY'; end if;
  with candidates as (select c.id,c.document_id,c.page,c.content,d.name,
    ts_rank(c.fts,websearch_to_tsquery('simple',public.dk_fold(p_query))) as lexical,
    case when p_vector is not null and c.embedding_model=p_model then 1-(c.embedding operator(extensions.<=>) p_vector) else 0 end as semantic
    from public.dk_chunks c join public.dk_documents d on d.id=c.document_id
    where d.project_id=p_project and d.state='ready' and c.revision=d.revision),
  lexical as (select id,row_number() over(order by lexical desc,id) r from candidates where lexical>0 order by lexical desc,id limit 30),
  semantic as (select id,row_number() over(order by semantic desc,id) r from candidates where semantic>0.25 order by semantic desc,id limit 30),
  hits as (select c.*,coalesce(1.0/(60+l.r),0)+coalesce(1.0/(60+s.r),0) score from candidates c left join lexical l using(id) left join semantic s using(id)
    where l.id is not null or s.id is not null order by score desc,c.id limit p_limit)
  select coalesce(jsonb_agg(to_jsonb(hits)-'lexical'-'semantic'),'[]'::jsonb) into result from hits;
  return result;
end $$;

-- Explicit grants avoid the default PUBLIC EXECUTE on security-definer functions.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dk\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
    if f.proname in ('dk_fold','dk_access','dk_create_project','dk_grant_member','dk_review_fact','dk_add_fact','dk_document_detail','dk_document_action','dk_financial_summary','dk_automatic_summary','dk_search','dk_record_usage') then
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
  end loop;
end $$;
-- Do not turn the new source bucket public, including when the migration is rerun.
insert into storage.buckets(id,name,public,file_size_limit) values('document-knowledge','document-knowledge',false,52428800)
  on conflict(id) do update set public=false;
commit;
