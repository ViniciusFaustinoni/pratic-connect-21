

## Plano: Substituir link WhatsApp por telefone do técnico no template "Técnico a Caminho"

### Problema
A Meta não permite envio de links no corpo de templates. O template `tecnico_a_caminho_1` recebe um link `wa.me/...` como parâmetro 4, que é bloqueado. O usuário quer que seja enviado o telefone formatado do técnico no lugar.

### Alterações

**1. `supabase/functions/notificar-cliente/index.ts`** (linha ~466)
- Trocar o parâmetro 4 de `tecnico_whatsapp_link` para `tecnico_telefone` (que já vem formatado como `(XX) XXXXX-XXXX`)
- Resultado: o template recebe o número de telefone em vez do link

```typescript
// De:
(dados?.tecnico_whatsapp_link as string) || '',
// Para:
(dados?.tecnico_telefone as string) || 'Não informado',
```

**2. `supabase/functions/notificar-cliente/index.ts`** (linha ~149)
- Na mensagem de fallback de texto, trocar `{tecnico_whatsapp_link}` por `{tecnico_telefone}` para consistência

```
// De:
💬 *WhatsApp:* {tecnico_whatsapp_link}
// Para:
📞 *Contato:* {tecnico_telefone}
```

**3. `supabase/functions/notificar-inicio-rota/index.ts`** (linhas ~124-126, ~142)
- Remover a montagem de `profissionalWhatsappLink` (não será mais usado)
- Remover `tecnico_whatsapp_link` do body enviado ao `notificar-cliente`
- Confirmar que `tecnico_telefone` já está sendo enviado corretamente (já está, linha 141)

### Resultado
- O template Meta recebe o telefone formatado `(XX) XXXXX-XXXX` no lugar do link
- Meta não bloqueia mais o envio
- O cliente vê o telefone do técnico para contato direto

### Arquivos
- `supabase/functions/notificar-cliente/index.ts`
- `supabase/functions/notificar-inicio-rota/index.ts`

