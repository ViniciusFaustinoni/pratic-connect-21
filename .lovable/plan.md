## Diagnóstico — caso LTG3H67 (JEFFERSON RICARDO)

Confirmado no banco:
- Cotação `d35f9447…` criada em 26/04/2026 com `dia_vencimento = NULL`
- `contrato-gerar` aplicou fallback hardcoded **10**
- Constraint do banco aceita 1..31, então o `10` passou direto
- Pela regra de `calcularOpcoesVencimento(26)` = `[30, 5]`, o `10` é **inválido** para essa data de cadastro

**Causa raiz**: o consultor consegue salvar a cotação **sem clicar em nenhuma das duas opções de vencimento**. O front (`CotacaoFormDialog.tsx`) inicia `diaVencimento = null`, não trava o submit, e o backend (`contrato-gerar`, `termo-afiliacao-utils`) tem fallback `|| 10` — sempre dia 10, independente da data de cadastro.

**Impacto**: 26 cotações nos últimos 90 dias salvas com `dia_vencimento = NULL` — todas geraram contrato com vencimento 10 silenciosamente, mesmo quando 10 não estava entre as opções válidas (caso do LTG3H67).

---

## Plano de correção (defesa em profundidade)

### 1. Frontend — bloquear envio sem vencimento escolhido
`src/components/cotacoes/CotacaoFormDialog.tsx`
- Tornar o card "Data de Vencimento" obrigatório: validar `diaVencimento !== null` antes de submeter, com toast claro ("Selecione o dia de vencimento") e scroll/foco no bloco.
- Marcar o bloco visualmente como obrigatório (asterisco + borda destacada quando inválido).
- Pré-selecionar a primeira opção (`opcoesVencimento[0]`) quando o form abre vazio, mantendo a escolha do consultor se já tiver valor — reduz erro humano sem remover a decisão.
- Rascunho local (`draftSnapshot`) já persiste `diaVencimento`; nada muda lá.

### 2. Backend — fallback inteligente baseado na data de cadastro (não mais `|| 10`)
Criar helper compartilhado `supabase/functions/_shared/vencimento-utils.ts` espelhando `src/utils/vencimento.ts`:
```ts
export function calcularOpcoesVencimento(diaHoje: number): [number, number] { ... }
export function vencimentoPadraoPorData(data: Date): number {
  return calcularOpcoesVencimento(data.getDate())[0]; // primeira opção válida
}
```
Substituir os fallbacks `|| 10` em:
- `supabase/functions/contrato-gerar/index.ts` (linhas 687 e 1002) — usar `vencimentoPadraoPorData(new Date(cotacao.created_at))` quando `cotacao.dia_vencimento` for null
- `supabase/functions/_shared/termo-afiliacao-utils.ts` (linha 487) — mesma lógica usando `contrato.created_at`
- Logar warning no edge log quando o fallback for usado, para auditoria

### 3. Banco — constraint mais estrita + correção dos casos existentes
Migration nova:
- Restringir `cotacoes.dia_vencimento` e `contratos.dia_vencimento` ao conjunto **`(5, 10, 15, 20, 25, 30)`** (dias permitidos pela regra de negócio). Hoje aceita 1..31.
- Para os contratos já criados com vencimento "10" indevido (a partir de cotações com `dia_vencimento NULL`), gerar relatório (não corrigir automaticamente — mudança de vencimento envolve cobrança Asaas e Hinova). Entregar SQL/CSV listando os 26 casos para o time financeiro reavaliar manualmente.

### 4. Outros pontos de entrada
- `supabase/functions/api-externa/index.ts` (criação de associado via API): validar que `dia_vencimento` recebido é um dos valores permitidos para a data atual; se vier ausente, calcular dinamicamente em vez de cair no default do banco.
- `supabase/functions/agente-consultor-ia/index.ts` já exige `dia_vencimento` como obrigatório no tool — manter.

### 5. QA
- Testar: cotação criada hoje sem clicar vencimento → bloqueia no front.
- Testar: forçar `dia_vencimento NULL` direto no banco e rodar `contrato-gerar` → contrato sai com a primeira opção válida da data de criação, não mais com 10 fixo.
- Testar: tentar gravar `dia_vencimento = 7` → constraint rejeita.

---

## Resumo dos arquivos

```text
NOVO   supabase/functions/_shared/vencimento-utils.ts
NOVA   migration: constraint dia_vencimento IN (5,10,15,20,25,30) + script CSV dos 26 casos
EDIT   src/components/cotacoes/CotacaoFormDialog.tsx (validação obrigatória + pré-seleção)
EDIT   supabase/functions/contrato-gerar/index.ts (fallback inteligente)
EDIT   supabase/functions/_shared/termo-afiliacao-utils.ts (fallback inteligente)
EDIT   supabase/functions/api-externa/index.ts (validação na entrada)
```

Sem alteração no Asaas/Hinova nem reemissão automática de boletos — caso LTG3H67 e os outros 25 ficam para revisão manual do financeiro com o relatório.
