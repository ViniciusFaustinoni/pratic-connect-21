

# Auditoria Parte 2: Benefícios Adicionais — Diagnóstico e Plano

## Estado Atual

### Duas tabelas de "benefícios" completamente desconectadas

| Tabela | Propósito | Campos-chave | Onde é usada |
|--------|-----------|-------------|--------------|
| `benefits` | Marketing — itens exibidos nas cards de plano | name, slug, icon, category | `BeneficiosTab`, `VincularBeneficioModal`, app do associado |
| `beneficios_adicionais` | Comercial — add-ons pagos com preço fixo | codigo, nome, preco, categoria | `BeneficiosAdicionaisConfig`, cotação, substituição |

A tabela `benefits` lista o que o plano "inclui" (reboque 400km, assistência 24h). A tabela `beneficios_adicionais` lista o que o associado pode **contratar a mais** por valor fixo mensal. Ambas estão funcionais e com dados corretos (15 add-ons cadastrados com preços).

### Fluxo atual de seleção de adicionais na cotação

1. Consultor cria cotação → seleciona adicionais no `StepBeneficios` → dados vão para `cotacoes.adicionais_selecionados` (JSON) e `cotacoes.valor_adicional` (soma dos preços)
2. Contrato é gerado via edge function `contrato-gerar` → copia apenas `valor_adicional` (número). **Os IDs dos adicionais selecionados NÃO são copiados para o contrato.**

---

## Problemas Identificados

### 1. Contratos não registram QUAIS adicionais foram contratados
A coluna `contratos.adicionais_selecionados` **não existe**. Apenas `valor_adicional` (número) é copiado. Isso significa que após a geração do contrato:
- Ninguém sabe quais add-ons o associado contratou
- O app do associado não pode exibir seus benefícios adicionais
- O sinistro não consegue verificar se o associado tem direito a uma cobertura adicional
- O rateio não consegue decompor o valor adicional por benefício

### 2. Não existe filtro por "linhas de plano permitidas"
A regra de negócio diz que cada adicional define quais linhas permitem sua contratação. A tabela `beneficios_adicionais` **não tem** campo `linhas_permitidas`. Todos os adicionais aparecem para todos os planos indiscriminadamente.

### 3. Contrato-gerar não propaga adicionais para o associado
Quando o contrato é criado, o associado é criado/atualizado, mas seus benefícios adicionais ativos não são registrados em nenhuma tabela relacional. Não existe uma tabela `associado_beneficios_adicionais` ou `contratos_beneficios_adicionais`.

---

## Plano de Implementação

### Fase 1: Migração — Persistir adicionais no contrato e associado

```sql
-- 1. Adicionar coluna JSON no contrato para snapshot dos adicionais
ALTER TABLE contratos ADD COLUMN adicionais_selecionados JSONB DEFAULT '[]';

-- 2. Adicionar linhas permitidas nos benefícios adicionais
ALTER TABLE beneficios_adicionais ADD COLUMN linhas_permitidas TEXT[] DEFAULT '{}';

-- 3. Tabela relacional: quais adicionais estão ativos por associado/contrato
CREATE TABLE associados_beneficios_adicionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
  beneficio_adicional_id UUID NOT NULL REFERENCES beneficios_adicionais(id),
  valor_contratado NUMERIC(10,2) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(associado_id, beneficio_adicional_id, contrato_id)
);

ALTER TABLE associados_beneficios_adicionais ENABLE ROW LEVEL SECURITY;
```

### Fase 2: Atualizar `contrato-gerar` para propagar adicionais

Na edge function, após criar o contrato:
1. Copiar `cotacao.adicionais_selecionados` para `contratos.adicionais_selecionados`
2. Inserir registros em `associados_beneficios_adicionais` para cada adicional selecionado

### Fase 3: Adicionar campo `linhas_permitidas` ao formulário de adicionais

No `BeneficioAdicionalModal` e `BeneficiosAdicionaisConfig`:
- Adicionar multi-select com as linhas de produto (select, select-one, especial, lancamento, advanced, eletrico)
- Salvar como array TEXT[] em `linhas_permitidas`

### Fase 4: Filtrar adicionais por linha no fluxo de cotação

No `useBeneficiosAdicionaisCotacao` e `useBeneficiosSeparados`:
- Receber o `product_line_slug` do plano selecionado
- Filtrar adicionais que tenham `linhas_permitidas` vazio (disponível para todos) OU que incluam o slug da linha

---

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| **Nova migração SQL** | Criar coluna, tabela e RLS |
| `supabase/functions/contrato-gerar/index.ts` | Copiar adicionais para contrato + criar registros no associado |
| `src/components/planos/BeneficioAdicionalModal.tsx` | Adicionar multi-select de linhas permitidas |
| `src/components/planos/BeneficiosAdicionaisConfig.tsx` | Exibir coluna de linhas permitidas |
| `src/hooks/useBeneficiosAdmin.ts` | Incluir `linhas_permitidas` no create/update |
| `src/hooks/useBeneficiosAdicionaisCotacao.ts` | Filtrar por linha do plano selecionado |

