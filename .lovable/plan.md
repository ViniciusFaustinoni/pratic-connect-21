

# Somar Repasse Volante à Taxa de Substituição

## Valores envolvidos (todos da tabela `configuracoes`)

| Chave | Valor atual | Hook existente |
|-------|------------|----------------|
| `taxa_substituicao_placa` | R$ 50 | `useTaxaSubstituicao()` |
| `taxa_repasse_volante` | R$ 50 | `useTaxaRepasseVolante()` |
| `taxa_repasse_volante_externo` | R$ 50 | `useTaxaRepasseVolanteExterno()` |

Nenhum valor é hardcoded — todos vêm de `configuracoes`.

## Alterações

### 1. Migration: adicionar colunas à `substituicoes_veiculo`

```sql
ALTER TABLE substituicoes_veiculo
  ADD COLUMN IF NOT EXISTS tipo_atendimento VARCHAR(20) DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS valor_repasse NUMERIC DEFAULT 0;
```

Registra o tipo de atendimento escolhido e o valor do repasse para auditoria.

### 2. `src/components/substituicao/StepFinanceiro.tsx`

- Importar `useTaxaRepasseVolante` e `useTaxaRepasseVolanteExterno`
- Adicionar estado `tipoAtendimento: 'base' | 'volante'` (default `'base'`)
- Usar o hook adequado para obter o valor do repasse (por ora usar `useTaxaRepasseVolante`; diferenciar por tipo de consultor é um refinamento futuro)
- Calcular `valorRepasse = tipoAtendimento === 'volante' ? taxaRepasseVolante : 0`
- Calcular `totalCobranca = taxaSubstituicao + valorRepasse`
- No **Card 1 (Taxa de Substituição)**, antes da forma de pagamento, adicionar um `RadioGroup` com duas opções:
  - **Base Administrativa** — sem repasse
  - **Instalação Volante** — exibe o valor do repasse como linha separada
- Atualizar `handleGerarCobranca` para usar `totalCobranca` no `value`
- Atualizar `handleEnviarAprovacao` para salvar `tipo_atendimento` e `valor_repasse` no registro
- No **Resumo Final**, exibir a taxa base e o repasse separadamente quando volante, e o total somado

### UI do seletor (dentro do Card 1)

```
Tipo de atendimento:
○ Base Administrativa
○ Instalação Volante (+R$ 50,00 repasse)

Taxa de substituição:    R$ 50,00
Repasse volante:         R$ 50,00  ← só aparece se volante
─────────────────────────────────
Total a cobrar:          R$ 100,00
```

### 3. `src/types/substituicao.ts`

Adicionar `tipo_atendimento` e `valor_repasse` à interface `SubstituicaoVeiculo`.

