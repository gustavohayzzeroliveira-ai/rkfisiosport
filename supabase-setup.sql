-- Cole este script inteiro no SQL Editor do Supabase e clique em "Run".

create table if not exists app_data (
  key text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_data enable row level security;

-- Política simples: qualquer pessoa com a chave "anon" do projeto pode ler e
-- escrever. Isso é aceitável para um app pessoal com link não divulgado
-- publicamente, mas não é uma proteção real de acesso. Veja o README para
-- opções de reforçar a segurança (senha simples ou login).
create policy "allow all for anon" on app_data
  for all
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- Arquivos: bucket de armazenamento para fotos e arquivos de exames
-- anexados aos pacientes e sessões. Se você já rodou a parte de cima
-- antes (atualização do app), pode rodar só este bloco novo.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', true)
on conflict (id) do nothing;

create policy "allow all reads on arquivos" on storage.objects
  for select using (bucket_id = 'arquivos');

create policy "allow all uploads on arquivos" on storage.objects
  for insert with check (bucket_id = 'arquivos');

create policy "allow all deletes on arquivos" on storage.objects
  for delete using (bucket_id = 'arquivos');
