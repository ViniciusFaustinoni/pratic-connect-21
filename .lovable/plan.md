## Fluxo desejado (após o termo de cancelamento assinado)

A troca de titularidade passa a seguir **exatamente** o mesmo caminho da nova adesão a partir da assinatura do termo. O novo titular abre o link público da cotação e percorre o stepper padrão:

```
1 Escolha do Plano  →  2 Documentos  →  3 Contrato  →  4 Vistoria  →  5 Pagamento
```

Diferenças mínimas (mantidas da troca):
- O termo de cancelamento já assinado é pré-requisito para a cotação ser vinculada — sem ele, `vincular-cotacao-troca` continua retornando `TERMO_NAO_ASSINADO`.
- Cenário isento (sem cobrança de adesão) pula a etapa **5 Pagamento** e dispara `ativar-associado` direto após a Vistoria.
- A **transferência real do veículo** (`efetivar-troca-titularidade`) só ocorre depois da aprovação do Monitoramento + ativação do associado — não durante a vistoria.

### Linha do tempo completa

```text
[Antes da cotação]
  Termo de cancelamento assinado pelo titular antigo
  Cadastro auto-aprovado em vincular-cotacao-troca
  status = liberada_para_assinatura

[Link público — fluxo idêntico à nova adesão]
  1 Plano        → seleção do plano (Realizar Cotação no painel)
  2 Documentos   → CNH frente/verso, CRLV, comprovante (OCR + revisão manual)
  3 Contrato     → Autentique (PF_FACIAL) — webhook autentique-webhook
  4 Vistoria     → autovistoria OU presencial (mesmas regras FIPE de adesão)
  5 Pagamento    → adesão (PIX/boleto/cartão); pulada em cenário isento

[Pós-pagamento]
  criar-instalacao-pos-pagamento → cria serviço de instalação/vistoria base
                                    com a data agendada pelo cliente
  Conclusão da instalação/vistoria → fila Monitoramento › Aprovações
  aprovar-troca-monitoramento (manual) →
      └─ ativar-associado (lock + CAS): novo associado/contrato/veículo = ativo
      └─ efetivar-troca-titularidade: transfere veiculo_id para o novo
                                       associado, encerra contrato antigo,
                                       limpa em_troca_titularidade, snapshot SGA
  status final = efetivada
```

## Análise do estado atual (o que está errado)

Em `src/pages/public/CotacaoContratacao.tsx` (linhas ~216–305) a troca hoje:

1. **Reordena o stepper** para `Plano → Docs → Vistoria → Contrato → Pagamento` (vistoria antes do contrato). Isso diverge do print enviado pelo usuário (Contrato vem antes da Vistoria).
2. **Pula a Vistoria** quando o Monitoramento não pediu explicitamente (`vistoriaTrocaSolicitada`). Resultado: o link público vai direto para Pagamento sem capturar fotos do veículo, ao contrário da adesão.
3. **Efetivação acoplada à vistoria**: `processar-vistoria/index.ts:384` chama `efetivar-troca-titularidade` assim que a vistoria é aprovada — antes do pagamento e antes do Monitoramento. A transferência ocorre cedo demais.
4. **Trigger de promoção** (`20260512183714_…sql`) move `liberada_para_assinatura → aguardando_monitoramento` ao concluir a vistoria, sem passar pela mesma fila padrão de Aprovação de Associados.
5. Tela pública "Em análise pelo Cadastro" só aparece para itens legados (já corrigido), mas a `TelaAnaliseTrocaTitularidade` ainda lista "Análise do Cadastro" como passo ativo.

## Mudanças propostas

### 1. Stepper público igual à adesão
`src/pages/public/CotacaoContratacao.tsx`
- Remover `pularEtapaVistoria`, `vistoriaTrocaSolicitada`, a reordenação Vistoria↔Contrato, e os blocos `if (isTrocaTitularidade && !pularEtapaVistoria)` que mexem em `STEPS`/`navOrder`.
- Manter apenas `pularEtapaPagamento` (cenário isento) e a tela de bloqueio enquanto `!trocaLiberada`.
- Resultado: `STEPS_BASE` é usado como está → `Plano → Docs → Contrato → Vistoria → Pagamento`.

