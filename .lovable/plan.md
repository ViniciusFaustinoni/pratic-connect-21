## Contexto

`COT-20260521-002944030-565` é troca de titularidade com termo assinado em 20/05 18:15 BRT — a janela mesmo-dia (até 23:59:59 BRT do dia 20) já expirou. Pelo manual, a partir desse momento o fluxo passa a se comportar como **adesão normal acima da FIPE mínima** (FIPE R$ 30.835, carro, mínimo R$ 30k): autovistoria é **opcional para liberar R&F**, vistoria presencial agenda normalmente. Por isso, a opção de Vistoria/Autovistoria **deve continuar aparecendo** — o que está fora do canônico é a **ordem**: hoje o stepper exibe Vistoria antes de Pagamento. Quando há pagamento, ele vem **antes** da vistoria. Quando há isenção (`valor_adesao=0`, como nesta cotação), o passo Pagamento detecta sozinho e auto-avança.

## O que muda

Arquivo único: `src/pages/public/CotacaoContratacao.tsx`.

### 1. `STEPS_BASE` (linhas 52–58) — reordenar

```text
0 Plano  →  1 Documentos  →  2 Contrato  →  3 Pagamento  →  4 Vistoria
                                             (auto-skip se isento)
+ 5 Instalação (apenas quando tipo_vistoria === 'autovistoria')
```

### 2. `isEtapaConcluida` (linhas 282–301) — trocar mapeamento dos cases 3 e 4

- `case 3` (agora **pagamento**) → `statusConcluidos.pagamento`
- `case 4` (agora **vistoria**) → checa `cotacao.tipo_vistoria` ou `statusConcluidos.vistoria`
- `case 5` (instalação para autovistoria) — inalterado

### 3. `etapaDoStatus` / `determinarEtapa` (em `src/lib/etapaDoStatus.ts`)

Atualizar o map para a nova ordem:

- `documentos_ok` → 3 (pagamento)
- `pagamento_ok` → 4 (vistoria)
- `vistoria_ok` / `autovistoria_ok` / `vistoria_agendada` / `aguardando_aprovacao_*` → 5 (final / instalação)

Backwards-compatible: o `useEffect` (linha 400) continua usando `Math.max` implícito via override do troca expirado.

### 4. `navOrder` (linhas 389–392) — passar a refletir nova ordem

```ts
// dentro da janela mesmo-dia (troca): pula Vistoria (índice 4)
dispensaVistoriaTroca ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5]
```

Quando `dispensaVistoriaTroca=true` e adesão é isenta, o `EtapaPagamentoCotacao` já auto-avança (lógica `skipPaymentCheck`) → cai direto na tela de acompanhamento (índice 5).

### 5. Override troca-pós-pagamento (linhas 354–362) — manter

A regra que joga troca em `pagamento_ok|contrato_gerado|ativo` para etapa 5 (tela de acompanhamento) continua válida: troca não tem etapa de "instalação para o cliente" — o destino após pagamento é o acompanhamento (mesmo quando expirou e vai precisar de vistoria, ela é agendada via a etapa 4 antes disso).

### 6. Renderização condicional (linhas ~900–1200) — swap

Trocar `etapaAtual === 3` (vistoria) ↔ `etapaAtual === 4` (pagamento) nos blocos render. Conteúdo de cada componente inalterado.

### 7. `handleContratoAssinado` (linhas 418–426) — sem mudança lógica

`navOrder.indexOf(2) + 1` continua apontando corretamente para 3 (agora Pagamento) na nova ordem.

## Validação por cenário


| Cenário                                    | Ordem visível                                                                     | Observação                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Nova adesão acima FIPE — paga              | Plano → Docs → Contrato → **Pagamento** → Vistoria                                | Autovistoria opcional dentro da etapa                |
| Nova adesão acima FIPE — isenta            | Plano → Docs → Contrato → Pagamento (auto-skip) → Vistoria                        | Pagamento detecta zero e avança                      |
| Sub-FIPE — paga                            | Plano → Docs → Contrato → Pagamento → **Autovistoria** + Instalação               | Autovistoria obrigatória                             |
| Troca dentro da janela — paga              | Plano → Docs → Contrato → Pagamento → Vistoria → Acompanhamento                   | Vistoria dispensada                                  |
| Troca dentro da janela — isenta            | Plano → Docs → Contrato → Pag (skip) → Vistoria → Acompanhamento                  | Direto ao Cadastro                                   |
| **Troca expirada (caso COT-565)** — isenta | Plano → Docs → Contrato → Pag (skip) → **Vistoria/Autovistoria** → Acompanhamento | Mesma régua de adesão acima FIPE                     |
| Troca expirada — paga                      | Plano → Docs → Contrato → **Pagamento** → Vistoria → Acompanhamento               | Penúltima tela = Pagamento, exatamente como descrito |


## Fora de escopo

- Edge functions (`aprovar-proposta`, `contrato-gerar`, `criar-instalacao-pos-pagamento`)
- Internals do `EtapaPagamentoCotacao` (já tem auto-skip)
- Internals do `EtapaVistoria` (mantém oferta de autovistoria/levar à base/rota)
- Cron de expiração de troca (já existente)
- Migrations