## Problema confirmado
Hoje, no link público da troca de titularidade (`/public/CotacaoContratacao.tsx`), assim que o cliente envia os documentos, a navegação avança para a Etapa 2 (Contrato) e essa etapa renderiza imediatamente o card `TelaAnaliseTrocaTitularidade` ("Em análise pelo Cadastro") enquanto `solicitacaoTroca.status !== 'liberada_para_assinatura'`.

Com isso o cliente nunca consegue abrir as etapas seguintes (Vistoria, escolha entre Autovistoria/Presencial, agendamento da vistoria de campo) — fica preso esperando o Cadastro liberar para só depois ver Vistoria/Pagamento.

A intenção do produto é que, na troca, o link público siga o mesmo padrão da cotação comum: **Plano → Documentos → Vistoria + Agendamento**, e só então caia em "Em análise pelo Cadastro" (que continua sendo o gate para Contrato/Pagamento, pois assinatura/pagamento dependem da aprovação do Cadastro + Monitoramento).

## Plano final de etapas para troca de titularidade (link público)

```text
1. Escolha do Plano        (livre)
2. Documentos do novo titular (livre)
3. Vistoria                (livre — escolher autovistoria/presencial e agendar)
4. Em análise pelo Cadastro / Contrato
   - se troca NÃO liberada => mostra TelaAnaliseTrocaTitularidade
   - se troca liberada     => mostra EtapaAssinaturaContrato (Autentique)
5. Pagamento               (igual hoje, com regra de isenta_*)
```

Para cotação comum, nada muda. Para substituição, nada muda.

## O que vou ajustar em `src/pages/public/CotacaoContratacao.tsx`

1. **Reordenar as etapas internamente para troca de titularidade**
   - Hoje a ordem interna fixa é `['plano','documentos','contrato','vistoria','pagamento','instalacao']`.
   - Em troca, vou tratar Vistoria como a 3ª etapa visível e Contrato como a 4ª, sem mexer na ordem de cotação comum.
   - Implementação: o array `STEPS_BASE` continua igual; quando `isTrocaTitularidade` for true, vou montar um STEPS específico que troca a ordem para `Plano → Documentos → Vistoria → Contrato → Pagamento` (mantendo a etapa "Instalação" extra para autovistoria).
   - O mapeamento `internalToVisible` / `visibleToInternal` que já existe vai cuidar da diferença entre o índice interno (mantido) e o índice visível do Stepper.

2. **Liberar a navegação de Vistoria antes da aprovação do Cadastro**
   - Hoje `etapaDoStatus` trava o avanço pelo `status_contratacao`. Em troca, após `dados_preenchidos` o cliente fica parado em 2 (Contrato bloqueado por análise).
   - Vou ajustar `etapaDoStatus` (e os efeitos de sincronização) para que em troca, depois de `dados_preenchidos`, a etapa máxima alcançável seja a Vistoria (índice interno 3), não o Contrato (índice 2).
   - Em outras palavras: para troca, a sequência permitida é Plano → Documentos → Vistoria, independente do status da `solicitacao_troca`. Contrato só fica acessível quando `trocaLiberada === true`.

3. **Não bloquear a Etapa 2 com a tela de análise**
   - Removo a renderização da `TelaAnaliseTrocaTitularidade` da Etapa 2 e a movo para a Etapa 2/Contrato somente quando o cliente já passou pela Vistoria.
   - Regra: a tela "Em análise pelo Cadastro" só aparece se:
     - `isTrocaTitularidade && !trocaLiberada`, **e**
     - o cliente já está na etapa de Contrato (índice interno 2) **e** já marcou a Vistoria (`tipo_vistoria` preenchido ou agendamento criado).
   - Antes disso, a Etapa de Contrato simplesmente não é alcançável manualmente em troca — o `NavegacaoEtapas` para de avançar na Vistoria.

4. **Vistoria na troca (Etapa 3)**
   - Reaproveita o componente `EtapaVistoria` + `AgendamentoVistoriaCompleta` já usado na cotação comum.
   - Atenção a duas regras já existentes que precisam continuar valendo:
     - `pularEtapaVistoria` (troca liberada SEM solicitação de vistoria): se cair nesse cenário só depois da Vistoria já ter sido feita, mantém comportamento atual.
     - `vistoria_concluida_em` / `tipo_vistoria` preenchidos: já marcam a etapa como concluída.
   - Observação importante: para troca, mesmo antes do Cadastro aprovar, o cliente já pode escolher Autovistoria ou Presencial e agendar. Isso só registra `tipo_vistoria` / agendamento na cotação — não promove veículo a ativo (a ativação continua passando pelo `ativar-associado` após pagamento/Monitoramento, sem mudança no fluxo de backend).

5. **Handlers de avançar/voltar**
   - Atualizo `handleAvancar` / `handleVoltar` / efeito de "etapa pulada" para considerar que, em troca, a transição padrão passa por Vistoria antes do Contrato.
   - Nada disso muda a navegação da cotação comum.

6. **Stepper visual**
   - Em troca, o Stepper passa a mostrar:
     `Escolha do Plano · Documentos · Vistoria · Contrato · Pagamento` (+ Instalação se autovistoria).
   - Para refletir o estado, o passo "Contrato" recebe um badge tipo "Aguardando análise" enquanto `!trocaLiberada` (visual no Stepper), e a `TelaAnaliseTrocaTitularidade` aparece somente quando o cliente entra nesse passo.

## O que NÃO muda

- Backend, edge functions (`vincular-cotacao-troca`, `ativar-associado`, `aprovar-proposta`, etc.), tabelas e triggers continuam iguais.
- Fluxo de cotação comum, substituição e cotação avulsa: sem alteração visual nem de regra.
- Bypass de travas de placa em `CotacaoFormDialog` (já implementado): inalterado.
- A regra de troca liberada + isenta (pular Pagamento) e troca sem vistoria solicitada (pular Vistoria) continuam vivas, agora aplicadas sobre a nova ordem.

## Validação manual

Usar a placa `KOU6D37` (troca em `aguardando_cadastro`):
1. Abrir o link público da cotação dessa troca.
2. Verificar que o cliente consegue:
   - escolher o plano
   - enviar documentos
   - **avançar para Vistoria** e escolher Autovistoria ou Presencial
   - **agendar a vistoria** normalmente
3. Ao tentar avançar para Contrato, ver `TelaAnaliseTrocaTitularidade` ("Em análise pelo Cadastro").
4. Após Cadastro + Monitoramento aprovarem (`solicitacao.status = liberada_para_assinatura`), o passo Contrato libera Autentique e segue para Pagamento normalmente.
5. Conferir que cotação comum (sem troca) continua passando direto: Plano → Docs → Contrato → Vistoria → Pagamento.

## Arquivos previstos

- `src/pages/public/CotacaoContratacao.tsx` (única alteração de código)
- Nenhuma edge function, nenhuma tabela, nenhum hook precisa mudar.
