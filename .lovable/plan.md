
Objetivo: resolver na raiz por que o envio para o SGA “não registra”, eliminando seleção errada de veículo/contrato, payload inconsistente e falhas silenciosas.

1) Diagnóstico raiz (mapeado no código)
- `usePropostasPendentes.ts` aprova contrato, mas busca veículo por `associado_id + limit(1)` em vez de usar o veículo do contrato (`contratos.veiculo_id`), podendo enviar o veículo errado ao SGA.
- `useAtivacoes.ts` também mapeia veículo por associado (Map por `associado_id`), então contratos diferentes do mesmo associado podem apontar para o mesmo veículo e disparar sync incorreto.
- `sga-hinova-sync/index.ts` lê `HINOVA_CODIGO_CONTA`/credencial, mas no payload envia `codigo_conta: 2` fixo (hardcoded), ignorando configuração real.
- O autoenvio no fluxo de aprovação captura erro como “não crítico” e não garante fallback de fila quando a chamada da função falha antes de executar no backend.

2) Correção de arquitetura (fonte única de verdade)
- Padronizar contexto do sync: sempre usar `contrato_id + contrato.veiculo_id + contrato.associado_id`.
- Nunca resolver veículo “pelo associado” para enviar ao SGA.
- Remover hardcode de `codigo_conta` e usar valor configurado (credenciais/env), com validação explícita.

3) Mudanças por arquivo
- `src/hooks/usePropostasPendentes.ts`
  - Incluir `veiculo_id` no select de `contratos`.
  - Trocar todas as buscas de veículo `associado_id + limit(1)` por `id = contrato.veiculo_id`.
  - Disparar `sga-hinova-sync` com `veiculo_id` do contrato (determinístico).
  - Se invoke falhar no client, inserir fallback na `sga_sync_queue` (como já existe em `useAtivacoes`) para não perder processamento.

- `src/hooks/useAtivacoes.ts`
  - No carregamento da lista: mapear veículo por `contrato.veiculo_id` (não por `associado_id`).
  - No `useAtivarContrato`: ao autoenviar SGA, usar `contrato.veiculo_id`; se ausente, abortar com aviso claro.
  - Evitar que botão/manual de SGA opere com veículo de outro contrato.

- `supabase/functions/sga-hinova-sync/index.ts`
  - Substituir `codigo_conta: 2` por `codigoContaResolvido` (vindo de credencial/env).
  - Validar `codigoContaResolvido` (numérico > 0), logar valor usado.
  - Na busca de contrato para vendedor/categoria, priorizar `veiculo_id` + `associado_id` (não só associado).
  - Melhorar logs de diagnóstico (`sga_sync_logs`) com contexto: `veiculo_id`, `associado_id`, `codigo_conta`, contrato resolvido.

4) Blindagem adicional
- Não marcar sucesso visual sem confirmação real do retorno da API Hinova.
- Manter fila de reenvio como caminho obrigatório quando houver qualquer falha de chamada.
- Mensagem de erro operacional clara para time (ex.: “veículo do contrato ausente”, “codigo_conta inválido”, “falha autenticação Hinova”).

5) Validação pós-correção (obrigatória)
- Cenário A: associado com múltiplos veículos/contratos → aprovar contrato específico e confirmar que o `veiculo_id` enviado ao SGA é o do contrato aprovado.
- Cenário B: verificar payload em logs (`codigo_conta` correto, não hardcoded).
- Cenário C: simular falha de invoke e confirmar criação na `sga_sync_queue`.
- Cenário D (E2E): aprovar contrato → verificar registro no SGA para o cliente/placa corretos e atualização local (`codigo_hinova`, `status_sga`).

Detalhes técnicos
- Ponto crítico principal: ambiguidade por associado (`limit(1)`) em fluxos que exigem vínculo por contrato/veículo.
- Ponto crítico secundário: `codigo_conta` hardcoded impede consistência com a conta configurada da integração.
- Resultado esperado: envio determinístico, rastreável e resiliente (sem perda silenciosa) para todos os fluxos de ativação/aprovação.
