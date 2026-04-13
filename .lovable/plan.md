

## Plano: Evolution API como fallback para aprovação da diretoria + reconhecimento de diretores pela IA

### Contexto
Atualmente, `notificar-diretoria-fipe` envia via `whatsapp-send-text` que roteia para Meta API (se ativa) ou Evolution. O fallback atual para template Meta não aprovado é enviar texto livre via Meta — mas texto livre proativo é bloqueado pela Meta fora da janela 24h. Além disso, a IA do webhook não reconhece diretores e não processa respostas como "APROVAR"/"RECUSAR".

### Alterações

**1. `notificar-diretoria-fipe/index.ts` — Forçar Evolution como fallback**
- Quando o template Meta `autorizacao_fipe_diretoria` não está `APPROVED`: usar `force_provider: 'evolution'` no payload enviado a `whatsapp-send-text`
- Atualizar a `urlPainel` de `https://app.praticcar.org/vendas/aprovacoes-fipe` para `https://app.praticcar.org/diretoria/aprovacoes`
- Incluir o link completo no corpo da mensagem fallback com o domínio publicado

**2. `whatsapp-webhook/index.ts` — Reconhecer diretores e processar aprovações**
- Antes de encaminhar mensagem para a IA (Maya), verificar se o remetente é um diretor (via `profiles` + `user_roles`)
- Se o diretor responder "APROVAR" ou "RECUSAR" (case-insensitive), buscar a aprovação pendente mais recente desse diretor em `aprovacoes_fipe_diretoria`
- Atualizar o status da aprovação (`aprovado`/`recusado`) e `respondido_em`
- Verificar se todos os diretores já responderam; se sim, atualizar `cotacoes.fipe_diretoria_aprovado` (true se aprovado pela maioria, false se recusado)
- Responder ao diretor com confirmação ("Voto registrado: APROVADO ✅" / "Voto registrado: RECUSADO ❌")
- Se o diretor enviar outra mensagem qualquer, encaminhar normalmente para a IA

**3. Mensagem de fallback com link correto**
- URL: `https://app.praticcar.org/diretoria/aprovacoes`
- Corpo: incluir link clicável no texto da mensagem Evolution

### Escopo
- 2 Edge Functions editadas (`notificar-diretoria-fipe`, `whatsapp-webhook`)
- Sem migrations, sem alterações no frontend

### Detalhes Técnicos

```text
Fluxo de envio:
  CotacaoFormDialog → notificar-diretoria-fipe → whatsapp-send-text
                                                    ├─ Meta template APPROVED → Meta API
                                                    └─ Meta template !APPROVED → Evolution API (force_provider)

Fluxo de resposta:
  Diretor responde via WhatsApp → whatsapp-webhook
    ├─ Texto = "APROVAR"/"RECUSAR" → Processar voto em aprovacoes_fipe_diretoria
    │   └─ Todos responderam? → Atualizar cotacoes.fipe_diretoria_aprovado
    └─ Outro texto → IA (Maya) normal
```

