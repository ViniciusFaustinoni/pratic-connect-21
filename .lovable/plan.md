

## Plano: Área de Testes WhatsApp com Bate-Papo

### O que será construído

Uma nova aba "Testes" na página de integração WhatsApp (`IntegracaoWhatsApp.tsx`) com uma interface de bate-papo que permite enviar mensagens de texto via Evolution API para o número da Meta configurado. O objetivo é testar o fluxo completo: Evolution envia → Meta recebe → webhook dispara → IA processa → responde.

### Componentes

**1. Nova aba na página `IntegracaoWhatsApp.tsx`**
- Adicionar 4ª tab "Testes" com ícone `FlaskConical`
- Grid `grid-cols-4` no TabsList

**2. Novo componente `WhatsAppTestChat.tsx`** (`src/components/whatsapp/WhatsAppTestChat.tsx`)
- Interface de chat com:
  - Header mostrando número Meta destino (lido de `whatsapp_meta_config.phone_number_id`) e status da Evolution
  - Área de mensagens com scroll automático (estilo balões de chat, similar ao `HistoricoConversaWhatsApp`)
  - Input de texto + botão Enviar
- Ao enviar:
  - Chama `supabase.functions.invoke('whatsapp-send-text')` com o telefone da Meta e a mensagem digitada
  - Mensagem aparece no chat local como "enviada" (lado direito, verde)
  - Polling a cada 5s em `whatsapp_mensagens` filtrando pelo telefone Meta para capturar respostas (entrada) — exibe no lado esquerdo
- Badge de aviso: "Modo teste — mensagens enviadas via Evolution para o número Meta configurado"

**3. Lógica de detecção do número Meta destino**
- Buscar `phone_number_id` + `display_phone_number` de `whatsapp_meta_config`
- Se não houver número configurado, exibir alerta pedindo para configurar na aba Conexão
- Formatar número para envio (ex: o display_phone_number da Meta ou fallback manual)

### Fluxo do teste
```text
[Diretor digita mensagem] 
  → whatsapp-send-text (via Evolution) 
    → Número Meta recebe 
      → Meta webhook dispara 
        → whatsapp-meta-webhook processa 
          → Delega para whatsapp-webhook (IA Maya) 
            → Maya responde via whatsapp-send-text 
              → Evolution envia resposta ao número Meta
                → Aparece no chat de teste
```

### Detalhes técnicos
- Nenhuma edge function nova — usa `whatsapp-send-text` existente
- Nenhuma migração SQL necessária
- O componente usa `useWhatsAppHistorico` para polling das respostas
- O número destino pode precisar de input manual caso `display_phone_number` não esteja salvo no banco (campo editável com fallback)

