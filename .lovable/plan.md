

# Consolidar Correções de Templates WhatsApp

## Problema

Dois ajustes pendentes nos templates WhatsApp:

1. **Instalação concluída** (`useServicos.ts`): Usa `assinatura_instalacao_v1` — deveria ser `assinatura_documento_v2` com parâmetros ajustados (`nomeDocumento` em vez de `veículo`)
2. **Técnico inicia rota** (`notificar-inicio-rota`): Envia `servico_atribuido_v1` ao técnico — duplica a notificação já enviada na atribuição. Deve enviar apenas texto com dados do cliente

## Alterações

### 1. `src/hooks/useServicos.ts` (~linha 1165)

Trocar template e ajustar parâmetros:

| Campo | Antes | Depois |
|---|---|---|
| `template_name` | `assinatura_instalacao_v1` | `assinatura_documento_v2` |
| `template_params` | `[nome, veículo]` | `[nome, "Termo de Instalação"]` |
| `template_button_params` | `[tokenAssinatura]` | `[tokenAssinatura]` (sem mudança) |

### 2. `supabase/functions/notificar-inicio-rota/index.ts` (linhas 218-229)

Remover `template_name` e `template_params` da chamada ao `whatsapp-send-text` para o profissional. Manter apenas a mensagem de texto:

```ts
const { error: whatsappError } = await supabase.functions.invoke('whatsapp-send-text', {
  body: {
    telefone: profissionalTelefone,
    mensagem: mensagem,
  }
});
```

## Resumo dos templates nos momentos corretos

| Momento | Destinatário | Template |
|---|---|---|
| Serviço atribuído (cron) | Técnico | `servico_atribuido_v1` |
| Técnico inicia tarefa | Associado | `tecnico_a_caminho_1` |
| Técnico inicia tarefa | Técnico | Apenas texto (dados do cliente) |
| Instalação concluída | Associado | `assinatura_documento_v2` |
| Confirmação véspera | Associado | `confirmacao_vespera_v1` |
| Confirmação manhã | Associado | `confirmacao_manha_v1` |
| Imprevisto/reagendamento | Associado | `reagendamento_servico` |

## Impacto
- 2 arquivos alterados (~8 linhas)
- 1 Edge Function para redeploy
- Elimina duplicidade de notificação ao técnico
- Template correto na conclusão de instalação

