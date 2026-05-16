# Causa raiz dos documentos duplicados no SGA

## Diagnóstico

`sga-hinova-sync` monta a lista de documentos (`contratos_documentos` + `vistoria_fotos` + avatar + `pdf_assinado_url`) e chama `POST /veiculo/foto/cadastrar` toda vez que é executado — **sem nenhum controle de "já enviei essa foto"**.

Confirmado em produção para o veículo **KOU6D37** (placa da screenshot):
- 15/05 19:07 → `enviar_fotos` `success` (6 fotos)
- 15/05 19:21 → `enviar_fotos` `success` (6 fotos)
- Resultado: SGA recebeu 12 registros para os mesmos 6 arquivos. A screenshot mostra os mesmos PDFs/JPEGs repetidos às 09:15, 11:06 e 12:16 (3 execuções).

Por que o sync roda múltiplas vezes:
1. Triggers de pós-evento (autentique-webhook, concluir-instalacao-prestador, ativar-associado, cron-sga-retry, sga-reprocessar-cotacoes-ativacoes, process-integration-queue).
2. Retentativas após erro intermitente do Hinova (queue `upsertQueue`).
3. Ação manual "Reenviar SGA" no painel.

Não existe coluna `hinova_*` / `enviado_em` em `contratos_documentos` nem em `vistoria_fotos` — verifiquei `information_schema`. O Hinova também não rejeita duplicatas: aceita o mesmo `nome_arquivo`+`base64` e devolve sucesso sempre.

**Causa raiz**: ausência de idempotência no envio de fotos. Cada execução re-uploada o conjunto inteiro.

## Plano de correção

### 1. Tabela de auditoria de envios

```sql
CREATE TABLE public.sga_fotos_enviadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL,
  codigo_veiculo_hinova bigint NOT NULL,
  origem text NOT NULL,           -- 'contratos_documentos' | 'vistoria_fotos' | 'avatar' | 'pdf_assinado'
  origem_id text NOT NULL,        -- id do documento/foto/avatar/contrato
  arquivo_url text NOT NULL,
  arquivo_hash text,              -- sha256(url) para fallback
  codigo_tipo int NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  hinova_response jsonb,
  UNIQUE (veiculo_id, origem, origem_id)
);
CREATE INDEX ON public.sga_fotos_enviadas (veiculo_id);
-- RLS: somente service_role lê/escreve (sem policies = bloqueado para anon/auth)
ALTER TABLE public.sga_fotos_enviadas ENABLE ROW LEVEL SECURITY;
```

### 2. Filtro de dedupe em `sga-hinova-sync`

Antes de chamar `buildFotosPayload`:

- Carregar `SELECT origem, origem_id FROM sga_fotos_enviadas WHERE veiculo_id = _vid` → `Set<"origem:origem_id">`.
- Atribuir `origem` ao montar `documentosEntrada` (já faço hoje só pelo prefixo de id: `vist-`, `avatar-`, `termo-`). Mudar para passar `{origem, origem_id}` explícitos.
- Filtrar fora qualquer documento cujo par `origem:origem_id` já esteja no set.

### 3. Persistir cada envio bem-sucedido

No loop que chama `cadastrarFotosVeiculoHinova(lote)`, quando `r.ok`, fazer `insert` em `sga_fotos_enviadas` com um registro por foto do lote (origem, origem_id, arquivo_url, codigo_tipo, resposta). Usar `onConflict: 'veiculo_id,origem,origem_id'` `ignoreDuplicates: true` por segurança.

### 4. Reset opcional para casos legítimos

- Adicionar ação `forceResend?: boolean` no body do `sga-hinova-sync`: quando `true`, ignora o set de já-enviadas (caso operador realmente precise reenviar tudo).
- Botão "Reenviar tudo (forçar)" continua disponível no painel SGA — apenas o caminho automático fica idempotente.

### 5. Limpeza dos duplicados existentes no SGA

A API Hinova `/veiculo/foto/excluir` aceita lista de IDs. Não consta no diagnóstico se temos esses IDs salvos (não temos). Proposta:
- **Manual primeiro** no painel SGA para os casos já flagrados (KOU6D37 e similares).
- Documentar no `mem://` que duplicatas pré-correção precisam ser limpas manualmente.

### 6. Memória

Atualizar `mem://logic/integrations/sga-dia-vencimento-fonte` (ou criar `mem://logic/integrations/sga-fotos-idempotencia`) com a invariante: "Todo envio de foto para o Hinova deve ser registrado em `sga_fotos_enviadas` e filtrado antes do re-envio".

## Arquivos a tocar

- `supabase/migrations/<novo>.sql` — tabela `sga_fotos_enviadas`.
- `supabase/functions/sga-hinova-sync/index.ts` — filtro + insert pós-envio + flag `forceResend`.
- `supabase/functions/_shared/hinova-payloads.ts` — `DocumentoEntrada` ganha `origem` (opcional) ou permanece como está e o sync passa a montar tuplas separadas. Provavelmente mais limpo estender o tipo.
- `mem://logic/integrations/sga-fotos-idempotencia.md` + atualizar `mem://index.md`.

## Não escopo

- Não vamos deduplicar olhando hash do arquivo (custo de baixar para hashear). `(origem, origem_id)` é suficiente porque cada documento/foto físico tem id único em nossa base.
- Não vamos apagar duplicatas existentes no SGA via API automaticamente (sem ids confiáveis).
