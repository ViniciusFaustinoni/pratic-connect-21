## Reset da troca KOU6D37 / solicitação `52cc74c1`

Voltar a troca para o estado "termo de cancelamento assinado, aguardando o novo titular escolher plano no link público".

### Estado atual
- `solicitacoes_troca_titularidade` `52cc74c1-910d-4ac7-b854-84cd28db7a0d`: status `liberada_para_assinatura`, com cotação `d66e2a78` vinculada e cadastro auto-aprovado.
- `cotacoes` `d66e2a78`: `contrato_assinado`, vistoria base agendada.
- `contratos` `0e64bad0`: assinado.
- `agendamentos_base` `d37947e8`: agendado.

### Migration de reset (data-only, via tool de migration)

1. Apagar `agendamentos_base` `d37947e8-2f06-4897-b8ad-34539e0dbfdd`.
2. Apagar `contratos` `0e64bad0-9980-4991-9d33-4b9058a4109e` (e dependentes em cascata caso existam: parcelas, mensalidades, documento_assinaturas, etc. — caso a FK não cascade, fazemos `DELETE` direto na tabela com cascade já existente; se faltar algo, removemos sob demanda).
3. Apagar `cotacoes` `d66e2a78-a3c8-4839-bfa7-742bcd7c2b5b`.
4. Atualizar `solicitacoes_troca_titularidade` `52cc74c1-...`:
   - `cotacao_id = NULL`
   - `aprovado_cadastro_em = NULL`
   - `aprovado_monitoramento_em = NULL`
   - `servico_vistoria_id = NULL`
   - `motivo_reprovacao = NULL`
   - `status = 'liberada_para_assinatura'` (mantém — termo já assinado libera o link público a seguir direto pra escolha de plano, conforme regra atual)
   - Preserva `termo_cancelamento_assinado_em`, `novo_titular_dados`, `veiculo_id` e demais campos do termo.
5. Garantir que `veiculos.em_troca_titularidade = true` permanece em KOU6D37 (não mexer).

### Resultado esperado no link público
Ao reabrir o link da troca para Marcus Vinicius Faustinoni, o público entra direto no fluxo de **Escolha do Plano** (sem cotação prévia), e o restante segue Plano → Documentos → Contrato → Vistoria → Pagamento conforme o fluxo unificado já implementado.

### Fora de escopo
- Mexer no termo de cancelamento, no veículo KOU6D37 ou nos dados do antigo titular.
- Alterações de código.
