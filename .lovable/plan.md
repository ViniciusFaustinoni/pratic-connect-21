

# Carência Configurável com Tipos: Liberação e Multiplicadora de Cota

## Contexto

Hoje o campo `carencia_dias` é apenas um número. O pedido é transformar a carência em um sistema mais completo:

1. **Switch para ativar/desativar** carência
2. Se ativada, **selecionar o tipo**:
   - **Carência de Liberação** — cobertura/benefício só é liberado após X dias
   - **Carência Multiplicadora de Cota** — durante a carência, o valor da cota de participação é multiplicado por um fator configurável
3. Se tipo = Multiplicadora, exibir campo adicional para o **multiplicador**

## Alterações no Banco

### Migration — Novas colunas em `coberturas` e `benefits`

```sql
-- Coberturas
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS carencia_ativa boolean DEFAULT false;
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS carencia_tipo text DEFAULT NULL;
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS carencia_multiplicador numeric DEFAULT NULL;

-- Benefits
ALTER TABLE benefits ADD COLUMN IF NOT EXISTS carencia_ativa boolean DEFAULT false;
ALTER TABLE benefits ADD COLUMN IF NOT EXISTS carencia_tipo text DEFAULT NULL;
ALTER TABLE benefits ADD COLUMN IF NOT EXISTS carencia_multiplicador numeric DEFAULT NULL;
```

Valores possíveis de `carencia_tipo`: `'liberacao'` | `'multiplicadora_cota'`

## Alterações nos Formulários

### Ambos os modais (`CoberturaUnificadaFormModal` e `BeneficioFormModal`)

Substituir o campo simples de "Carência (dias)" por uma seção condicional:

```
┌─────────────────────────────────────────┐
│ [Switch] Carência                       │
│                                         │
│ (se ativada:)                           │
│ ┌─────────────┐  ┌───────────────────┐  │
│ │ Tipo ▼      │  │ Prazo (dias)      │  │
│ │ - Liberação │  │ [____30____]      │  │
│ │ - Mult.Cota │  │                   │  │
│ └─────────────┘  └───────────────────┘  │
│                                         │
│ (se tipo = Multiplicadora de Cota:)     │
│ ┌───────────────────────────────────┐   │
│ │ Multiplicador da Cota  [__2.0__] │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

- Switch "Carência" → controla `carencia_ativa`
- Select "Tipo" → `liberacao` ou `multiplicadora_cota`
- Input "Prazo (dias)" → `carencia_dias` (existente)
- Input "Multiplicador" → `carencia_multiplicador` (só se tipo = multiplicadora)

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar `carencia_ativa`, `carencia_tipo`, `carencia_multiplicador` em ambas tabelas |
| `src/components/admin/planos/CoberturaUnificadaFormModal.tsx` | Substituir campo simples por seção condicional de carência |
| `src/components/admin/planos/BeneficioFormModal.tsx` | Mesma alteração |

