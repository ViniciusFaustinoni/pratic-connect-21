

# Unificar "Tipo de Cliente" e "Categorias de Veículo Aceitas"

## Problema

O formulário de plano tem dois campos redundantes:
- **Tipo de Cliente** (dropdown: Passeio/Aplicativo) — campo `tipo_uso` na tabela `planos`
- **Categorias de Veículo Aceitas** (checkboxes: Passeio, Aplicativo, Moto, Diesel, etc.) — campo `categoria` na tabela `planos`

Ambos definem a mesma coisa: quais tipos de veículo o plano aceita. O "Tipo de Cliente" é restritivo (um valor) enquanto "Categorias" é flexível (múltiplos valores). A fonte de verdade deve ser apenas **Categorias de Veículo Aceitas**.

## Impacto no Motor de Cotação

Hoje o motor de cotação (`useCotacao.ts` linha 289-303) filtra planos por `tipo_uso`:
```
planos.filter(p => p.tipo_uso === 'particular' || p.tipo_uso === 'passeio')
```

Precisamos migrar essa filtragem para usar `categorias_veiculo` (campo `categoria` no banco). Exemplo: se o veículo é "aplicativo", o plano só aparece se `categoria` contiver "aplicativo".

## Plano de Execução

### 1. Remover campo "Tipo de Cliente" do formulário
**Arquivo:** `PlanFormModal.tsx`
- Remover o bloco `<Select>` de "Tipo de Cliente" (linhas 509-525)
- Remover `tipo_uso` do state `formData` (linha 157)
- Na submissão, derivar `tipo_uso` automaticamente das categorias selecionadas: se inclui "aplicativo" → `'aplicativo'`, senão → `'passeio'` (backward compatibility com banco)

### 2. Atualizar motor de cotação para usar categorias
**Arquivo:** `useCotacao.ts`
- Trocar filtro de `tipo_uso` por verificação se a `categoria` do plano inclui a categoria do veículo sendo cotado
- Manter fallback: plano sem categoria definida aceita qualquer veículo (backward compat)

### 3. Atualizar motor avançado
**Arquivo:** `useCotacaoAvancada.ts`
- Mesma lógica: verificar `categoria` do plano em vez de `tipo_uso`

### 4. Remover badge APP baseado em tipo_uso
**Arquivo:** `PlanCard.tsx` (linha 114)
- Derivar badge APP de `categorias_veiculo` em vez de `tipo_uso`

## Arquivos

| Arquivo | Tipo |
|---|---|
| `src/components/admin/planos/PlanFormModal.tsx` | Editado — remover campo Tipo de Cliente |
| `src/hooks/useCotacao.ts` | Editado — filtrar por categoria |
| `src/hooks/useCotacaoAvancada.ts` | Editado — filtrar por categoria |
| `src/hooks/usePlansAdmin.ts` | Editado — derivar tipo_uso das categorias |
| `src/components/admin/planos/PlanCard.tsx` | Editado — badge APP via categoria |

