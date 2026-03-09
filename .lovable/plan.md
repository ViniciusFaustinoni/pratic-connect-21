

# Correção: Tela Travada na Aprovação + WhatsApp API

## Problema 1: Tela Travada ao Aprovar (Roubo e Furto)

**Causa raiz**: Em `PropostaAnalise.tsx`, a função `handleConfirmarAprovacao` (linha 93) fecha o dialog (`setShowConfirmAprovar(false)`) e depois faz `await aprovarMutation.mutateAsync(id)` **sem try/catch**. Se a mutation falha (timeout, erro de RLS, erro em edge functions chamadas internamente como geocode, SGA, Softruck), o erro é uma promise rejection não tratada. A navegação (linhas 116-120) nunca executa e o usuário fica preso na página sem feedback.

Além disso, o botão do hero header mostra "Aprovando..." durante todo o processo (que envolve geocodificação, SGA Hinova, notificação WhatsApp — pode demorar vários segundos), sem indicador visual de progresso na página principal.

**Correção**:
- Envolver `handleConfirmarAprovacao` em try/catch
- Em caso de erro, exibir toast e permitir que o usuário tente novamente (não navegar)
- Em caso de sucesso, navegar normalmente

**Arquivo**: `src/pages/cadastro/PropostaAnalise.tsx` (linhas 93-121)

---

## Problema 2: WhatsApp API — Mensagens Não Enviadas

**Análise dos logs**: A edge function `whatsapp-send-text` mostra envio bem-sucedido via Meta API (13:23:42, status ✓). A `notificar-cliente` também processou com sucesso (WhatsApp: true). A `whatsapp-send-media` não tem logs recentes (sem chamadas).

Isto indica que **o envio de texto funciona**, mas possivelmente:
1. Envios de **mídia** (PDFs, documentos) não estão funcionando — `whatsapp-send-media` sem logs
2. Ou mensagens **fora da janela de 24h** estão falhando silenciosamente (erro 131026 da Meta — requer template aprovado)

**Correção**: Adicionar logging robusto e fallback na `whatsapp-send-media`, e verificar se a função está sendo efetivamente chamada. Também melhorar o tratamento de erro 131026 (fora da janela 24h) com mensagem clara ao usuário.

**Arquivos**: 
- `supabase/functions/whatsapp-send-media/index.ts` — adicionar logs de entrada
- `supabase/functions/whatsapp-send-text/index.ts` — melhorar tratamento de erro de janela 24h

---

## Resumo de Alterações

| Arquivo | Alteração |
|---|---|
| `src/pages/cadastro/PropostaAnalise.tsx` | Adicionar try/catch em `handleConfirmarAprovacao` |
| `supabase/functions/whatsapp-send-media/index.ts` | Adicionar logs de entrada para rastreabilidade |
| `supabase/functions/whatsapp-send-text/index.ts` | Melhorar tratamento de erro 131026 (janela 24h) |

