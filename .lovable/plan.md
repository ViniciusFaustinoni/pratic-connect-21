## Objetivo

Na tela `Financeiro > Extrato`, exibir explicitamente:
1. **Associado** vinculado à movimentação (atualmente só aparece embutido na descrição após "—")
2. **Data** da movimentação em cada linha (hoje a data só aparece no cabeçalho do agrupamento "ONTEM/HOJE/...")

## Análise

- Arquivo: `src/pages/financeiro/Extrato.tsx`
- Fonte: `movimentacoes_financeiras` com colunas `referencia_tipo` ('contrato' nos repasses) e `referencia_id` (id do contrato).
- O contrato tem `associado_id` → `associados.nome`.
- Hoje a query faz `select('*')` simples — sem join. Não há coluna direta de associado.
- O agrupamento atual por dia (Hoje/Ontem/data) é útil, mas o usuário quer também a data explícita por linha (facilita exportar/scan visual).

## Mudanças

### 1. `src/pages/financeiro/Extrato.tsx`

**Query**: enriquecer movimentações buscando associado quando `referencia_tipo='contrato'`:
- Coletar todos `referencia_id` distintos de movimentações com tipo contrato.
- Buscar em `contratos` os pares `(id, associado_id, associados(id, nome))` em uma única query `.in('id', ids)`.
- Montar mapa `contratoId → { associadoId, associadoNome }` e anexar a cada movimentação um campo `associado` derivado.
- Fallback: se `referencia_tipo` for `associado` direto, buscar nome em `associados`.

**Tabela**: adicionar duas colunas:
```
| Data | Descrição | Associado | Categoria | Valor |
```
- Data por linha: `format(parseISO(mov.data_movimentacao), 'dd/MM/yyyy')`.
- Associado: link para `/cadastro/associados/:id` quando houver, senão `—`.
- Manter o cabeçalho de agrupamento (Hoje/Ontem/data por extenso) — ele continua útil para escaneabilidade.
- Limpar a descrição visual: como Associado vira coluna própria, manter `descricao` como está (já vem com "— NOME"), mas opcionalmente remover o sufixo "— NOME" quando o associado já estiver na coluna (regex simples). Decisão: manter como está para não quebrar outros tipos de movimentação que não são repasse.

**Filtro extra (opcional, escopo desta tarefa)**: adicionar campo de busca por nome de associado no bloco de filtros (client-side sobre o resultado já carregado). Se o usuário não quiser, removo.

**Exportação CSV**: incluir colunas `Data` e `Associado` no header e nas linhas geradas em `handleExportar`.

### 2. Sem mudanças de schema, sem migração

A informação já existe via join — só não estava sendo carregada/exibida.

## Detalhes técnicos

- Usar `useQuery` única; após receber `movimentacoes`, fazer um segundo `useQuery` dependente (`enabled: !!movimentacoes`) para buscar associados dos contratos referenciados, ou consolidar em um único `queryFn` que faz as duas chamadas sequencialmente e retorna já enriquecido. Preferência: enriquecer dentro do mesmo `queryFn` para simplicidade.
- RLS: `contratos` e `associados` já são acessíveis aos perfis financeiros (Diretor, Financeiro). Sem novas policies.
- Layout responsivo: a coluna Associado pode ficar com `truncate max-w-[220px]` + `title` para não quebrar.

## Arquivos afetados

- `src/pages/financeiro/Extrato.tsx` (única alteração)

## Confirmações

Confirma se devo:
- (a) **Adicionar campo de busca por associado** nos filtros? (sugiro sim)
- (b) **Remover o sufixo "— NOME"** da descrição quando a coluna Associado estiver populada, para evitar duplicação visual? (sugiro sim)
