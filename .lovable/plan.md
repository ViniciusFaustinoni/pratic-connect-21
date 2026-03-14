
## Objetivo
Garantir que a Maya responda 100% das mensagens do associado no WhatsApp, sem falhas intermitentes.

## Diagnóstico provável (pelo código atual)
1. `whatsapp-meta-webhook` usa delegação “fire-and-forget” para `whatsapp-webhook` sem `EdgeRuntime.waitUntil`, o que pode ser interrompido quando o webhook retorna 200 para a Meta.
2. `whatsapp-webhook` não trata `sendResult.ok === false` como falha real; isso gera “sucesso” em log mesmo sem envio.
3. Erros de IA/tool-call (timeout, parse de argumentos, falha de tool) podem encerrar o fluxo sem fallback visível ao associado.

## Plano de implementação
1. **Blindar delegação Meta (associado)**
   - Arquivo: `supabase/functions/whatsapp-meta-webhook/index.ts`
   - Migrar a delegação assíncrona para `EdgeRuntime.waitUntil(...)`.
   - Validar status HTTP + payload da chamada delegada.
   - Em falha, enviar fallback automático ao associado via `whatsapp-send-text` (`allow_text: true`) e registrar erro.

2. **Tornar envio da resposta confiável (fail-fast + retry)**
   - Arquivo: `supabase/functions/whatsapp-webhook/index.ts`
   - Após envio, verificar explicitamente `sendResult.ok`.
   - Se falhar, executar 1 retry automático antes de desistir.
   - Persistir log técnico detalhado (`whatsapp_logs`, tipo `erro_envio_ia`) para rastreio.

3. **Blindar pipeline de IA para nunca deixar o associado sem resposta**
   - Arquivo: `supabase/functions/whatsapp-webhook/index.ts`
   - Isolar bloco de IA/tool-calls em try/catch dedicado.
   - Parse seguro de `toolCall.function.arguments` (sem quebra por JSON inválido).
   - Se IA falhar (timeout/erro), enviar fallback curto e claro ao associado.

4. **Ajuste de robustez do modelo**
   - Arquivo: `supabase/functions/whatsapp-webhook/index.ts`
   - Aumentar limite de saída da IA (equivalente a `maxOutputTokens`) para reduzir truncamento em respostas mais complexas.
   - Ajustar limites de iteração/tool-call para diminuir risco de timeout acumulado.

5. **Validação de ponta a ponta (obrigatória)**
   - Testar sequência de mensagens no `WhatsAppTestChat` (incluindo “Bati meu carro”).
   - Confirmar que cada entrada gera saída correspondente no `whatsapp_mensagens`.
   - Validar também no fluxo real Meta: template de boas-vindas → resposta do associado → resposta da Maya em todas as tentativas.

## Arquivos-alvo
- `supabase/functions/whatsapp-meta-webhook/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`
