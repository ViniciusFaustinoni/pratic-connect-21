

## Tornar visível a opção "Regra do 1% (FIPE Menor)" no formulário de cotação

### Diagnóstico

O motor da Regra do 1% **já está 100% implementado no backend e na lógica do componente**:

- Cálculo de elegibilidade (`fipeMenorInfo`) usando `entity_eligibility_rules` com fallback para tabela legada — `src/components/cotacoes/CotacaoFormDialog.tsx:415-480`
- Estados (`solicitarFipeMenor`, `justificativaFipeMenor`)
- Validação no submit + criação da solicitação em `aprovacoes_fipe_menor`
- Tela de aprovações pelo supervisor (`/vendas/aprovacoes`) já operacional
- Switch para ligar/desligar a regra globalmente em `Configurações › FIPE Menor 1%`

**O que falta**: nenhum elemento de UI renderiza o painel para o consultor marcar "Quero solicitar FIPE menor" e digitar a justificativa. Também não há limites por tipo de veículo (R$ 120k carros / R$ 27k motos) nem checagem de blindagem.

### O que será feito

**1) Renderizar painel FIPE Menor no `CotacaoFormDialog.tsx`** (logo após "Faixa enquadrada", linha ~1807)

Lógica de exibição em cascata:
- Só aparece se `fipeMenorAtivo === true` (config global)
- Só aparece se `fipeMenorInfo !== null` (ou seja: já passa do mínimo configurado e existe faixa inferior calculada)
- Estado A (**veículo elegível**): card verde com badge "Elegível", mostrando:
  - FIPE atual → FIPE - 1% → faixa antiga vs faixa nova
  - Mensalidade atual vs reduzida → "Economia de R$ X/mês"
  - Checkbox "Solicitar FIPE Menor (sujeito a aprovação por e-mail em até 24h úteis)"
  - Quando marcado → `Textarea` obrigatório (≥ 5 caracteres) para justificativa
- Estado B (**não elegível pelo cálculo**): card cinza informativo "Veículo não se enquadra: FIPE - 1% continua na mesma faixa"
- Estado C (**bloqueado por restrição comercial**): card amber explicando o motivo (limite por tipo, blindado, depreciação)

**2) Adicionar restrições comerciais por tipo de veículo**

Novas chaves em `configuracoes` (categoria `operacional`):
- `fipe_menor_limite_carro` (default: `120000`)
- `fipe_menor_limite_moto` (default: `27000`)

A função `fipeMenorInfo` passa a retornar também `bloqueado: { motivo: string } | null` quando:
- `tipoVeiculoDetectado === 'moto'` e `valorFipe > fipe_menor_limite_moto`
- `tipoVeiculoDetectado === 'carro'` e `valorFipe > fipe_menor_limite_carro`
- `veiculoBlindado === true`
- Plano selecionado tem cobertura 100% e veículo está com depreciação ativa

**3) Diretoria › Configurações**

Adicionar os dois novos limites no card "FIPE Menor 1%" (junto ao switch já existente), com inputs numéricos (R$) e textos auxiliares.

### Detalhes técnicos

- Arquivos alterados:
  - `src/components/cotacoes/CotacaoFormDialog.tsx` — adicionar bloco JSX após linha 1807 + estender `fipeMenorInfo` com checagens de bloqueio
  - `src/pages/diretoria/Configuracoes.tsx` — expandir card FIPE Menor com 2 inputs de limite
  - Migration SQL — inserir as 2 novas chaves em `configuracoes`
- A elegibilidade continua usando exclusivamente `entity_eligibility_rules` (motor moderno) — sem reintroduzir tabelas legadas
- Limite mínimo (`fipe_menor_limite_minimo`, default R$ 30k) já existente é preservado
- Cota mensal por consultor (1 a 5 pedidos baseados no desempenho) **não entra neste escopo** — fica como recomendação de evolução futura, pois exige nova tabela e cálculo de vendas do mês anterior. Caso queira incluir agora, me avise antes de aprovar.

### Como ficará (esquema)

```text
[Faixa enquadrada: R$ 70.000 – R$ 75.000]

┌─────────────────────────────────────────────────────────┐
│ ✓ Elegível à Regra do 1% (FIPE Menor)        [Badge]    │
│                                                         │
│ FIPE atual:      R$ 75.600                              │
│ FIPE - 1%:       R$ 74.844  → cai na faixa anterior    │
│ Faixa atual:     R$ 75.000–80.000  → R$ 198,00/mês     │
│ Faixa reduzida:  R$ 70.000–75.000  → R$ 184,00/mês     │
│ Economia:        R$ 14,00/mês                           │
│                                                         │
│ ☐ Solicitar FIPE Menor                                  │
│   (Aprovação por e-mail em até 24h úteis)               │
│                                                         │
│ [Justificativa: __________________________]             │
└─────────────────────────────────────────────────────────┘
```

