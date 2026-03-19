

# Fix: Imprevisto Caindo em Limbo + Tela Branca ao Reabrir App

## Problema 1: Imprevisto em Limbo

Quando o instalador registra um imprevisto, o fluxo tem 2 passos separados:
1. `ImprevistoBotao` grava `imprevisto_registrado_em` no serviço (status permanece inalterado)
2. `DuploCheckImprevisto` muda o status para `nao_compareceu`

Se o app fecha/trava entre os passos 1 e 2, a tarefa fica num limbo: tem `imprevisto_registrado_em` preenchido mas status ainda é `em_andamento`. A query de tarefa atual filtra `imprevisto_registrado_em IS NULL`, então a tarefa some do instalador. Mas nenhum outro processo a resgata.

## Problema 2: Tela Branca ao Reabrir App

O app (PWA/Capacitor) não tem listener de `visibilitychange`. Quando o app fica em background e o token Supabase expira, ao reabrir a sessão pode não ser restaurada corretamente, resultando em tela branca permanente (loading infinito).

---

## Solução 1: Imprevisto Atômico + CRON de Recuperação

### 1a. Tornar o passo 1 atômico (`ImprevistoBotao.tsx`)

Ao registrar o imprevisto, já mudar o status para `imprevisto_pendente` (ou manter `nao_compareceu` direto se o duplo check for dispensável). Isso garante que mesmo se o app fechar, o serviço sai do estado ativo.

Alterar o update em `handleRegistrar` para incluir `status: 'imprevisto_pendente'` junto com `imprevisto_registrado_em`.

### 1b. Duplo Check continua normalmente (`DuploCheckImprevisto.tsx`)

Quando o duplo check é confirmado, muda de `imprevisto_pendente` para `nao_compareceu` (como já faz).

### 1c. Atualizar query de tarefa atual (`useTarefaAtual.ts`)

No fallback, além de filtrar `imprevisto_registrado_em IS NULL`, também excluir status `imprevisto_pendente` e `nao_compareceu` da lista de status ativos.

### 1d. CRON de recuperação (`cron-reagendamento-automatico`)

Adicionar lógica para detectar serviços com `imprevisto_registrado_em` preenchido mas que ainda estão em status ativo (`em_andamento`, `em_rota`, `agendada`) por mais de 30 minutos. Automaticamente mudar para `nao_compareceu` e enviar link de reagendamento.

### 1e. Limpar `profissional_id` ao marcar `nao_compareceu`

No `DuploCheckImprevisto`, ao confirmar, também definir `profissional_id: null` para liberar o instalador de qualquer vínculo com a tarefa.

---

## Solução 2: Recuperação de Tela Branca

### 2a. Listener de visibilidade (`src/hooks/useAppResume.ts`)

Criar hook que escuta `visibilitychange` e `focus`. Quando o app volta ao foreground:
- Verifica se a sessão Supabase ainda é válida com `supabase.auth.getSession()`
- Se o token expirou, tenta `refreshSession()`
- Se falhar, redireciona para login
- Se a sessão estiver ok, invalida queries stale para atualizar dados

### 2b. Integrar no InstaladorLayout

Usar o hook `useAppResume` dentro do `InstaladorLayout` para garantir que o app do instalador se recupere automaticamente.

### 2c. Timeout de loading no InstaladorGuard

Adicionar timeout de 10s no estado de loading. Se loading > 10s, tentar refresh da sessão; se > 20s, forçar redirect para login.

---

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `src/components/vistoriador/ImprevistoBotao.tsx` | Status atômico ao registrar imprevisto |
| `src/components/vistoriador/DuploCheckImprevisto.tsx` | Limpar `profissional_id` no duplo check |
| `src/hooks/useTarefaAtual.ts` | Excluir `imprevisto_pendente` dos status ativos |
| `supabase/functions/cron-reagendamento-automatico/index.ts` | Recuperar imprevistos órfãos |
| `src/hooks/useAppResume.ts` | Novo hook para recuperação ao reabrir app |
| `src/components/instalador/InstaladorLayout.tsx` | Integrar `useAppResume` |
| `src/components/instalador/InstaladorGuard.tsx` | Timeout de loading com recovery |

