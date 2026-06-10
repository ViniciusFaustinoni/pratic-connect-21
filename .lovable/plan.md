## Fase 2 — Saneamento pontual do caso Patrick Farias

Raiz já corrigida na Fase 1 (template + cascade fallback nas edges Autentique + tokens defensivos). Falta apenas reemitir o termo do contrato afetado para o cliente receber a versão com as placas no lugar certo.

### Alvo
- Associado: PATRICK FARIAS DE OLIVEIRA (CPF 180.146.127-95)
- Contrato: `CTR-20260606172721-Q70HEK`
- Substituição: placa anterior **RJN2A96** → placa nova **LTP7C50**
- Sintoma: termo atual lista LTP7C50 como "veículo com cobertura cancelada"

### Passos

1. **Validar estado antes de retificar** (read-only)
   - Confirmar `contratos` do Q70HEK: `status`, `assinado_em`, `substituicao_veiculo_id`, `veiculo_id` (deve apontar para o novo LTP7C50).
   - Confirmar `substituicoes_veiculo` correspondente: `placa_anterior=RJN2A96`, `veiculo_novo_id=<LTP7C50>`.
   - Conferir que o template em `documento_templates` já está com `{{substituicao.placa_anterior}}` (deploy Fase 1 aplicado).

2. **Reemitir o termo** via edge `retificar-termo-filiacao`
   - Payload: `{ contrato_id, motivo: "correção placas substituição (placa cancelada deve ser RJN2A96)", forcar: true }`.
   - A edge cria nova versão em `contrato_retificacoes`, dispara Autentique novo doc com `positions: gerarPosicoesAssinatura(...)`, envia para assinatura do Patrick.
   - Termo antigo permanece como histórico (não apaga).

3. **Verificação pós-envio**
   - Conferir nova linha em `contrato_retificacoes` com `versao` incrementada.
   - Conferir novo `autentique_document_id` no contrato.
   - Baixar o PDF gerado e confirmar visualmente: `(X) Subs. Placa ... cancelada) RJN2A96` e dados do veículo novo = LTP7C50.

4. **Notificar operação**
   - Mensagem para Maria Gleiciele: link novo de assinatura foi disparado ao cliente; pedir confirmação de recebimento antes de fechar o ticket.

### Não-objetivos
- Nenhuma mudança de código/migration nesta fase — raiz já está corrigida.
- Nenhum saneamento em massa de outros contratos (não há outros casos conhecidos pós-deploy; se aparecerem, abrir nova rodada).
- Não mexer em `substituicoes_veiculo` / `contratos.veiculo_id` (dados já estão corretos; o problema era só de renderização do termo).

### Riscos
- Se o cliente já tiver assinado o termo errado, a retificação gera segundo termo correto (versão controlada por `contrato_retificacoes`, padrão canônico já em uso).
- Créditos Autentique: 1 doc adicional com PF_FACIAL.