### 2. Vistoria obrigatória pelas mesmas regras da adesão
- A escolha autovistoria × presencial passa a respeitar as regras FIPE/Diesel padrão (componente `EtapaVistoria` já trata). Nada de "vistoria só se monitoramento pediu".
- Remover do schema/uso de `solicitacoes_troca_titularidade.status = 'aguardando_vistoria'` o significado "Monitoramento solicitou" — mantemos o status apenas para compatibilidade de itens antigos; novos fluxos não dependem dele.

### 3. Pagamento dispara instalação igual à adesão
`supabase/functions/criar-instalacao-pos-pagamento/index.ts`
- Garantir que o caminho de troca (cotação com `tipo_entrada = 'troca_titularidade'`) também crie o serviço de instalação/vistoria base com a data agendada (regra já existente para adesão; só precisamos confirmar que não tem early-return para troca).

### 4. Aprovação do Monitoramento + ativação como gatilho único da efetivação
- Em `supabase/functions/processar-vistoria/index.ts` **remover** o `fetch(... efetivar-troca-titularidade ...)` (linha ~384). A vistoria não efetiva mais a troca.
- Em `supabase/functions/ativar-associado/index.ts`: ao final do sucesso, se o contrato tem `origem_troca_titularidade_id`, invocar `efetivar-troca-titularidade` (idempotente — já trata reentry).
- Em `supabase/functions/aprovar-troca-monitoramento/index.ts`: deixar de marcar `efetivada` direto; passar a apenas marcar `aprovado_monitoramento_em` + chamar `ativar-associado`. A `efetivar-troca-titularidade` será chamada por `ativar-associado` (passo acima), evitando duplicidade.
- Trigger `fn_promover_troca_para_monitoramento` (migration `20260512183714_…`): manter, pois a fila Monitoramento › Aprovação de Associados continua sendo o gate; apenas confirmar que ela só promove após a vistoria **aprovada** (já é o caso).

### 5. Tela pública de bloqueio
`src/components/troca-titularidade/TelaAnaliseTrocaTitularidade.tsx` + `TimelineAprovacao.tsx`
- Substituir o passo "Análise do Cadastro" por um único marcador "Termo de cancelamento assinado" já concluído.
- A tela "Em análise" só aparece em estados legados (`aguardando_cadastro`).

### 6. Reset da troca KOU6D37 para retestar
Migration única:
- DELETE em `agendamentos_base` e `cotacoes` ligadas à placa KOU6D37 com `tipo_entrada='troca_titularidade'`.
- DELETE em `instalacoes` órfãs criadas no teste anterior para essa cotação.
- UPDATE `solicitacoes_troca_titularidade` `52cc74c1-…` zerando `cotacao_id`, `aprovado_*`, `servico_vistoria_id`, `efetivada_em`, `analise_previa_*`, `motivo_reprovacao`, `reprovado_*`, mantendo `termo_cancelamento_assinado_em` e `novo_titular_dados`.
- Status fica `aguardando_cadastro` apenas para fins de listagem; ao salvar a próxima cotação a edge `vincular-cotacao-troca` vai promover para `liberada_para_assinatura` automaticamente.

### 7. Memórias do projeto
- Atualizar `mem://logic/operations/troca-titularidade-monitoramento-pos-vistoria` para refletir: "stepper público idêntico à adesão (Plano→Docs→Contrato→Vistoria→Pagamento); efetivação ocorre dentro de ativar-associado após aprovação do Monitoramento; vistoria não efetiva mais a troca".

## Validação após mudanças (admin = diretor)
1. Abrir solicitação de troca KOU6D37 → "Realizar Cotação" → escolher plano qualquer → salvar.
2. No link público (em aba anônima) confirmar stepper exato `1 Plano · 2 Documentos · 3 Contrato · 4 Vistoria · 5 Pagamento`.
3. Avançar até confirmar agendamento da vistoria/instalação (mesmo ponto que já validamos para adesão).
4. Conferir que a solicitação `52cc74c1` segue em `liberada_para_assinatura` (não pula para `efetivada` antes da hora) e que o veículo continua com `em_troca_titularidade=true`.

## Fora de escopo
- Mudar o gating do termo de cancelamento (continua obrigatório).
- Mexer no fluxo legado de `aguardando_cadastro` (porta de fallback permanece).
- Alterar regras de FIPE/elegibilidade da Vistoria (são as mesmas da adesão).
