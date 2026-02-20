
# Diferenciar Parecer Técnico: Dano Parcial vs Perda Total

## Diagnóstico da Situação Atual

O `EmitirParecerModal.tsx` já contém lógica para diferenciar os dois casos:
- A classificação automática `perda_total` / `parcial` é calculada com base na regra de 75% do valor FIPE
- Quando perda total: o status é enviado para `aguardando_pagamento` (indenização integral)
- Quando dano parcial: status vai para `aprovado` (fluxo de reparo em oficina)

**Porém, o formulário atual tem sérios problemas de UX/lógica:**

1. O campo "Valor Aprovado" pede o mesmo tipo de entrada para ambos os fluxos, mas a semântica é diferente:
   - **Parcial:** valor do orçamento de reparo (até 74,9% FIPE)
   - **Perda Total:** valor da indenização integral = valor FIPE (calculado automaticamente com depreciações)
2. Não há orientação visual clara sobre o que preencher em cada caso
3. Para perda total, o campo "Valor Aprovado" é redundante — o valor é o FIPE (já registrado) com depreciações. O analista não deveria digitar livremente
4. Não existe seleção de tipo de dano explícita — só a classificação automática que pode confundir (e se o sinistro não tem valor FIPE cadastrado?)
5. O botão de submit tem o mesmo texto para ambos os casos

## Solução: Reformular o Modal com Dois Fluxos Distintos

Manter TODA a lógica backend existente (status, inativação de veículo, notificação, autentique). Apenas reformular a interface para:

### Fluxo 1 - Dano Parcial (< 75% FIPE)
- Mostrar badge "Dano Parcial" em verde/azul após o resultado aprovado
- Campo "Valor do Reparo (Orçamento)" com limite visual do teto FIPE×75%
- Texto explicativo: "Veículo será encaminhado para oficina parceira"
- Botão: "Aprovar Reparo Parcial"

### Fluxo 2 - Perda Total (≥ 75% FIPE)
- Mostrar banner de alerta vermelho com ícone de alerta
- Exibir o **valor FIPE como referência** em destaque (não editável)
- Campo "Percentual de Depreciação" (opcional, para calcular o valor final) OU campo "Valor da Indenização" pré-populado com o FIPE
- Checkbox de confirmação: "Confirmo que o veículo será baixado da plataforma"
- Texto explicativo: "Indenização integral — veículo será baixado da plataforma"
- Botão: "Aprovar Perda Total"

### Fluxo Negado
- Sem campo de valor (já funciona assim)
- Manter como está

## Detalhes Técnicos

### Arquivo Principal: `src/components/eventos/EmitirParecerModal.tsx`

**Mudanças na Interface:**

1. **Novo estado:** `tipoDanoManual: 'parcial' | 'perda_total' | 'auto'` — permite ao analista sobrescrever a classificação automática quando não há valor FIPE cadastrado
2. **Lógica de classificação aprimorada:**
   - Se há valor FIPE: automática (como hoje)
   - Se não há valor FIPE: analista seleciona manualmente entre "Dano Parcial" e "Perda Total"
3. **Campo de valor contextualizado:**
   - Para `parcial`: Label "Valor do Reparo (Orçamento)", hint "Máximo: 74,9% do valor FIPE = {X}"
   - Para `perda_total`: Label "Valor da Indenização", campo pré-populado com o valor FIPE, editável para aplicar depreciações
4. **Confirmação extra para Perda Total:**
   - Checkbox: "Confirmo que o veículo será baixado da plataforma"
   - Este checkbox é obrigatório para submeter como perda total
5. **Botão contextualizado:**
   - Dano Parcial aprovado: "Aprovar – Dano Parcial"
   - Perda Total aprovada: "Aprovar – Perda Total"
   - Negado: "Registrar Recusa"

**Lógica de validação atualizada (`isFormValid`):**
- Parcial aprovado: valor > 0 E valor <= 75% FIPE (quando há FIPE) E parecer >= 100 chars
- Perda Total aprovado: confirmação do checkbox ativa E valor > 0 E parecer >= 100 chars
- Negado: apenas parecer >= 100 chars

**Backend NÃO muda** — toda a lógica da `mutationFn` permanece idêntica (os mesmos status, inativação de veículo para perda total, notificação via `notificar-sinistro`, envio do termo pelo `autentique-evento-create`).

### Estrutura Visual do Modal Reformulado

```text
┌─────────────────────────────────────┐
│ Emitir Parecer Técnico              │
│ Sinistro SIN-XXXXXX                 │
├─────────────────────────────────────┤
│ [Info: Protocolo | Tipo | Veículo   │
│  Valor FIPE: R$ 70.000,00]          │
├─────────────────────────────────────┤
│ Resultado do Parecer *              │
│  ● Aprovado    ○ Negado             │
├─────────────────────────────────────┤
│ SE APROVADO e valor FIPE existe:    │
│ Classificação detectada:            │
│  [🔧 Dano Parcial] ou [⚠️ Perda Total] │
│  (editável se analista quiser mudar)│
│                                     │
│ SE DANO PARCIAL:                    │
│  Valor do Reparo (Orçamento) *      │
│  [R$ ___] ← máx R$ 52.500 (75% FIPE)│
│                                     │
│ SE PERDA TOTAL:                     │
│  ┌─────────────────────────────┐    │
│  │ ⚠️ PERDA TOTAL DETECTADA     │    │
│  │ O veículo será baixado da   │    │
│  │ plataforma após aprovação   │    │
│  └─────────────────────────────┘    │
│  Valor FIPE de Referência:          │
│  R$ 70.000,00 (não editável)        │
│  Valor da Indenização *             │
│  [R$ 70.000,00] ← pré-populado FIPE│
│  ☐ Confirmo baixa do veículo        │
│                                     │
│ SE NÃO HÁ VALOR FIPE + APROVADO:   │
│  Tipo de Dano * [Parcial|Perda Total│
│  (seleção manual)                   │
│  Valor Aprovado *                   │
│  [R$ ___]                           │
├─────────────────────────────────────┤
│ Parecer Técnico *                   │
│ [textarea 100+ chars]               │
├─────────────────────────────────────┤
│ [Cancelar]  [Aprovar – Dano Parcial]│
│         ou  [Aprovar – Perda Total] │
│         ou  [Registrar Recusa]      │
└─────────────────────────────────────┘
```

## Arquivos a Alterar

| Arquivo | Mudança |
|---|---|
| `src/components/eventos/EmitirParecerModal.tsx` | Reformular UI com dois fluxos distintos: parcial e perda total. Backend (mutationFn) sem alterações. |

## Garantias

- **Nenhuma lógica backend é removida ou substituída** — o fluxo de inativação de veículo, status `aguardando_pagamento`, envio de termo e notificação WhatsApp permanecem intactos
- **Compatibilidade garantida** com sinistros sem valor FIPE cadastrado (seleção manual de tipo de dano)
- **Fallback seguro** — se o analista tiver dúvida, a classificação automática já preenche o campo correto
