## Objetivo
Cada disparo de **template Meta WhatsApp** passa a gerar também um **e-mail equivalente** (Resend, função `send-email` já existente), entregue ao(s) destinatário(s) corretos baseados no e-mail cadastrado de cada usuário (associado, novo titular, antigo titular, técnico, diretor, agência, etc.) — sem duplicar lógica em cada uma das ~60 edge functions que enviam WhatsApp hoje.

## Estratégia: espelho automático no `whatsapp-send-text`

A função `whatsapp-send-text` é o ponto único por onde passam **todos** os disparos de template Meta (callers que usam `sendMetaTemplate` do shared OU invocam direto). Adicionando o espelho de e-mail nela, cobrimos os 60+ pontos sem tocar em cada caller.

### Mudanças

#### 1. Tabela `whatsapp_meta_templates` — colunas novas (migration)
- `enviar_por_email boolean not null default true` — switch global por template
- `email_assunto text` — assunto opcional (se nulo, usa primeira linha do `corpo` ou `header_texto`)
- `email_template_alias text` — quando preenchido, usa um dos templates curados de `send-email` em vez do shell genérico (ex: `boleto-vencendo`, `boas-vindas`, `acesso-associado`, `recuperacao-senha`)

#### 2. Nova tabela `notificacoes_email_log` (migration)
Idempotência + auditoria:
- `id uuid pk`, `template_name text`, `recipient_email text`, `referencia_tipo text`, `referencia_id text`, `params jsonb`, `resend_id text`, `status text`, `error text`, `created_at timestamptz default now()`
- Índice único parcial `(template_name, recipient_email, referencia_tipo, referencia_id) where status='enviado'` para evitar duplicar quando o mesmo evento dispara WhatsApp duas vezes (retry).

#### 3. `supabase/functions/_shared/resolver-emails-destinatario.ts` (novo)
Resolve a lista de e-mails a partir do contexto do disparo (caller já fornece tudo isso hoje):
- **Por telefone (default)** — `associados.email` onde `telefone`/`whatsapp`/`celular` casa com o telefone normalizado; fallback `profiles.email` por telefone.
- **Por `referencia_tipo`** — regras específicas:
  - `solicitacao_troca_titularidade` → e-mails de **associado novo + associado antigo** (lê `solicitacoes_troca_titularidade.associado_origem_id` / `associado_destino_id` → `associados.email`)
  - `solicitacao_substituicao` → associado origem + associado destino
  - `sinistro` / `assistencia_chamado` → associado dono + (se template inclui `diretoria`) diretores
  - `instalacao` / `vistoria` / `servico` → associado + técnico (`profiles.email` do `tecnico_id`)
  - `cobranca` / `boleto` → associado
  - `cotacao` → solicitante (`cotacoes.email`) + vendedor (`vendedores`/`profiles`)
  - `agencia` / `vendedor` → e-mail do próprio
- **Por nome do template** — heurística complementar:
  - `*_diretoria*` → adiciona lista de diretores (e-mails de `profiles` cujo `user_id` tem `user_roles.role IN ('admin','diretor','desenvolvedor','admin_master')`)
  - `*_tecnico*` / `instalador_*` → e-mail do técnico atribuído (extraído de `referencia_id`)
- Sempre dedup, valida formato (regex), retorna `string[]`.

#### 4. `supabase/functions/_shared/render-email-from-meta.ts` (novo)
Recebe `template_name`, `template_params[]`, `template_button_params[]` e:
1. Busca `corpo`, `header_texto`, `email_assunto`, `email_template_alias` em `whatsapp_meta_templates`.
2. Substitui `{{1}}..{{N}}` no `corpo` pelos params.
3. Converte texto → HTML (linebreaks → `<br>`, negritos `*texto*` → `<strong>`, links → `<a>`).
4. Se `email_template_alias` preenchido → retorna `{ template: alias, data: {...} }` para a função `send-email` usar o template curado (mesmo dado dos params já mapeado por nome — tabela auxiliar inline para os 6-8 templates importantes).
5. Caso contrário → retorna `{ template: 'generico', data: { titulo, conteudo: html, linkUrl?: buttonParam, linkTexto: 'Acessar' } }`.
6. Assunto: `email_assunto` ou primeira linha do corpo (sem emojis) ou `header_texto` ou `"PRATIC — <template_name>"`.

#### 5. Patch em `supabase/functions/whatsapp-send-text/index.ts`
Após o WhatsApp ser enviado com sucesso (e somente quando `template_name` está presente):
```ts
if (success && template_name) {
  EdgeRuntime.waitUntil(
    espelharEmail({
      supabase, telefone, template_name,
      template_params, template_button_params,
      referencia_tipo, referencia_id,
    })
  );
}
```
A função `espelharEmail`:
1. Busca o template; se `enviar_por_email=false`, retorna.
2. Resolve e-mails (helper #3); se vazio, loga e retorna.
3. Para cada e-mail: confere `notificacoes_email_log` (idempotência); renderiza (helper #4); invoca `send-email` (Service Role, sem precisar de `Authorization` do caller — ajustar `send-email` para aceitar `apikey` do service role além do JWT do usuário); grava log.
4. Erros nunca quebram o fluxo principal — só logam.

#### 6. Pequeno ajuste em `supabase/functions/send-email/index.ts`
Hoje exige `Authorization: Bearer <user JWT>`. Aceitar também chamada **server-to-server** com `SUPABASE_SERVICE_ROLE_KEY` (caller `whatsapp-send-text` rodando no Edge), liberando o uso interno. Mantém o guard atual para chamadas com user JWT.

#### 7. UI mínima (Configurações › Integrações › WhatsApp)
Adicionar coluna **"E-mail"** no SeletorTemplate / lista de templates Meta:
- Toggle `enviar_por_email`
- Campos `email_assunto` e `email_template_alias` (select com aliases conhecidos)

#### 8. Variável de ambiente
- `EMAIL_FROM` (já existe, opcional)
- `EMAIL_MIRROR_ENABLED` (default `true`) — kill-switch global de emergência.

## Não incluído (por escolha)
- Não modificamos as 60+ edge functions individuais.
- Não enviamos e-mail para mensagens **livres** (sem `template_name`) — só para templates Meta, alinhado ao pedido.
- Não enviamos e-mail quando o WhatsApp falha (mantém paridade exata com o template enviado).
- Não tocamos em fluxos de e-mail já existentes (boas-vindas, primeiro acesso, recuperação de senha, etc.).

## Validação
1. Migration aplicada → colunas e tabela criadas.
2. Disparar manualmente um template (ex.: aprovar uma cotação que dispara `cadastro_aprovado_botao`) e verificar:
   - WhatsApp chega normalmente.
   - `notificacoes_email_log` tem linha `enviado` para `associados.email`.
   - E-mail chega na caixa do associado com mesmo conteúdo.
3. Disparar `autorizacao_fipe_diretoria_v4` e confirmar que **todos os diretores** com e-mail recebem.
4. Disparar template de troca de titularidade — confirmar e-mail tanto para associado origem quanto destino.
5. Reexecutar mesmo evento (retry) — segundo e-mail é bloqueado por idempotência.
6. Setar `enviar_por_email=false` em um template e confirmar que e-mail é pulado.
