

# Diagnóstico: Cálculo de Planos de Moto

## Problemas Identificados

### 1. `tipoVeiculo` hardcoded como `'carro'` (BUG CRÍTICO)
Tanto em `Cotador.tsx` (linha 374) quanto em `Cotacao.tsx` (linha 117), o parâmetro `tipoVeiculo` está fixo como `'carro'`. Isso significa que o filtro em `usePlanosCotacao.ts` (linhas 206-213) **sempre exclui planos ADVANCED** (motos) e **nunca exclui planos de carro**.

Resultado: ao consultar a placa LMS3B44 (moto), o sistema mostra planos SELECT/ESPECIAL/LANÇAMENTO (de carro) em vez dos planos ADVANCED/ADVANCED+ (de moto).

### 2. Plano ADVANCED sem cota de participação no banco
O plano `ADVANCED` (id: `28ef5622`) tem `cota_participacao: null` e `cota_minima: null`. O código faz fallback para `6%` e `R$ 1.200` (valores de carro). Segundo a tabela de referência, motos devem ter **10% / R$ 1.500**.

### 3. Nenhuma tabela de preços para motos
A `tabelas_preco` contém apenas 3 `plano_id`s (nenhum é ADVANCED). Quando o sistema busca `faixaPreco`, encontra uma faixa genérica de carro, e como `taxa_comercial = 0`, cai no fallback genérico (`FIPE * 2.5% / 12`). Motos precisam de tabelas de preço próprias ou o sistema precisa de uma lógica de cálculo específica para motos.

### 4. Não há detecção automática de tipo de veículo no cotador
O `VehicleCategorySelect` não inclui uma opção "Moto". Mesmo quando a API FIPE retorna dados de uma motocicleta, não há lógica para detectar que é moto e ajustar `tipoVeiculo` automaticamente.

## Correções Propostas

### 1. Detectar tipo de veículo automaticamente (Cotador.tsx e Cotacao.tsx)
Usar a função `detectarTipoVeiculo` (já existente em `src/data/vistoriaConfigCompleta.ts`) ou criar lógica similar baseada na marca/modelo retornados pela API FIPE. Quando detectar moto, definir `tipoVeiculo: 'moto'`.

### 2. Corrigir dados do plano ADVANCED no banco
Executar migration para definir `cota_participacao = 10` e `cota_minima = 1500` no plano ADVANCED (conforme tabela de referência).

### 3. Criar tabelas de preço para motos ou lógica de fallback específica
Opção A: Inserir registros na `tabelas_preco` com `plano_id` dos planos ADVANCED.
Opção B: Adicionar lógica no `usePlanosCotacao.ts` para calcular preço de motos de forma diferente quando não houver tabela de preço (usar faixas de referência do Guia do Consultor).

### 4. Passar `tipoVeiculo` dinamicamente
Em `Cotador.tsx` e `Cotacao.tsx`, substituir `tipoVeiculo: 'carro'` por um valor dinâmico baseado na detecção automática.

## Alterações

| Arquivo | Ação |
|---|---|
| `src/pages/vendas/Cotador.tsx` | Detectar moto e passar `tipoVeiculo` dinâmico |
| `src/pages/vendas/Cotacao.tsx` | Detectar moto e passar `tipoVeiculo` dinâmico |
| `src/hooks/usePlanosCotacao.ts` | Adicionar lógica de fallback de preço para motos |
| Migration SQL | Corrigir `cota_participacao` e `cota_minima` do plano ADVANCED |

4 arquivos + 1 migration.

