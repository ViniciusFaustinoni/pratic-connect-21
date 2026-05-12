# Plano — WhatsApp na solicitação de documentos

## Causa raiz
Ao solicitar documentos no Cadastro, a edge function `notificar-cliente` é invocada e quebra com:

```
ReferenceError: associadoId is not defined
   notificar-cliente/index.ts:609 (linha do log: 612)
```

O código usa `associadoId` num `console.log`, mas a variável correta vinda do payload é `associado_id`. Como o erro acontece **antes** da chamada a `whatsapp-send-text`, nenhum WhatsApp é enviado para o associado. (Status final do log: `whatsapp: false`.)

Além disso, hoje o fluxo `useSolicitarDocumentos` notifica **apenas o associado**. O vendedor responsável pelo contrato **não é avisado**.

## O que vou fazer

1. **Corrigir o bug que impede o envio ao associado**
   - Substituir `associadoId` por `associado_id` no log da edge `notificar-cliente`.
   - Validar via logs que a chamada chega em `whatsapp-send-text` e dispara a mensagem com o template Meta `documentos_solicitados`.

2. **Notificar também o vendedor**
   - No hook `useSolicitarDocumentos` (após criar `documentos_solicitados`), buscar `vendedor_id` do contrato e o telefone do `profile`.
   - Disparar uma mensagem de WhatsApp para o vendedor avisando que o Cadastro solicitou documentos ao cliente, com:
     - nome do associado, placa/numero do contrato
     - lista resumida das pendências
     - link de acompanhamento (`/acompanhar/{link_token}`)
   - Usar o caminho padrão de envio (Meta/Evolution) seguindo as regras de safety/idempotência já adotadas no projeto.
   - Falha no envio ao vendedor não pode quebrar o fluxo de solicitação (try/catch + log).

3. **Validar**
   - Refazer uma solicitação de teste no contrato `CTR-20260512100945-NQE90C`.
   - Conferir nos logs de `notificar-cliente` e `whatsapp-send-text` que ambas mensagens (associado + vendedor) saíram com sucesso.

## Resultado esperado
- Cadastro solicita documentos → associado recebe WhatsApp imediatamente.
- O vendedor responsável pelo contrato recebe um WhatsApp avisando da pendência criada.
- Logs limpos, sem `ReferenceError`.

## Detalhes técnicos
- Arquivos afetados:
  - `supabase/functions/notificar-cliente/index.ts` (fix do log).
  - `src/hooks/usePropostasPendentes.ts` (`useSolicitarDocumentos`, adicionar notificação ao vendedor).
- Telefone do vendedor sai de `profiles.telefone` (confirmado: `[TESTE] Vendedor CLT` tem telefone `12493649737`).
- Template do associado já existe (`documentos_solicitados` no `META_TEMPLATE_MAP`); para o vendedor usaremos o template genérico já em uso para alertas internos.