# Resolver 401 intermitente Hinova — Sessão compartilhada + retry + coordenação

## Problema
Cada chamada hoje faz `autenticarHinova` própria. Como Hinova é stateful (novo login invalida token anterior), com ~28 logins/min entre `sga-sync-financeiro-veiculo`, `cron-sga-reconciliar-codigo-veiculo` e outros, sessões em voo levam 401 "Login ou senha inválido". Resultado: 110 falhas 401 + 260 falhas de auth nos últimos minutos, travando o backfill (205.790 jobs pendentes).

## Solução — 3 camadas

### 1) Cache global de sessão em `_shared/hinova-client.ts`
- Adicionar singleton em escopo de módulo: `let cachedSession: { session, expiresAt } | null`.
- Nova função `getHinovaSession(supabase, { force?: boolean })`:
  - Se `cachedSession` válido (TTL 25 min) e não `force`, retorna o mesmo `tokenUsuario`.
  - Caso contrário, chama `getHinovaCreds` + `autenticarHinova` e cacheia.
  - Lock simples via `pendingAuthPromise` para evitar autenticações paralelas dentro da MESMA instância da Edge Function (várias `Promise.all` autenticando ao mesmo tempo).
- Como cada instância de Edge Function tem seu próprio módulo, o cache é **por instância**. Reduz ~95% dos logins (de ~28/min para ~1 a cada 25 min por instância ativa).

### 2) Auto-reautenticação em 401 dentro do client
- Criar wrapper `hinovaFetch(s, url, init, ctx)` que:
  - Faz a chamada normal.
  - Se resposta for 401/403 (e mensagem não for janela horária), invalida o cache (`cachedSession = null`), chama `getHinovaSession({ force: true })` UMA vez, e refaz a chamada com o novo `tokenUsuario`.
  - Se ainda 401, aí sim lança `HinovaTransientError`.
- Refatorar `buscarVeiculoPorPlaca`, `buscarSituacaoFinanceiraVeiculo`, `listarBoletosVeiculoJanela`, `buscarAssociadoComVeiculosPorCpf` para usarem `hinovaFetch` em vez de `fetch` direto.

### 3) Coordenação backfill ↔ crons
- Adicionar flag em `integracoes_config` (ou criar `sga_runtime_state`): `backfill_financeiro_ativo BOOLEAN DEFAULT false`, `backfill_iniciado_em TIMESTAMPTZ`.
- `sga-backfill-financeiro` seta `true` ao enfileirar/iniciar e `false` ao concluir/parar (ou TTL 60 min).
- Cron `cron-sga-reconciliar-codigo-veiculo` e `cron-sga-mapear-codigos-veiculos` checam a flag no início; se ativa, retornam `{ skipped: true, reason: 'backfill_ativo' }` sem rodar.
- Botão "Forçar sync agora" também desabilita crons via mesma flag.

## Arquivos afetados

```text
supabase/functions/_shared/hinova-client.ts          (refatoração principal)
supabase/functions/sga-sync-financeiro-veiculo/index.ts   (usar getHinovaSession)
supabase/functions/sga-testar-boletos-veiculo/index.ts    (usar getHinovaSession)
supabase/functions/sga-reconciliar-codigo-veiculo/index.ts (checar flag + cache)
supabase/functions/sga-mapear-codigos-veiculos/index.ts   (checar flag + cache)
supabase/functions/sga-backfill-financeiro/index.ts       (setar/limpar flag)
supabase/functions/hinova-diag-placa/index.ts             (usar getHinovaSession)
```

## Migração SQL

```sql
-- Tabela de estado de runtime do SGA (singleton)
CREATE TABLE IF NOT EXISTS public.sga_runtime_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backfill_financeiro_ativo boolean NOT NULL DEFAULT false,
  backfill_iniciado_em timestamptz,
  backfill_expira_em timestamptz, -- TTL 60min anti-deadlock
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.sga_runtime_state (backfill_financeiro_ativo) VALUES (false);
ALTER TABLE public.sga_runtime_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diretores podem gerenciar" ON public.sga_runtime_state
  FOR ALL USING (has_role(auth.uid(), 'diretor'));
```

## Validação após deploy
1. Deploy automático das 7 edge functions.
2. Clicar "Forçar sync agora" em /financeiro/cobrancas/recuperacao.
3. Em 5 min observar logs de `sga-sync-financeiro-veiculo`:
   - Esperado: ≤2 chamadas a `/usuario/autenticar` por instância.
   - Esperado: queda de erros "Hinova autenticação 401" para perto de 0.
4. Status do backfill deve começar a movimentar `concluido` (>38 atual) e `cobrancas_sga` (>0).

## Observações
- O cache é em memória da instância da edge function — não persiste entre cold starts, mas isso é OK: cold start gera 1 login, depois reusa.
- Não mexe em RLS, schema de cobranças nem na lógica de janelas de 90 dias já corrigida.
- Reversível: basta remover o singleton e voltar a chamar `autenticarHinova` direto.
