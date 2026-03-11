

# Fix: Valor de adesão incluindo mensalidade

## Causa raiz identificada

No `handleTogglePlano` do `CotacaoFormDialog.tsx` (linhas 770-803), quando o consultor seleciona um plano, o formulário auto-preenche `valor_total_mensal`, `valor_cota`, `taxa_administrativa` e `valor_rastreamento` — mas **NÃO auto-preenche `valor_adesao`** com o valor do plano. O campo fica zerado (default) ou com valor anterior, levando o consultor a inserir manualmente um valor que pode incluir a mensalidade por engano.

O edge function `asaas-cobranca-adesao` usa diretamente o `valor_adesao` da cotação, sem somar nada. O `gerar-cobrancas-mensais` só roda via cron para associados ativos — não é disparado na adesão. Portanto, o problema é o valor gravado na cotação pelo consultor.

## Correção

### 1. Auto-preencher `valor_adesao` ao selecionar plano

**Arquivo:** `src/components/cotacoes/CotacaoFormDialog.tsx`

No `handleTogglePlano`, adicionar `form.setValue('valor_adesao', plano.valorAdesao)` quando o primeiro plano é selecionado ou quando planos mudam. Isso garante que o campo sempre reflita o `valor_adesao` do plano selecionado.

Linhas afetadas: ~793-799 (ao adicionar plano) e ~778-784 (ao remover e haver outro).

### 2. Label mais claro no campo

Atualizar o texto auxiliar do campo `valor_adesao` para deixar explícito que NÃO deve incluir mensalidade:

```
"Valor da taxa de filiação (NÃO inclui mensalidade)"
```

**Arquivo:** `src/components/cotacoes/CotacaoFormDialog.tsx`, linha ~1600.

### Arquivos modificados

- `src/components/cotacoes/CotacaoFormDialog.tsx` — 2 pontos: auto-fill no handler + label clarificado

### O que NÃO precisa mudar

- Edge function `asaas-cobranca-adesao` — já usa apenas `valor_adesao`, sem somar mensalidade
- `contrato-gerar` — já salva `valor_adesao` e `valor_mensal` separadamente
- `gerar-cobrancas-mensais` — já roda apenas via cron no dia combinado, não na adesão
- Fluxo público (`EtapaPagamentoCotacao`) — já usa `cotacao.valor_adesao` corretamente

