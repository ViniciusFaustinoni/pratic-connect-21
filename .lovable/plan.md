

# Inadimplência por veículo e suspensão de benefícios adicionais

## Resumo

Atualmente o sistema verifica inadimplência no nível do **associado** (qualquer cobrança vencida suspende tudo). Precisa mudar para: cobertura principal suspensa **por veículo** e benefícios adicionais suspensos **globalmente** se qualquer veículo estiver inadimplente.

## Problemas no código atual

1. **`useMinhasCoberturasApp.ts`** (App): consulta cobranças pelo `associado_id` sem filtrar `veiculo_id`, suspende tudo globalmente. Além disso, só considera o primeiro veículo (`veiculos?.[0]`).
2. **`useAssociadoSituacao.ts`** (Painel admin): consulta cobranças pelo `associado_id` sem distinguir veículos — `coberturasSuspensas` é um flag global.
3. **Ficha do associado** (aba Veículos): não mostra status de cobertura por veículo.
4. **App**: não mostra lista de veículos com status individual.

## Alterações

### 1. Novo hook: `useInadimplenciaPorVeiculo.ts`
Consulta `cobrancas` com status `vencido` agrupando por `veiculo_id`. Retorna:
- `inadimplenciaPorVeiculo`: `Record<string, { diasAtraso: number, total: number }>` — quais veículos estão inadimplentes
- `algumVeiculoInadimplente`: boolean — para controle dos benefícios adicionais
- `beneficiosAdicionaisSuspensos`: boolean (= `algumVeiculoInadimplente`)

### 2. Refatorar `useMinhasCoberturasApp.ts`
- Ao invés de um flag `inadimplente` global, consultar cobranças por `veiculo_id`
- Retornar array de coberturas por veículo em vez de um único objeto flat
- Cada veículo terá: `{ veiculoId, inadimplente, temCoberturaRouboFurto, temCoberturaTotal, podeAssistencia, podeRastreamento, tiposSinistroPermitidos }`
- Adicionar campo `beneficiosAdicionaisSuspensos` (true se qualquer veículo inadimplente)
- Manter compatibilidade: exportar também o veículo principal para não quebrar `AppHome` e `NovoSinistro`

### 3. Refatorar `useAssociadoSituacao.ts`
- A query de dias de atraso não muda (continua buscando a cobrança mais antiga vencida do associado), mas adicionar campo `veiculosInadimplentes` listando quais veículos têm débito
- Manter `coberturasSuspensas` como flag geral mas adicionar `coberturaPorVeiculo: Array<{ veiculoId, placa, modelo, coberturasSuspensas, diasAtraso }>`
- Adicionar `beneficiosAdicionaisSuspensos: boolean`

### 4. Atualizar `AssociadoSituacaoCard.tsx` (Ficha admin)
- Na seção "Situação Financeira", se houver múltiplos veículos, mostrar lista indicando quais estão inadimplentes e quais estão em dia
- Adicionar indicador de benefícios adicionais suspensos quando aplicável

### 5. Atualizar aba Veículos em `AssociadoDetalhe.tsx`
- Cada card de veículo ganha um badge de cobertura: "Cobertura Ativa" (verde) ou "Cobertura Suspensa" (vermelho) baseado na inadimplência daquele veículo específico

### 6. Atualizar `AppHome.tsx` (App do associado)
- Quando houver múltiplos veículos, mostrar cards para cada veículo com status individual
- Exibir alerta de benefícios adicionais suspensos quando algum veículo estiver inadimplente, com mensagem explicativa

### 7. Atualizar `AppPlano.tsx` (App - tela do plano)
- Na lista de benefícios, quando `beneficiosAdicionaisSuspensos`, renderizar benefícios adicionais com ícone de suspensão e mensagem: "Benefícios adicionais suspensos — há inadimplência em um dos veículos. Regularize para reativar."

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useInadimplenciaPorVeiculo.ts` | **Novo** — query de cobranças vencidas agrupadas por veiculo_id |
| `src/hooks/useMinhasCoberturasApp.ts` | Refatorar para coberturas por veículo + flag benefícios suspensos |
| `src/hooks/useAssociadoSituacao.ts` | Adicionar lista de veículos inadimplentes + benefícios adicionais suspensos |
| `src/components/associados/detalhe/AssociadoSituacaoCard.tsx` | Exibir inadimplência por veículo + banner de benefícios adicionais |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Badge de cobertura por veículo na aba Veículos |
| `src/pages/app/AppHome.tsx` | Cards de veículos com status individual + alerta benefícios |
| `src/pages/app/AppPlano.tsx` | Benefícios adicionais marcados como suspensos quando aplicável |
| `src/pages/app/NovoSinistro.tsx` | Verificar cobertura do veículo selecionado (não global) |

## Detalhes técnicos

### Query de inadimplência por veículo
```sql
SELECT veiculo_id, MIN(data_vencimento) as vencimento_mais_antigo
FROM cobrancas
WHERE associado_id = $1
  AND status IN ('vencido')
  AND veiculo_id IS NOT NULL
GROUP BY veiculo_id
```

### Lógica de benefícios adicionais
```typescript
const beneficiosAdicionaisSuspensos = veiculosInadimplentes.length > 0;
```

Nenhuma alteração de schema é necessária — `cobrancas.veiculo_id` já existe.

