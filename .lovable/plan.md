

# Tela de Fechamento Mensal com Entrada Manual de Despesas

## Situacao Atual

A pagina `/financeiro/faturamento` (FaturamentoMensal.tsx) ja existe com um pipeline de 3 etapas (Fechar Mes, Calcular Rateio, Gerar Faturas). Porem, a Etapa 1 ("Fechar Mes") executa automaticamente buscando sinistros no banco -- nao permite que o operador informe as despesas manualmente por categoria.

A Edge Function `fechamento-mensal` tambem faz tudo automaticamente: busca sinistros, agrupa por beneficio e insere nas tabelas `fechamentos_mensais` e `despesas_rateio`.

As tabelas e edge functions necessarias ja existem:
- `fechamentos_mensais` (status: aberto/fechado/aprovado/processado)
- `despesas_rateio` (tipo_beneficio, valor_total, etc.)
- `calcular-rateio-completo` (calcula valor por cota por beneficio)
- `gerar-faturas-mensais` (gera boletos no ASAAS)

## O que sera alterado

### 1. Refatorar `src/pages/financeiro/FaturamentoMensal.tsx`

Reescrever a Etapa 1 para incluir entrada manual de despesas com os campos solicitados:

**Campos de despesa (Etapa 1):**
- Total pago em colisoes (R$)
- Total pago em roubos/furtos (R$)
- Total pago em assistencia 24h (R$)
- Total pago em danos a terceiros (R$)
- Total pago em vidros/farois (R$)
- Outras despesas operacionais (R$)
- TOTAL GERAL (calculado automaticamente, soma em tempo real)

Quando o operador clica "Fechar Mes", os valores informados serao enviados a edge function.

**Previa do Calculo (Etapa 2 melhorada):**

Apos o fechamento, mostrar:
- Total de despesas informadas
- Total de cotas ativas na base
- Valor por cota (total despesas / total cotas)
- Amostra de 5 associados com valor calculado para cada um (busca via preview da edge function gerar-faturas-mensais)
- Maior e menor valor que sera cobrado
- Botao "Aprovar" apos revisao

**Resumo pos-processamento (Etapa 3 melhorada):**

Apos confirmacao e geracao:
- Mes de referencia
- Total de associados com fatura gerada
- Valor total a receber
- Valor medio por associado
- Maior/menor fatura
- Botao para avancar a geracao de boletos

### 2. Atualizar Edge Function `fechamento-mensal`

Aceitar despesas manuais no body da requisicao:

```text
{
  mes, ano,
  despesas_manuais: {
    colisao: 50000,
    roubo_furto: 30000,
    assistencia: 10000,
    terceiros: 5000,
    vidros: 3000,
    outros: 2000
  }
}
```

Quando `despesas_manuais` estiver presente:
- Usar esses valores em vez de buscar sinistros automaticamente
- A categoria "outros" sera mapeada para "incendio" ou armazenada como novo tipo
- Manter a logica de contagem de associados/cotas ativos (automatica)
- Inserir nas tabelas normalmente

Quando `despesas_manuais` NAO estiver presente (compatibilidade):
- Manter comportamento atual de auto-apuracao via sinistros

### 3. Adicionar categoria "outros" na despesas_rateio

A tabela `despesas_rateio` usa `tipo_beneficio` como varchar. Adicionar suporte ao tipo `outros` tanto na edge function quanto no frontend (nenhuma migration necessaria, o campo ja aceita qualquer string).

A edge function `calcular-rateio-completo` tambem precisara tratar o tipo `outros` -- essas despesas serao rateadas entre TODAS as cotas ativas (sem filtro de cobertura).

### 4. Melhorar indicadores de inadimplencia

Na lista de preview de faturas, buscar se o associado tem cobrancas vencidas e nao pagas (status `OVERDUE` ou `EXPIRED` na tabela `asaas_cobrancas`). Exibir badge "Inadimplente" ao lado do nome.

### 5. Protecao contra fechamento duplicado

O sistema ja tem essa protecao na edge function (verifica `fechamentoExistente` e retorna erro se status != 'aberto'). Manter esse comportamento e exibir mensagem amigavel no frontend quando o mes ja tiver sido fechado.

## Controle de acesso

A pagina ja esta acessivel no menu Financeiro. A verificacao de perfil (Financeiro e Diretoria) sera mantida como esta -- a rota ja esta protegida pelo sistema de permissoes existente.

## Arquivos a modificar

- `src/pages/financeiro/FaturamentoMensal.tsx` -- refatorar Etapa 1 com campos manuais, melhorar Etapa 2 com previa detalhada, melhorar resumo final
- `supabase/functions/fechamento-mensal/index.ts` -- aceitar `despesas_manuais` no body
- `supabase/functions/calcular-rateio-completo/index.ts` -- tratar tipo `outros` (ratear entre todas as cotas)

## Fluxo revisado

```text
Operador seleciona mes/ano
        |
Informa despesas manualmente por categoria
        |
Clica "Fechar Mes" -> Edge function recebe valores
        |
Sistema conta associados/cotas automaticamente
        |
Status = "fechado" -> Mostra previa com amostra
        |
Diretor/Financeiro clica "Aprovar"
        |
Status = "aprovado" -> Simula faturas
        |
Mostra resumo com maior/menor/media/inadimplentes
        |
Clica "Gerar Faturas" -> Boletos no ASAAS
        |
Status = "processado" -> Resumo final
```
