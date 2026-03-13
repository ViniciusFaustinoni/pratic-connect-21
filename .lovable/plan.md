

## Painel de Conversas IA na aba "IA & Respostas"

### O que será construído

Um painel de conversas abaixo dos cards existentes (Assistente IA + Estatísticas) na tab "IA & Respostas", mostrando todas as conversas WhatsApp agrupadas por contato, com possibilidade de clicar para ver o histórico completo em um dialog.

### Componentes

**1. Novo componente `WhatsAppConversasPainel`** (`src/components/integracoes/WhatsAppConversasPainel.tsx`)

- Lista de conversas agrupadas por telefone, consultando `whatsapp_mensagens` agrupado por `telefone`
- Cada item mostra: nome do contato, telefone, última mensagem (preview), data/hora, total de mensagens, badge de direção
- Filtro/busca por nome ou telefone
- Paginação ou scroll infinito
- Ao clicar em uma conversa, abre o dialog `ConversaIADialog` (já existente) ou reutiliza o `HistoricoConversaWhatsApp` em um dialog
- Botão de atualizar lista

**2. Query direta no banco** (sem depender da edge function `whatsapp-find-chats`)

```sql
-- Conversas agrupadas
SELECT telefone, nome_contato, 
       COUNT(*) as total_mensagens,
       MAX(created_at) as ultima_mensagem,
       (SELECT mensagem FROM whatsapp_mensagens m2 
        WHERE m2.telefone = m1.telefone 
        ORDER BY created_at DESC LIMIT 1) as ultima_msg_texto
FROM whatsapp_mensagens m1
GROUP BY telefone, nome_contato
ORDER BY ultima_mensagem DESC
```

Como o Supabase client não suporta `GROUP BY` diretamente, usaremos uma abordagem de buscar as mensagens mais recentes por telefone distinto, ou criaremos um hook dedicado com RPC/query criativa.

**Abordagem simplificada**: Buscar as últimas N mensagens ordenadas por `created_at DESC`, agrupar no frontend por telefone. Isso é viável dado o volume atual (poucos contatos).

**3. Alteração em `IntegracaoWhatsApp.tsx`**

Na tab `ia`, adicionar o componente abaixo do grid dos 2 cards:

```tsx
<TabsContent value="ia" className="space-y-6">
  <div className="grid gap-6 md:grid-cols-2">
    <WhatsAppIAConfig />
    <WhatsAppStats />
  </div>
  <WhatsAppConversasPainel />  {/* NOVO */}
</TabsContent>
```

**4. Dialog de conversa individual**

Reutilizar o `HistoricoConversaWhatsApp` existente dentro de um `Dialog`, passando o telefone selecionado. Assim o histórico completo com balões de chat, sincronização e auto-scroll já funciona.

### Arquivos modificados

- `src/components/integracoes/WhatsAppConversasPainel.tsx` — novo
- `src/pages/configuracoes/IntegracaoWhatsApp.tsx` — adicionar import e uso

