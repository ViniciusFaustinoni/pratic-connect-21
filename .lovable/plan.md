

# Implementar Regras de Inadimplencia -- Suspensao, Revistoria, SPC e Exclusao

## Resumo das Lacunas

O sistema atual tem partes da logica, mas nao segue as regras operacionais descritas. Segue o mapeamento:

| Regra | Estado Atual | Precisa Mudar |
|-------|-------------|---------------|
| Suspensao no dia 1 | Suspende apos 7 dias (configuravel) | Alterar para 0 dias de carencia |
| Ate 5 dias: paga e volta | Reativa sempre que paga, sem condicao | Adicionar verificacao de dias de atraso |
| 6+ dias: paga + revistoria | Nao existe essa condicao | Bloquear reativacao automatica se atraso > 5 dias |
| 30+ dias: SPC | Existe como alerta manual apenas | Adicionar flag/marcacao automatica |
| 120+ dias: exclusao | Nao existe | Criar logica no cron |

## Alteracoes

### 1. Cron de Suspensao -- Suspender Imediatamente (dia 1)

**Arquivo**: `supabase/functions/cron-suspender-inadimplentes/index.ts`

- Alterar `DIAS_CARENCIA_PADRAO` de `7` para `0` (suspensao no dia seguinte ao vencimento)
- Isso ja e configuravel pela tabela `configuracoes`, entao basta mudar o default

### 2. Webhook Asaas -- Reativacao Condicional por Dias de Atraso

**Arquivo**: `supabase/functions/asaas-webhook/index.ts`

Na logica de reativacao (linhas 602-662), ao invés de reativar direto quando `cobrancasPendentes === 0`:

- Calcular `diasAtraso` usando `data_bloqueio` do associado
- Se `diasAtraso <= 5`: reativar automaticamente (janela de tolerancia)
- Se `diasAtraso > 5`: NAO reativar. Marcar `status = 'suspenso'` com flag `revistoria_pendente = true`. Notificar associado que precisa fazer revistoria para reativar
- Se `diasAtraso >= 120`: NAO reativar. Manter como exclusao (ver item 4)

### 3. Cron de Exclusao Automatica aos 120 dias

**Novo arquivo**: `supabase/functions/cron-excluir-inadimplentes-120/index.ts`

Criar edge function que roda diariamente e:
- Busca associados com `status = 'suspenso'` e `data_bloqueio` ha 120+ dias
- Altera status para `cancelado` com `tipo_saida = 'inadimplencia'` e `pode_reativar = true`
- Cancela recorrencia no Asaas
- Registra historico
- Notifica associado sobre exclusao

### 4. Cron de Marcacao SPC aos 30 dias

**Novo arquivo**: `supabase/functions/cron-marcar-candidatos-spc/index.ts`

Criar edge function que:
- Busca associados suspensos com `data_bloqueio` ha 30+ dias
- Cria registro na tabela `negativacoes` (ja existe) com status `elegivel`
- Notifica setor de cobranca

### 5. Frontend -- Campo `revistoria_pendente` na Reativacao

**Arquivo**: `src/components/app/RevistoriaBanner.tsx`

Ja existe e funciona com base em `diasAtraso`. Apenas garantir que o campo `revistoria_pendente` do banco seja lido corretamente.

**Arquivo**: `src/pages/app/RevistoriaPage.tsx` (se existir)

Garantir que a revistoria use o tipo "REVISTORIA" (nomenclatura diferente de "INSTALACAO") para visualizacao posterior.

### 6. Adicionar coluna `revistoria_pendente` na tabela associados

**Nova migration SQL**:

```text
ALTER TABLE associados
ADD COLUMN IF NOT EXISTS revistoria_pendente boolean DEFAULT false;
```

Essa coluna sera usada pelo webhook (item 2) para bloquear reativacao automatica e pelo app do associado para exibir o banner de revistoria.

## Arquivos Alterados/Criados

| Arquivo | Acao |
|---|---|
| `supabase/functions/cron-suspender-inadimplentes/index.ts` | Alterar carencia para 0 dias |
| `supabase/functions/asaas-webhook/index.ts` | Reativacao condicional por dias de atraso |
| `supabase/functions/cron-excluir-inadimplentes-120/index.ts` | **NOVO** - Exclusao automatica 120 dias |
| `supabase/functions/cron-marcar-candidatos-spc/index.ts` | **NOVO** - Marcacao SPC 30 dias |
| Nova migration SQL | Adicionar coluna `revistoria_pendente` |

## Fluxo Resultante

```text
Dia 0: Venceu e nao pagou
  |
  v
Dia 1: SUSPENSO automaticamente (cron diario)
  |
  +-- Pagou ate dia 5? --> Reativa automaticamente (webhook)
  |
  +-- Pagou apos dia 5? --> Marca revistoria_pendente = true
  |                          Associado faz revistoria no app
  |                          Aprovacao reativa manualmente
  |
  +-- Dia 30: Marcado como candidato SPC (cron)
  |
  +-- Dia 120: EXCLUIDO automaticamente (cron)
              tipo_saida = 'inadimplencia'
              pode_reativar = true (como cliente novo)
```

