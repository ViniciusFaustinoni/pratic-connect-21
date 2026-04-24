
## Filtros de período e status no Dashboard de Comissões

### Objetivo
Adicionar filtros no `/comissoes/dashboard` para que o diretor visualize KPIs, ranking e detalhes das comissões por:

```text
Período de geração
Status da comissão
Tipo de lançamento
```

A tela deixará de mostrar apenas “mês atual” e passará a trabalhar com intervalo selecionável.

---

## 1. Ajustar o hook do dashboard

Arquivo:

- `src/hooks/useComissoesDashboard.ts`

### Mudanças
Trocar o parâmetro atual baseado em um único mês:

```text
periodo = new Date()
```

por filtros explícitos:

```text
dataInicio
dataFim
status
tipoLancamento
```

### Consulta
A query em `comissoes` passará a filtrar por:

```text
created_at >= dataInicio 00:00:00
created_at <= dataFim 23:59:59
status, quando diferente de "todos"
tipo_comissao, quando diferente de "todos"
```

### Retorno
O hook continuará retornando:

```text
items
kpis
isLoading
```

mas também poderá retornar os filtros aplicados para textos de apoio, se necessário.

---

## 2. Atualizar os KPIs para respeitar filtros

Arquivo:

- `src/hooks/useComissoesDashboard.ts`

Os indicadores serão calculados apenas sobre os itens filtrados:

```text
Total a pagar no período
Total pago no período
Pendente de aprovação
Comissões vitalícias
Top 5 vendedores no período
```

### Ajuste de nomenclatura
Trocar textos fixos como:

```text
este mês
no mês
Top 5 vendedores do mês
```

por:

```text
no período
Top 5 vendedores no período
```

Assim a tela fica coerente para intervalos maiores ou menores que um mês.

---

## 3. Adicionar filtros visuais no dashboard

Arquivo:

- `src/pages/comissoes/Dashboard.tsx`

Adicionar um card/bloco de filtros acima dos KPIs com:

```text
Período
- Data inicial
- Data final

Status
- Todos
- Pendente
- Aprovada
- Paga
- Contestada
- Cancelada, se existir no fluxo

Tipo de lançamento
- Todos
- Comissão comum/recorrente
- Vitalícia
- Valor fixo
- Percentual
```

### Componente de data
Usar o padrão existente do projeto:

- `src/components/ui/date-range-picker.tsx`

Também ajustar o `Calendar` para incluir `pointer-events-auto`, conforme padrão necessário em popovers/dialogs:

```text
className="p-3 pointer-events-auto"
```

---

## 4. Ajustar detalhamento por card

Arquivo:

- `src/pages/comissoes/Dashboard.tsx`

Os cards continuarão clicáveis, mas agora os modais mostrarão apenas os lançamentos dentro dos filtros selecionados.

Exemplos:

```text
Total a pagar no período
  -> abre pendentes/aprovadas dentro do período e tipo selecionados

Total pago no período
  -> abre pagas dentro do período e tipo selecionados

Pendente de aprovação
  -> abre somente pendentes dentro do período e tipo selecionados

Comissões vitalícias
  -> abre vitalícias dentro do período e status selecionado
```

O título do modal indicará o filtro aplicado:

```text
Total pago no período selecionado
Pendentes de aprovação no período selecionado
```

---

## 5. Melhorar o modal de detalhes

Arquivo:

- `src/components/comissoes/ComissoesDetalhesModal.tsx`

Adicionar colunas úteis para conferência do intervalo:

```text
Data
Tipo de lançamento
Status
```

A tabela ficará mais adequada para auditoria quando o intervalo tiver muitos dias.

Também manter:

```text
Usuário
Nível/perfil
Parcela
Base
Percentual
Comissão
```

---

## 6. Tipos de lançamento

A base já possui campos relevantes em `comissoes`:

```text
tipo_comissao
tipo_calculo
parcela_numero
```

A primeira versão usará esses campos para classificar:

```text
vitalícia:
  tipo_comissao contém "vitalicia" ou parcela_numero > 12

valor fixo:
  tipo_calculo = "valor_fixo" ou tipo_comissao = "valor_fixo"

percentual:
  tipo_calculo = "percentual" ou percentual_aplicado > 0

todos:
  sem filtro adicional
```

Se houver outros valores reais em produção, a interface continuará exibindo os status/tipos encontrados sem quebrar.

---

## 7. Estado inicial

Ao abrir o dashboard:

```text
dataInicio = primeiro dia do mês atual
dataFim = último dia do mês atual
status = todos
tipoLancamento = todos
```

Ou seja, o comportamento visual inicial continuará equivalente ao atual, mas agora poderá ser alterado pelo diretor.

---

## 8. Arquivos envolvidos

### Frontend
- `src/pages/comissoes/Dashboard.tsx`
- `src/hooks/useComissoesDashboard.ts`
- `src/components/comissoes/ComissoesDetalhesModal.tsx`
- `src/components/ui/calendar.tsx`
- opcional: `src/components/ui/date-range-picker.tsx`

### Banco/Supabase
Não será necessário criar tabela nem migration. A mudança usa campos já existentes em `comissoes`.

---

## 9. Validação esperada

### Cenário 1: período
- Abrir `/comissoes/dashboard`.
- Selecionar um intervalo diferente do mês atual.
- KPIs e Top 5 devem recalcular conforme o intervalo.

### Cenário 2: status
- Filtrar por `paga`.
- Total pago deve refletir apenas comissões pagas.
- Detalhes dos cards não devem listar pendentes fora do filtro.

### Cenário 3: tipo de lançamento
- Filtrar por `vitalícia`.
- Cards e modal devem mostrar apenas lançamentos vitalícios.

### Cenário 4: filtros combinados
- Selecionar período + status + tipo.
- Todos os cards, ranking e detalhes devem respeitar a combinação.

### Cenário 5: estado vazio
- Selecionar um intervalo sem lançamentos.
- Dashboard deve mostrar zeros e mensagem de ausência no ranking/modal.
