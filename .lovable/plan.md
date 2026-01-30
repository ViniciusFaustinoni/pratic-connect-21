

## Plano: Corrigir envio de mensagem WhatsApp e testar

### Problema Identificado

A função `whatsapp-send-text` está usando a URL antiga do banco de dados (`https://evolution.praticcar.org`) em vez do secret `EVOLUTION_API_URL` (`https://evolution.controledepropostas.com/`). Isso causa falha no envio.

### Arquivos a Modificar

**1. `supabase/functions/whatsapp-send-text/index.ts`**

Adicionar priorização do secret `EVOLUTION_API_URL`:

```typescript
// Linha ~60 (após verificar EVOLUTION_API_KEY)
// PRIORIZAR URL do secret sobre a URL do banco
const apiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
if (!apiUrl) {
  return new Response(
    JSON.stringify({ success: false, error: "URL da Evolution API não configurada" }),
    { status: 500, headers: corsHeaders }
  );
}

// Linha ~100 - Alterar de:
// ${instancia.api_url}/message/sendText/...
// Para:
// ${apiUrl}/message/sendText/...
```

### Teste a Executar

Após a correção, enviar mensagem de boas vindas para:
- **Associado**: MARCUS VINICIUS FAUSTINONI DE FREITAS
- **Telefone**: 21992593830

### Detalhes Técnicos

| Item | Antes | Depois |
|------|-------|--------|
| URL usada | `instancia.api_url` (banco) | `EVOLUTION_API_URL` (secret) |
| URL real | `https://evolution.praticcar.org` | `https://evolution.controledepropostas.com/` |

### Passos de Implementacao

1. Editar `whatsapp-send-text/index.ts`:
   - Adicionar leitura do secret `EVOLUTION_API_URL`
   - Usar variavel `apiUrl` com prioridade para o secret
   - Atualizar a chamada de fetch para usar `apiUrl`

2. Deploy da funcao

3. Verificar status atual da instancia (pode precisar atualizar banco para `open`)

4. Enviar mensagem de teste

5. Verificar logs e confirmar entrega

