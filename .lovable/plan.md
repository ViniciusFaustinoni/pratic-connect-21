

# Calculadora de Preço — Redesign Modular (Progressive Disclosure)

## Problema atual

A calculadora abre um dialog com ~10 campos visíveis de uma vez (placa, FIPE, ano, tipo veículo, região, combustível, tipo uso, categoria, botões). Isso sobrecarrega visualmente e intimida o usuário.

## Conceito: Fluxo em Steps Progressivos

A calculadora se torna um formulário que revela campos conforme o usuário avança. Cada "step" só aparece depois que o anterior foi preenchido — como um chat/formulário conversacional.

```text
┌─────────────────────────────────────┐
│  Calculadora de Preço               │
│                                     │
│  STEP 1: Como quer buscar?          │
│  [🔍 Pela Placa]  [✏️ Manual]       │
│                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  (se Placa)                         │
│  STEP 2: [ABC1D23_______] [🔍]     │
│  → FIPE, ano, tipo preenchidos auto │
│                                     │
│  (se Manual)                        │
│  STEP 2: Valor FIPE  [R$____]      │
│  STEP 3: Carro ou Moto? [toggle]   │
│  STEP 4: Ano [____]                │
│                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  STEP 5: Região [select]           │
│  STEP 6: Uso [Particular|App]      │
│  STEP 7: Categoria (se carro)      │
│  STEP 8: Combustível (se manual+   │
│           carro sem detecção)       │
│                                     │
│  [Calcular]                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  RESULTADOS (cards dos planos)      │
└─────────────────────────────────────┘
```

## Regras de revelação

| Step | Aparece quando... | Auto-avança |
|------|-------------------|-------------|
| 1 — Modo (Placa / Manual) | Sempre visível | — |
| 2 — Placa ou FIPE | Após escolher modo | — |
| 3 — Tipo Veículo (toggle) | **Manual**: após digitar FIPE. **Placa**: auto-detectado, mostra travado | Placa: sim |
| 4 — Ano | **Manual**: após tipo veículo. **Placa**: auto-preenchido | Placa: sim |
| 5 — Região | Após FIPE definido (ambos modos) | Default RJ visível |
| 6 — Tipo Uso | Após região | Default Particular |
| 7 — Categoria | Só se tipo = carro, após uso | Default "Nenhuma" |
| 8 — Combustível | Só se carro + modo manual (sem detecção) | — |
| Botão Calcular | Quando FIPE > 0 | — |

- Campos com default (região, uso) aparecem já preenchidos — o usuário só altera se quiser
- Após primeiro cálculo, mudanças auto-recalculam (comportamento atual mantido)
- Transições suaves com animação fade-in / slide-down

## Mudanças visuais

1. **Step 1**: Dois botões grandes lado a lado ("Pela Placa" / "Digitar FIPE") em vez de campo placa sempre visível
2. **Dados do veículo por placa**: Card compacto com badge (marca, modelo, ano, cor, combustível) — já existe, manter
3. **Campos revelados**: Cada novo campo entra com `animate-in fade-in slide-in-from-top` (classes Tailwind existentes)
4. **Campos menos usados** (categoria, combustível): Aparecem só quando relevantes, com label discreto
5. **Resultados**: Layout de cards já está bom, manter igual

## Arquivo afetado

| Arquivo | Mudança |
|---------|---------|
| `src/components/planos/CalculadoraPreco.tsx` | Refatorar o JSX do formulário para fluxo progressivo com lógica de steps. Toda a lógica de cálculo e hooks permanecem inalterados — só muda a renderização dos inputs. |

## O que NÃO muda

- Toda a engine de cálculo (função `calcular()`)
- Hooks de dados (useTabelasPreco, usePlanosComPrecoMap, etc.)
- Layout dos cards de resultado
- Auto-recalcular após primeiro cálculo
- Botão "Limpar" (reseta steps ao estado inicial)

