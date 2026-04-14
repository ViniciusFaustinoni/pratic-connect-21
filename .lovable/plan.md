

## Plano: Permitir que Evolution processe mensagens para o Agente Vinicius mesmo com Meta ativa

### Problema
O webhook ignora TODAS as mensagens da Evolution quando `whatsapp_meta_config.ativo = true` (linha 2865). Isso impede o agente Vinicius de funcionar, pois ele opera exclusivamente pela Evolution.

### Solucao

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

Remover o bloqueio total na linha 2858-2868 e substituir por logica que permite o processamento de mensagens Evolution para o agente consultor:

1. **Remover o bloqueio**: eliminar o `if (metaConfig?.ativo === true) { return... }` que descarta todas as mensagens Evolution
2. **Manter separacao de responsabilidades**: quando Meta esta ativa e a mensagem vem da Evolution, o webhook deve encaminhar para o `agente-consultor-ia` normalmente (fluxo de vendas/diretor/associado)
3. **A Maya (IA de suporte) continua operando apenas via Meta** — esse bloqueio so fazia sentido para a Maya, nao para o Vinicius

A alteracao e pontual: substituir o return precoce por um log informativo e deixar o fluxo continuar para o agente consultor.

### Arquivo editado
- `supabase/functions/whatsapp-webhook/index.ts` — remover bloqueio de mensagens Evolution quando Meta ativa

