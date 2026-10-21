-- Checklist trước ca chỉ còn Ca 1 và Ca 2.

update public.kiem_tra_may_truoc_ca as a
set ca = 'Ca 2'
where ca = 'Ca 3'
  and not exists (
    select 1
    from public.kiem_tra_may_truoc_ca as b
    where b.may_id = a.may_id
      and b.ngay = a.ngay
      and b.ca = 'Ca 2'
      and b.id <> a.id
  );

delete from public.kiem_tra_may_truoc_ca
where ca = 'Ca 3';

alter table public.kiem_tra_may_truoc_ca
  drop constraint if exists kiem_tra_may_truoc_ca_ca_check;

alter table public.kiem_tra_may_truoc_ca
  add constraint kiem_tra_may_truoc_ca_ca_check
  check (ca in ('Ca 1', 'Ca 2'));

notify pgrst, 'reload schema';
