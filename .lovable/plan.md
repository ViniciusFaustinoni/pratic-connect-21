# Aba E-mails em Relacionamento — fase 1 (UI + persistência)

Escopo estrito: criar a interface e persistir template + toggle + estrutura de histórico. **Nenhuma** integração com fluxos de suspensão ou Resend nesta fase.

## 1. Backend (migration única)

Três tabelas novas, todas restritas a `admin_master` / `diretor` via `has_role()`.

### `email_suspensao_config`
Linha única (singleton). Guarda o toggle global.
- `enabled boolean default false`
- `updated_by uuid`, timestamps

### `email_suspensao_template`
Linha única (singleton) com o template editável.
- `assunto text`
- `corpo text` (texto/HTML com `{{nome_cliente}}`, `{{motivo_suspensao}}`, `{{data}}`)
- `updated_by uuid`, timestamps
- Seed inicial com o assunto/corpo fornecidos no briefing

### `email_suspensao_envios` (estrutura pronta, fica vazia)
- `cliente_nome text`, `cliente_id uuid null`
- `destinatario text`
- `fluxo_origem text` (ex.: `suspensao_inadimplencia`, `suspensao_48h`, etc. — livre por enquanto)
- `assunto_enviado text`, `corpo_renderizado text`
- `status text check in ('pendente','entregue','falhou')` default `'pendente'`
- `erro_mensagem text null`
- `enviado_em timestamptz default now()`
- Índices: `(status)`, `(fluxo_origem)`, `(enviado_em desc)`, `(destinatario)`

### Grants + RLS
Todas as 3 tabelas:
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;` (sem anon)
- RLS ligada; policies SELECT/INSERT/UPDATE/DELETE liberadas só para `has_role(auth.uid(),'admin_master')` OR `has_role(auth.uid(),'diretor')`

## 2. Frontend

### Rota e navegação
- `src/App.tsx`: nova rota `/relacionamento/emails` → `EmailsRelacionamento` (lazy)
- `src/components/layout/AppSidebar.tsx`: novo item `{ title: 'E-mails', url: '/relacionamento/emails', icon: Mail }` no grupo `relacionamento`, **renderizado apenas quando o usuário é admin_master/diretor** (guard via `useUserRoles` ou padrão existente no projeto — verificar como outros itens admin-only fazem)

### Páginas / componentes (`src/pages/relacionamento/emails/`)
- `EmailsRelacionamento.tsx` — guard de acesso (admin_master/diretor; redireciona para `/acesso-negado` caso contrário) + Tabs com 2 abas: **Template** e **Histórico**. Toggle global no topo (acima das tabs).
- `components/ToggleEnvioSuspensao.tsx` — Switch + label "Enviar e-mail em suspensões" lendo/gravando `email_suspensao_config`.
- `components/TemplateEditor.tsx` — Input assunto, Textarea corpo, botões inserir variável (`{{nome_cliente}}`, `{{motivo_suspensao}}`, `{{data}}`), botão salvar, painel de pré-visualização com dados de exemplo (substituição simples por replace).
- `components/HistoricoEnvios.tsx` — ListToolbar (busca por nome/e-mail) + selects de filtro (status, fluxo) + tabela paginada (reaproveitar `ServerPagination`). Empty state explicando que só popula quando o envio real for ligado.
- `components/EnvioDetalheDialog.tsx` — Dialog com assunto enviado, corpo renderizado, erro (se houver) e botão **Reenviar** desabilitado com tooltip "Disponível após integração com o envio real".

### Hooks (`src/hooks/emails-suspensao/`)
- `useEmailSuspensaoConfig` — get + mutation update
- `useEmailSuspensaoTemplate` — get + mutation update
- `useEmailSuspensaoEnvios({ search, status, fluxo, page })` — query paginada
- `useEmailSuspensaoEnvio(id)` — detalhe

Todos com invalidation via React Query.

## 3. Fora de escopo (fase posterior, não tocar agora)
- Edge function de envio / integração Resend
- Leitura do toggle pelos fluxos de suspensão existentes
- Reenvio real (botão fica desabilitado)
- Mudanças em qualquer fluxo de suspensão atual

## Critérios de aceite
- `/relacionamento/emails` acessível somente a admin_master/diretor; demais perfis recebem 403/acesso negado e o item nem aparece no sidebar.
- Template inicial já vem populado (seed) com o assunto/corpo do briefing.
- Salvar template e alternar toggle persiste e sobrevive a reload.
- Pré-visualização substitui as 3 variáveis por dados de exemplo.
- Histórico renderiza vazio sem erros, com filtros e paginação funcionais.
- Nenhum fluxo de suspensão existente é modificado.
