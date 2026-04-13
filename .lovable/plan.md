

## Plano: Adicionar logs de Autentique, FIPE e demais APIs no Log de Requisições

### Problema
Os logs de chamadas às APIs Autentique, FIPE e plate-lookup não aparecem no "Log de Requisições" porque não existe tabela de log para essas Edge Functions — elas executam sem registrar.

### Solução
Criar uma tabela genérica de logs de Edge Functions e instrumentar as funções para gravar nela. Depois, incluir essa nova fonte no componente `LogRequisicoesTab`.

### Alterações técnicas

**1. Migration: criar tabela `edge_functions_logs`**
```sql
CREATE TABLE public.edge_functions_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  function_name text NOT NULL,
  plataforma text NOT NULL,        -- 'autentique', 'fipe', 'plate_lookup'
  operacao text NOT NULL,           -- 'create', 'status', 'cancel', 'lookup', etc.
  status text NOT NULL DEFAULT 'sucesso',  -- 'sucesso', 'erro'
  erro_mensagem text,
  tempo_resposta_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid
);

ALTER TABLE public.edge_functions_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diretores podem ver logs" ON public.edge_functions_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'));

CREATE INDEX idx_ef_logs_created ON public.edge_functions_logs(created_at DESC);
CREATE INDEX idx_ef_logs_plataforma ON public.edge_functions_logs(plataforma);
```

**2. Criar helper shared `supabase/functions/_shared/log-edge-function.ts`**
- Função utilitária que recebe `function_name`, `plataforma`, `operacao`, `status`, `erro`, `tempo_ms`, `metadata`, `user_id`
- Insere na tabela `edge_functions_logs` usando service role client
- Fire-and-forget (não bloqueia a resposta)

**3. Instrumentar Edge Functions (adicionar 2-3 linhas em cada)**
Funções a instrumentar (16 funções):
- `autentique-create`, `autentique-create-by-token`, `autentique-cancel`, `autentique-cancelamento-create`, `autentique-create-laudo`, `autentique-documento`, `autentique-download`, `autentique-evento-create`, `autentique-os-saida-create`, `autentique-resend`, `autentique-status`, `autentique-sync-contrato`, `autentique-vistoria-create`, `autentique-webhook`
- `fipe-lookup`, `plate-lookup`

Cada função ganha: import do helper, medição de tempo, chamada ao logger no final (sucesso ou erro).

**4. Atualizar `src/components/gestao-comercial/LogRequisicoesTab.tsx`**
- Adicionar tipo `Plataforma`: `'autentique' | 'fipe' | 'plate_lookup'`
- Adicionar entradas em `plataformaConfig` (Autentique = dourado/AT, FIPE = verde-escuro/FP, Consulta Placa = índigo/PL)
- Adicionar normalizer `normalizeEdgeFunction` para a nova tabela
- Adicionar cases no switch do fetcher para buscar da tabela `edge_functions_logs`
- Adicionar itens no `<SelectContent>` do filtro

### Escopo
- 1 migration (nova tabela)
- 1 novo arquivo shared helper
- ~16 Edge Functions instrumentadas (alteração mínima: import + 3 linhas)
- 1 componente frontend atualizado

