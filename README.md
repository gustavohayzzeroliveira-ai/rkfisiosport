# RKFisioSport — Prontuários

## Novidades desta versão

- **Bug do Google Agenda corrigido**: a data "hoje" do app era calculada em
  UTC, então à noite (depois das ~21h em Brasília) o app já achava que era
  o dia seguinte — e isso bagunçava as datas de sessões repetidas
  (semanais, quinzenais, personalizadas). Agora a data usa sempre o fuso
  local do navegador.
- **Escala EVA, SpO2 e FC**: no lugar do IMC, cada sessão realizada agora
  tem espaço para anotar a escala de dor EVA (0 a 10), a saturação de
  oxigênio (SpO2) e a frequência cardíaca (FC).
- **Plano compartilhado**: dá pra colocar duas ou mais pessoas no mesmo
  pacote de sessões (por exemplo, casal ou família dividindo o mesmo
  plano). No prontuário do paciente, use o botão **Compartilhar plano**
  para escolher com quem ele divide o pacote — as sessões de qualquer um
  deles passam a contar para o mesmo total, e renovar o plano de um
  renova de todo mundo do grupo junto.



- **Trocar horário fácil**: cada sessão (mesmo já marcada) tem um botão
  **Trocar horário**, tanto no prontuário do paciente quanto na aba
  **Agenda**. O app não deixa salvar um horário que já esteja ocupado por
  outro paciente — mostra quem está lá e pede pra escolher outro.
- **Repetição personalizada**: além de semanal e a cada 15 dias, dá pra
  marcar sessões recorrentes escolhendo exatamente quais dias da semana
  (ex.: toda segunda, quarta e sexta) e quantas sessões no total.
- **Pressão arterial e IMC por sessão**: toda sessão marcada como
  "realizada" ganhou um campo para anotar a pressão arterial e o IMC
  daquele dia (com um atalho para calcular o IMC a partir da altura/peso
  do prontuário, se já estiverem preenchidos).
- **Correções**: botão de editar prontuário agora tem "Cancelar" (antes não
  dava pra desistir da edição sem salvar); exclusão de sessão e de
  arquivos agora pede confirmação; pequeno ajuste visual nos botões.



## Novidades desta versão

- **Renovação de plano**: quando o pacote de sessões de um paciente termina
  (ou a qualquer momento), dá para clicar em **Renovar plano** e começar um
  novo ciclo com um novo total de sessões. O histórico do plano anterior fica
  salvo em "ciclos anteriores" — nada é apagado.
- **Sessões minimizadas**: sessões já finalizadas ficam recolhidas por
  padrão, num resumo "X sessão(ões) já finalizada(s)". Clique para abrir e
  ver a evolução clínica completa e os arquivos daquela sessão.
- **Paciente avulso (sem plano)**: ao cadastrar (ou editar) um paciente, dá
  para escolher **Sessão avulsa (sem plano)** — para quem não tem pacote
  fechado, mas você ainda precisa registrar as sessões e evoluções dele.
- **Fotos e arquivos de exames**: tanto no prontuário geral do paciente
  quanto em cada sessão, dá para anexar fotos e arquivos (PDF, imagens,
  Word). Ficam guardados no Supabase Storage e aparecem como miniaturas,
  clicáveis para abrir/baixar.
- **Prontuário completo na impressão**: a versão impressa (botão
  **Imprimir**) agora mostra todo o texto escrito e a lista de arquivos
  anexados de cada sessão, mesmo que ela esteja minimizada na tela.

Se você já tinha o app publicado antes dessa atualização, depois de subir o
código novo, rode de novo o `supabase-setup.sql` no **SQL Editor** do
Supabase — ele detecta o que já existe e só cria o que falta (o bucket de
arquivos `arquivos`, usado pelas fotos e exames).

---

App de prontuário e controle de sessões para a clínica. Este pacote já vem
pronto para publicar num link próprio, acessível de qualquer computador,
celular ou tablet, com os dados sincronizados entre eles.

Você vai usar dois serviços gratuitos:

- **Supabase** — guarda os dados (pacientes e sessões) na nuvem.
- **Vercel** — hospeda o site e te dá um link público.

Nenhum dos dois pede cartão de crédito no plano gratuito.

---

## Parte 1 — Criar o banco de dados no Supabase

1. Acesse **https://supabase.com** e crie uma conta (dá para entrar direto
   com o Google).
2. Clique em **New project**.
   - Dê um nome, ex: `rkfisiosport`.
   - Crie uma senha de banco de dados (guarde num lugar seguro, mas você
     não vai precisar dela no dia a dia).
   - Escolha a região mais próxima (ex: São Paulo / South America).
   - Clique em **Create new project** e espere ~1 minuto.
