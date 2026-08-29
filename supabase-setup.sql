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
