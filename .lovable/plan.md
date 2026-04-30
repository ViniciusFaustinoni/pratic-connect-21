# Aba OCR em Logs de Auditoria

## Objetivo

Hoje os logs do `document-ocr` só vivem nos logs do Supabase (efêmeros, difíceis de cruzar com associado/cotação). Vamos persistir cada execução em tabela própria e exibi-la em uma nova aba na tela `Diretoria > Logs de Auditoria`, permitindo que a Diretoria investigue rapidamente falhas de leitura (CPF errado, truncamento, fallback acionado, etc.).

## O que será entregue

1. **Tabela nova `ocr_execution_logs`** — uma linha por chamada do `document-ocr`, com tudo que importa para debug:
   - `req_id`, `created_at`, `usuario_id` (se autenticado), `cotacao_id`/`associado_id` (quando o caller passar)
   - `tipo_esperado`, `tipo_detectado`, `arquivo_url_hash`, `mime`, `bytes`, `is_pdf`, `has_native_text`, `native_text_len`
   - `provider`, `modelo`, `latency_ms`, `usage` (jsonb com input/output tokens)
   - `confianca`, `legivel`, `sugestao` (`aprovar`/`revisar`/`reprovar`), `sucesso`
   - `truncated` (bool — finish_reason=length/max_tokens), `used_retry`, `used_native_fallback`, `cpf_corrigido_via` (`native`/`retry`/`permutacao`/null)
   - `dados_extraidos` (jsonb), `motivo` (texto), `erro` (texto quando falhou)
   - `status` derivado: `sucesso`, `revisar`, `falha`, `truncado`

2. **Edge function `document-ocr` instrumentada para gravar 1 linha ao final** de cada execução (sucesso, fallback ou erro), reaproveitando os dados que já calculamos. Sem mudar contrato da função — o caller pode opcionalmente enviar `cotacao_id` e `associado_id` no body para enriquecer o log.

3. **Nova aba "OCR" na página `/diretoria/logs`** com:
   - Filtros: status (todos/sucesso/revisar/falha/truncado), tipo de documento (CNH/CRLV/RG/...), provider, busca por CPF/ID/req_id, data início/fim
   - Tabela: data, usuário, tipo detectado, status (badge colorido), confiança, modelo, latência
   - Linha expansível com: dados extraídos, motivo do erro, indicação se houve fallback nativo, dados do retry, link para o documento original (quando autenticado)
   - Cards de métricas no topo: total últimas 24h, taxa de sucesso, taxa de truncamento, latência média
   - Botão Exportar CSV

4. **RLS:** apenas Diretor/Admin lê (mesmo padrão dos demais logs). Edge function escreve via service role.

## Detalhes técnicos

**Migration nova:**
```sql
create table public.ocr_execution_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  req_id text,
  usuario_id uuid references auth.users(id) on delete set null,
  cotacao_id uuid,
  associado_id uuid,
  tipo_esperado text,
  tipo_detectado text,
  arquivo_url_hash text,
  mime text,
  bytes integer,
  is_pdf boolean default false,
  has_native_text boolean default false,
  native_text_len integer default 0,
  provider text,
  modelo text,
  latency_ms integer,
  usage jsonb,
  confianca numeric,
  legivel boolean,
  sugestao text,
  sucesso boolean,
  truncated boolean default false,
  used_retry boolean default false,
  used_native_fallback boolean default false,
  cpf_corrigido_via text,
  status text,            -- 'sucesso' | 'revisar' | 'falha' | 'truncado'
  motivo text,
  erro text,
  dados_extraidos jsonb
);
create index on public.ocr_execution_logs (created_at desc);
create index on public.ocr_execution_logs (status, created_at desc);
create index on public.ocr_execution_logs (tipo_detectado);
create index on public.ocr_execution_logs (cotacao_id);
alter table public.ocr_execution_logs enable row level security;
create policy "Diretor/Admin lê logs OCR" on public.ocr_execution_logs
  for select using (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'diretor'));
create policy "Service role escreve logs OCR" on public.ocr_execution_logs
  for insert with check (true);
```

**Edge function:** ao final de `document-ocr/index.ts` (em todos os caminhos: sucesso, fallback, erro), insere 1 linha. Usa `try/catch` para nunca quebrar a resposta principal por causa do log.

**Frontend:** novo componente `OcrLogsTab.tsx` em `src/components/diretoria/` consumido por uma nova aba na `LogsAuditoria.tsx` (já tem estrutura de `Tabs`).

## Fora de escopo

- Não vamos retrabalhar UI existente (Hierarquia, Todos os logs).
- Não vamos persistir o conteúdo binário do documento — apenas hash da URL + metadados.
- Se a tabela crescer muito, criar política de retenção (ex.: 90 dias) entrará em iteração futura — não bloqueia este entregável.
