Confirmei parcialmente: o fluxo principal de aprovação de cadastro já tem a regra de enviar ao SGA como pendente quando o veículo precisa aguardar instalação, mas há pontos que ainda podem violar a regra e precisam ser ajustados.

Situação encontrada:

1. Aprovação pelo cadastro
- Em `supabase/functions/aprovar-proposta/index.ts`, quando o veículo precisa de rastreador e ainda não há instalação concluída, o sistema define:
  - associado: `aguardando_instalacao`
  - contrato: `assinado`, sem `data_ativacao`
  - SGA: `status_sga_destino = 'pendente'`
- Isso respeita a regra de subir para o SGA como pendente após aprovação do cadastro.
- O histórico também registra que Roubo/Furto foi ativado e que aguarda instalação para Proteção 360.

2. Ativação definitiva após aprovação técnica/monitoramento
- Em `src/hooks/useAprovacaoMonitoramento.ts`, ao aprovar a instalação no monitoramento, o sistema ativa veículo/associado/contrato e chama `sga-hinova-sync` com `status_sga_destino = 'ativo'`.
- Isso respeita a regra de ativação definitiva automática após aprovação técnica/monitoramento.

3. Pontos de risco encontrados
- Existem botões e hooks que ainda chamam `sga-hinova-sync` diretamente como `ativo`, por exemplo:
  - `src/components/cadastro/BotaoAtivarSGA.tsx`
  - `src/components/ativacao/BotaoEnviarSGA.tsx`
  - `src/hooks/useSGASync.ts`
  - `src/hooks/useAtivacoes.ts`
- Esses pontos podem permitir ativação no SGA como ativo antes da instalação/aprovação técnica, dependendo da tela e permissões.
- O fluxo de conclusão pelo instalador (`src/hooks/useServicos.ts`) conclui instalação e vincula rastreador, mas não deve ativar SGA diretamente. A ativação correta acontece depois, na aprovação pelo monitoramento. Isso está coerente.
- O fluxo de prestador externo (`supabase/functions/concluir-instalacao-prestador/index.ts`) conclui instalação e sincroniza plataforma de rastreamento, mas não ativa SGA como ativo. Também está coerente, desde que passe pela aprovação/validação posterior.

Plano de correção:

1. Centralizar a decisão de destino SGA
- Criar/ajustar uma função utilitária de regra no frontend para decidir se o envio ao SGA pode ser `pendente` ou `ativo` com base em:
  - necessidade de rastreador;
  - existência de instalação concluída;
  - aprovação técnica/monitoramento;
  - status atual do veículo/associado.
- Evitar chamadas manuais diretas com `status_sga_destino: 'ativo'` fora do ponto autorizado.

2. Proteger botões manuais de SGA
- Atualizar `BotaoAtivarSGA`, `BotaoEnviarSGA` e `useSGASync` para:
  - enviar como `pendente` quando ainda não há aprovação técnica/monitoramento;
  - impedir ou avisar quando tentarem ativar como `ativo` antes da instalação aprovada;
  - manter o envio `ativo` apenas quando a regra permitir.

3. Corrigir ativação automática antiga
- Ajustar `src/hooks/useAtivacoes.ts`, que atualmente ativa contrato e dispara SGA como `ativo`, para respeitar a mesma regra:
  - se precisa rastreador e ainda não teve aprovação técnica: SGA `pendente`;
  - se não precisa rastreador ou instalação já aprovada: SGA `ativo`.

4. Reforçar regra no backend
- Adicionar validação defensiva em `supabase/functions/sga-hinova-sync/index.ts` para que uma chamada com `status_sga_destino = 'ativo'` só seja aceita se o veículo estiver elegível para ativação definitiva.
- Se não estiver elegível, a função deve rebaixar para `pendente` ou retornar erro controlado, evitando que qualquer tela consiga burlar a regra.

5. Manter o ponto correto de ativação definitiva
- Preservar `useAprovacaoMonitoramento.ts` como o ponto responsável por ativar definitivamente no SGA após aprovação técnica/monitoramento.
- Garantir que, ao aprovar, ele atualize a cobertura total e chame SGA como `ativo` automaticamente.

6. Ajustar textos da interface
- Atualizar mensagens dos botões/modais para deixar claro:
  - “Enviar ao SGA como pendente” antes da instalação aprovada;
  - “Ativar definitivamente no SGA” apenas após aprovação técnica.

Arquivos previstos:
- `supabase/functions/sga-hinova-sync/index.ts`
- `src/hooks/useAprovacaoMonitoramento.ts`
- `src/hooks/useAtivacoes.ts`
- `src/hooks/useSGASync.ts`
- `src/components/cadastro/BotaoAtivarSGA.tsx`
- `src/components/ativacao/BotaoEnviarSGA.tsx`
- possivelmente um utilitário novo/compartilhado em `src/lib` para a regra de elegibilidade SGA.

Resultado esperado:

```text
Aprovação cadastro
  -> libera Roubo/Furto conforme regra
  -> envia SGA como PENDENTE se precisa rastreador
  -> aguarda instalação

Instalador/prestador conclui instalação
  -> registra rastreador e conclusão
  -> NÃO ativa SGA definitivo ainda

Monitoramento/técnico aprova
  -> ativa Proteção 360 / cobertura total
  -> ativa associado/contrato
  -> envia SGA como ATIVO automaticamente
```

Com isso, o sistema passa a respeitar a regra de ponta a ponta e remove os caminhos manuais que hoje podem ativar o SGA antes da etapa correta.