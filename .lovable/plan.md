# Bug

Após o Monitoramento aprovar uma troca de titularidade **sem solicitar vistoria**, o link público do novo titular mostra "Vistoria do veículo solicitada" em vez de continuar o fluxo de assinatura + pagamento (como em uma cotação comum).

## Causa raiz

`supabase/functions/contrato-gerar/index.ts` (linhas 1302-1397) sempre que detecta `tipo_entrada === 'troca_titularidade'`:
1. Cria um serviço `vistoria_entrada` (mesmo quando o Monitoramento não pediu).
2. **Flipa a solicitação de `liberada_para_assinatura` para `aguardando_vistoria` imediatamente após gerar o contrato**.

Como o `CotacaoContratacao.tsx` só considera `trocaLiberada = status === 'liberada_para_assinatura' || 'efetivada'`, qualquer outro status volta ao `<TelaAnaliseTrocaTitularidade />` que exibe "Vistoria solicitada". Resultado: o novo titular recebe o termo de filiação por e-mail mas a página pública trava na tela de "vistoria pendente".

# Correção

## 1. `supabase/functions/contrato-gerar/index.ts`
- **Não** flipar para `aguardando_vistoria` ao gerar o contrato. Manter `liberada_para_assinatura`.
- Continuar gravando `novo_associado_id` na solicitação (idempotente).
- Criar o serviço `vistoria_entrada` apenas quando a solicitação **já estava** em `aguardando_vistoria` (Monitoramento pediu) — caso contrário, deixar a criação para o gatilho pós-pagamento/assinatura.
- Ajustar a notificação WhatsApp: avisar "contrato gerado, assine por e-mail e finalize o pagamento" em vez de "vistoria em breve".

## 2. Avanço para `aguardando_vistoria` após assinatura + pagamento
Adicionar lógica (trigger ou edge `aprovar-proposta` / webhook Autentique) que, quando o contrato da troca atinge `assinado` + adesão paga:
- Se o Monitoramento já tinha pedido vistoria → manter `aguardando_vistoria` (já está).
- Caso contrário → criar agora o serviço `vistoria_entrada` e mover a solicitação para `aguardando_vistoria`. Esse é o ponto onde a tela pública passa a exibir "Vistoria do veículo solicitada" (correto), pois assinatura/pagamento foram concluídos.

Implementação preferencial: trigger SQL `trg_troca_pos_assinatura_pagamento` em `contratos` (AFTER UPDATE quando `status` vira `ativo`/`assinado` e `cotacoes.adesao_paga`), seguindo o padrão de `trg_efetivar_troca_pos_vistoria`.

## 3. `src/pages/public/CotacaoContratacao.tsx`
- Manter o gating atual (`liberada_para_assinatura` libera o fluxo) — nenhuma mudança necessária se a correção #1 for feita.
- Garantir que o `useSolicitacaoTrocaPublicaPorCotacao` re-fetcha após `contrato-gerar` para refletir o status (ele já mantém `liberada_para_assinatura`).

## 4. `src/components/troca-titularidade/TelaAnaliseTrocaTitularidade.tsx`
- Adicionar copy específico para `aguardando_vistoria` quando `aprovado_monitoramento_em` indica que veio do fluxo pós-assinatura (mensagem mais clara: "Contrato assinado. Aguardando vistoria do veículo para efetivar a troca.").
- Sem mudança estrutural — apenas o texto.

# Detalhes técnicos

- O trigger `trg_efetivar_troca_pos_vistoria` continua válido: dispara quando o serviço `vistoria_entrada` é aprovado e então cancela contrato antigo + ativa novo + transfere veículo.
- Memória `mem://logic/operations/troca-titularidade-desvinculo-logico` permanece respeitada (flag `em_troca_titularidade` segue setada na assinatura do termo de cancelamento).
- Memória `mem://architecture/activation/single-source-activation`: nenhuma escrita direta de `status='ativo'` é introduzida.

# Arquivos afetados

- `supabase/functions/contrato-gerar/index.ts` (remover flip de status; condicionar criação de vistoria; ajustar mensagem WA)
- Migração SQL nova: trigger `trg_troca_pos_assinatura_pagamento` em `contratos`
- `src/components/troca-titularidade/TelaAnaliseTrocaTitularidade.tsx` (texto)
- (Opcional) `mem://logic/operations/troca-titularidade-desvinculo-logico` para registrar o novo ponto de avanço de status
