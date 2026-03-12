

## Diagnóstico

A Edge Function `notificar-inicio-rota/index.ts` tem uma **declaração duplicada** de variável:

- **Linha 119**: `const profissionalTelefone = profissional.whatsapp || profissional.telefone;`
- **Linha 172**: `const profissionalTelefone = profissional.whatsapp || profissional.telefone;`

Isso causa um erro de compilação no Deno (`SyntaxError: Identifier 'profissionalTelefone' has already been declared`), impedindo a função de sequer inicializar. Por isso não há nenhum log no dashboard.

O `useIniciarRota` no frontend invoca essa função em **background** (fire-and-forget), então o status do serviço muda para `em_rota` normalmente, mas a notificação WhatsApp nunca é enviada.

## Correção

**Arquivo: `supabase/functions/notificar-inicio-rota/index.ts`**

Remover a segunda declaração `const profissionalTelefone` na linha 172. A variável já existe no escopo desde a linha 119 e tem o mesmo valor. Basta apagar a linha duplicada.

Resultado: a função voltará a compilar, inicializar, e enviar o template `tecnico_a_caminho_1` para o cliente e a mensagem informativa para o profissional quando "Iniciar Rota" for clicado.

