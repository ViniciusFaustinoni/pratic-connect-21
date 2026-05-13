## Diagnóstico

A cotação `COT-20260513-185143655-935` está com `cenario_adesao = isenta_base` e `valor_adesao = 0`. Hoje, em `src/pages/public/CotacaoContratacao.tsx`, há esta regra:

```ts
const pularEtapaPagamento = isTrocaTitularidade && trocaLiberada && isCenarioIsento;
```

Quando a troca é isenta, todo o passo "Pagamento" é **removido do stepper**, do `navOrder` e do `etapaDoStatus`. Após a vistoria, o fluxo pula direto para a tela de "Vistoria Agendada com Sucesso!" — exatamente o que aparece no print enviado.

Na **nova adesão**, isso **não** acontece: a etapa de Pagamento sempre é renderizada. Quando a adesão é isenta (valor 0 ou agência recebe em mãos), o próprio `EtapaPagamentoCotacao.tsx` (linhas ~243–320) detecta, mostra a mensagem "Parabéns! Sua adesão foi isenta" e chama `criar-instalacao-pos-pagamento` com `skipPaymentCheck: true`, avançando o status normalmente.

Ou seja: a troca de titularidade está **divergindo** da nova adesão exatamente no ponto que o usuário pediu para igualar.

## Mudanças propostas

### 1. `src/pages/public/CotacaoContratacao.tsx` — remover o atalho de pagamento da troca

- Apagar `isCenarioIsento` e `pularEtapaPagamento`.
- `STEPS` volta a ser sempre `STEPS_BASE` (mais `STEP_INSTALACAO` quando autovistoria), igual à nova adesão.
- `navOrder` volta para `[0,1,2,3,4,5]` sem filtro.
- `etapaDoStatus`: remover os ramos que saltam para `5` quando `pularEtapaPagamento`. Mantém só a regra "vistoria escolhida ⇒ etapa 4".
- `isEtapaConcluida(4)`: remover o early-return `if (pularEtapaPagamento) return true`.
- Remover o `useEffect` que força `etapaAtual = 5` quando `pularEtapaPagamento && etapaAtual === 4`.
- `handleContratoAssinado`: remover o ramo especial que chama `ativar-associado` ali na assinatura do contrato em troca isenta. A ativação volta a sair do mesmo gatilho da nova adesão (pós-pagamento → `criar-instalacao-pos-pagamento` → vistoria/instalação concluídas → aprovação Monitoramento → `ativar-associado`, que então chama `efetivar-troca-titularidade`, conforme `aprovar-troca-monitoramento` já refatorado).
- Manter intactas as proteções `isTrocaTitularidade && !trocaLiberada` (tela "Em análise" enquanto termo não estiver assinado) e a auto-vinculação da cotação órfã.

### 2. `EtapaPagamentoCotacao.tsx` — nenhuma mudança necessária

Já cobre: adesão zerada (mostra "Adesão isenta" + invoca `criar-instalacao-pos-pagamento`), agência recebe em mãos, e fluxo padrão ASAAS (PIX/boleto/cartão). Como a troca agora cai nesse mesmo passo, herda automaticamente o comportamento.

### 3. `criar-instalacao-pos-pagamento` — verificação rápida

Confirmar que, ao processar uma cotação com `dados_extras.tipo_entrada = 'troca_titularidade'`, ela:
- usa a data agendada da vistoria/instalação (já é regra firmada — sem `default = hoje`);
- atualiza `cotacoes.status_contratacao = 'pagamento_ok'` (e depois `'contrato_gerado'`/`'ativo'` conforme fluxo padrão);
- não tenta criar contrato duplicado (a troca já tem `contratos.id` criado por `vincular-cotacao-troca`).

Se algum desses pontos divergir para troca, ajustar localmente sem mudar o contrato da função para nova adesão. Caso esteja tudo OK, nenhuma alteração é necessária.

### 4. Reset de teste

Para refazer o teste a partir do estágio "Vistoria agendada", reverter a cotação `d66e2a78-a3c8-4839-bfa7-742bcd7c2b5b` para `status_contratacao = 'contrato_assinado'` (ou anterior) com `tipo_vistoria` mantido, para que o stepper volte ao Pagamento. Migration enxuta, sem mexer em outros registros.

## Fluxo final esperado (troca de titularidade, pós-termo de cancelamento assinado)

```
Plano  →  Documentos  →  Contrato  →  Vistoria  →  Pagamento  →  (Instalação se autovistoria)
                                                       │
                                                       ├── isenta: "Adesão isenta" + skipPaymentCheck
                                                       └── cobra:  PIX/boleto/cartão padrão
                                                       │
                                          criar-instalacao-pos-pagamento (mesma regra da nova adesão)
                                                       │
                              Aprovação Monitoramento → ativar-associado → efetivar-troca-titularidade
```

Idêntico à nova adesão, com a única diferença sendo a efetivação da troca disparada por `ativar-associado` (já implementado).

## Fora de escopo

- Mudar regras de cenário (cobra/isenta) ou cálculo de valor de adesão.
- Alterar `EtapaPagamentoCotacao` ou ASAAS.
- Mexer no fluxo da nova adesão.
