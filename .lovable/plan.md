
## Plano: Corrigir integração WhatsApp para nova Evolution API

### Problema Raiz

A função `whatsapp-webhook` usa `instancia.api_url` (URL antiga no banco de dados) em vez do secret `EVOLUTION_API_URL` em **todas** as chamadas à Evolution API, incluindo:
- Envio de mensagens de texto/mídia
- Download de mídia recebida
- Respostas da IA aos associados

### Arquivos a Modificar

**1. `supabase/functions/whatsapp-webhook/index.ts`**

Aplicar a mesma estratégia usada nas outras funções: priorizar o secret `EVOLUTION_API_URL` sobre a URL do banco.

```text
Alteracoes necessarias:

1. Apos buscar a instancia (~linha 1970), adicionar:
   const apiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;

2. Substituir TODAS as ocorrencias de `instancia.api_url` por `apiUrl`:
   - Linhas 827, 974, 1057, 1156 (envio media/location/contact nas tools)
   - Linhas 1685, 1710 (confirmacao agendamento)
   - Linhas 1992, 2020, 2038, 2055 (download de midia)
   - Linhas 2146, 2182 (vinculacao documentos)
   - Linhas 2294, 2341, 2420 (envio resposta IA)
```

### Passos de Implementacao

1. Adicionar variavel `apiUrl` que prioriza secret sobre banco de dados
2. Substituir todas as 15+ ocorrencias de `instancia.api_url` por `apiUrl`
3. Deploy da funcao atualizada
4. Configurar webhook na nova Evolution API
5. Testar envio de mensagem "BATI DE CARRO" novamente

### Visao Geral das Alteracoes

```text
// Antes (linha ~1970):
const { data: instancia } = await supabase
  .from("whatsapp_instancias")
  ...

// Depois:
const { data: instancia } = await supabase
  .from("whatsapp_instancias")
  ...

if (!instancia) { ... }

// NOVA LINHA - Priorizar secret
const apiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
console.log(`[whatsapp-webhook] Usando API URL: ${apiUrl}`);
```

Todas as chamadas que usavam:
```typescript
await fetch(`${instancia.api_url}/message/sendText/...`)
```

Passam a usar:
```typescript
await fetch(`${apiUrl}/message/sendText/...`)
```

### Detalhes Tecnicos

| Item | Antes | Depois |
|------|-------|--------|
| URL para envio | `instancia.api_url` (banco) | `apiUrl` (secret prioritario) |
| URL antiga | `https://evolution.praticcar.org` | - |
| URL nova | - | `https://evolution.controledepropostas.com/` |
| Ocorrencias afetadas | 15+ lugares | Todas corrigidas |

### Funcionalidades Corrigidas

- Resposta da IA a mensagens de associados
- Download e transcricao de audios
- Recebimento de imagens e documentos
- Envio de boletos PDF
- Envio de localizacao de veiculos
- Envio de cartao de contato
- Vinculacao de documentos a sinistros
- Respostas a leads
- Confirmacao de agendamentos

### Teste Final

Apos as correcoes:
1. Enviar mensagem "BATI DE CARRO" via WhatsApp
2. Verificar logs do webhook para confirmar processamento
3. Confirmar que a IA respondeu corretamente
