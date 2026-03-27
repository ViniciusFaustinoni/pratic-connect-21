

# Taxa Administrativa por Plano com Faixas FIPE

## Contexto

Atualmente existe uma tabela global `faixas_taxa_administrativa` com faixas FIPE fixas para todos os planos. O pedido é que **cada plano** tenha sua própria configuração de taxa administrativa por faixa FIPE, editável no formulário de criação/edição do plano (`PlanoFormSheet`).

## Alterações

### 1. Nova tabela: `planos_taxa_administrativa` (migração SQL)

```sql
CREATE TABLE planos_taxa_administrativa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
  fipe_de NUMERIC(12,2) NOT NULL,
  fipe_ate NUMERIC(12,2) NOT NULL,
  valor_taxa NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Com RLS: leitura pública, escrita restrita a diretores. Índice em `plano_id`.

### 2. `src/components/gestao-comercial/PlanoFormSheet.tsx`

Adicionar uma nova seção **"Taxa Administrativa"** entre "Coberturas e Benefícios" e "Template de Contrato":

- Campos: FIPE Mínimo, FIPE Máximo, Intervalo (R$) — idêntico ao padrão usado em `EligibilityConfigSection`
- Ao preencher os 3 campos, o sistema gera automaticamente as faixas
- Cada faixa exibe o intervalo (ex: "R$ 0 – R$ 20.000") e um input para o valor da taxa
- Ao salvar o plano, os registros são gravados na tabela `planos_taxa_administrativa` (delete + insert, mesmo padrão usado para coberturas/benefícios)
- Ao editar, as faixas existentes são carregadas e os campos preenchidos

### 3. Lógica de carregamento (dentro do mesmo `PlanoFormSheet`)

- Na query de edição (`plano_edit`), buscar também de `planos_taxa_administrativa` onde `plano_id = planoId`, ordenado por `fipe_de`
- Reconstruir os campos de min/max/intervalo e valores a partir dos dados salvos

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Nova migração SQL | Criar tabela `planos_taxa_administrativa` com RLS |
| `src/components/gestao-comercial/PlanoFormSheet.tsx` | Adicionar seção de taxa administrativa com inputs de faixas FIPE |