3. No menu lateral, clique em **SQL Editor** → **New query**.
4. Abra o arquivo `supabase-setup.sql` (está junto com este projeto), copie
   todo o conteúdo, cole no editor e clique em **Run**.
   - Isso cria a tabela `app_data`, que é onde ficam salvos todos os
     pacientes e sessões.
5. No menu lateral, clique em **Project Settings** (ícone de engrenagem) →
   **API**.
   - Copie o valor de **Project URL** — isso é o `VITE_SUPABASE_URL`.
   - Copie o valor de **anon public** (uma chave longa) — isso é o
     `VITE_SUPABASE_ANON_KEY`.
   - Guarde os dois, você vai usar em seguida.

---

## Parte 2 — Colocar o projeto no GitHub

A forma mais simples de publicar na Vercel é a partir de um repositório no
GitHub.

1. Crie uma conta em **https://github.com** (se ainda não tiver).
2. Clique em **New repository**, dê um nome (ex: `rkfisiosport`) e crie
   (pode deixar como privado).
3. No seu computador, extraia o arquivo `.zip` deste projeto numa pasta.
4. Suba o código para o GitHub. Duas formas:
   - **Mais fácil:** na página do repositório recém-criado no GitHub, use o
     botão **uploading an existing file** e arraste todos os arquivos da
     pasta (exceto `node_modules`, que nem deve existir ainda).
   - **Via terminal** (se tiver git instalado):
     ```
     cd rkfisiosport
     git init
     git add .
     git commit -m "primeira versão"
     git branch -M main
     git remote add origin https://github.com/SEU-USUARIO/rkfisiosport.git
     git push -u origin main
     ```

---

## Parte 3 — Publicar na Vercel

1. Acesse **https://vercel.com** e crie uma conta usando o **mesmo login do
   GitHub** (fica mais simples).
2. Clique em **Add New** → **Project**.
3. Selecione o repositório `rkfisiosport` que você acabou de subir e clique
   em **Import**.
4. Na tela de configuração:
   - **Framework Preset**: deixe em `Vite` (a Vercel costuma detectar
     sozinha).
   - Abra a seção **Environment Variables** e adicione as duas chaves que
     você copiou do Supabase:
     | Name | Value |
     |---|---|
     | `VITE_SUPABASE_URL` | (cole o Project URL) |
     | `VITE_SUPABASE_ANON_KEY` | (cole a chave anon public) |
     | `VITE_GOOGLE_CLIENT_ID` | (Client ID do Google Cloud, veja abaixo) |
     | `VITE_GOOGLE_ALLOWED_EMAIL` | `kanu.hayzzer@gmail.com` |
5. Clique em **Deploy** e espere 1–2 minutos.
6. Pronto! A Vercel te dá um link do tipo
   `https://rkfisiosport.vercel.app` — esse é o endereço do seu app.

Abra esse link em qualquer celular, tablet ou computador: todos vão ver e
editar os **mesmos** pacientes, porque os dados ficam salvos no Supabase, não
no aparelho.

---

## Colocar seu próprio domínio (opcional)

Se você tiver ou comprar um domínio (ex: `rkfisiosport.com.br`):

1. No projeto dentro da Vercel, vá em **Settings** → **Domains**.
2. Digite seu domínio e siga as instruções para apontar o DNS (a Vercel
   mostra exatamente quais registros criar no painel do seu provedor de
   domínio).

---

## Sobre segurança e privacidade

Este app guarda dados de pacientes, então vale um cuidado extra:

- O link gerado (`https://rkfisiosport.vercel.app`) **não é indexado no
  Google** e só quem tiver o link consegue abrir — mas qualquer pessoa com
  o link consegue ver e editar os prontuários, não existe login por padrão.
- Para uso só seu/da clínica, o ideal é: não compartilhar o link, e
  considerar deixar o projeto na Vercel como **privado**.
- Se quiser um login com senha (recomendado para dados de saúde), posso te
  ajudar a adicionar autenticação do próprio Supabase (login por e-mail e
  senha) numa próxima etapa — é uma mudança pequena no código.

---

## Testar no seu computador antes de publicar (opcional)

Se quiser rodar localmente antes de subir para a Vercel:

1. Tenha o **Node.js** instalado (https://nodejs.org, versão LTS).
2. Copie `.env.example` para um arquivo chamado `.env` e preencha com suas
   chaves do Supabase.
3. No terminal, dentro da pasta do projeto:
   ```
   npm install
   npm run dev
   ```
4. Abra o endereço que aparecer no terminal (geralmente
   `http://localhost:5173`).

---

## Estrutura do projeto

```
rkfisiosport/
├── index.html
├── package.json
├── vite.config.js
├── supabase-setup.sql      ← script para rodar no Supabase
├── .env.example             ← modelo das variáveis de ambiente
└── src/
    ├── main.jsx
    ├── supabaseClient.js    ← conexão com o Supabase
    └── App.jsx               ← o app inteiro (telas, lógica, cores)
```
