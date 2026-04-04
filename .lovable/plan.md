

# Remover Template WhatsApp e Mostrar Link Autentique na Tela Pública

## Resumo

Parar de enviar o template WhatsApp `assinatura_documento_v2` com o link da Autentique. Em vez disso, mostrar o link diretamente na tela pública onde o associado já está (página de confirmação), com botões "Acessar Documento" e "Copiar Link".

## Alterações

### 1. Frontend — `ConfirmacaoVistoria.tsx` (contrato/filiação)

Substituir a seção "Verifique seu Email" (linhas 330-433) por uma nova seção com:
- Botão primário **"Acessar e Assinar Documento"** que abre `urlAssinatura` em nova aba
- Botão secundário **"Copiar Link"** que copia a URL para clipboard
- Manter o indicador de verificação automática e o botão "Verificar Agora"
- Remover referências a "verifique seu email" e "reenvio de email" (toda a lógica de `showResendOption`, `handleResendEmail`, `showEmailIncorrect`)

### 2. Frontend — `EventoAguardandoTermo.tsx` (sinistros/eventos)

Atualizar para receber `autentiqueUrl` como prop e mostrar:
- Botão **"Acessar e Assinar Termo"** (abre link)
- Botão **"Copiar Link"** 
- Remover texto "Verifique seu e-mail e WhatsApp"
- Manter polling de verificação automática

### 3. Edge Functions — Remover envio do template WhatsApp

Em **4 edge functions**, remover o bloco `try/catch` que envia o template `assinatura_documento_v2` via `whatsapp-send-text`:

| Arquivo | Linhas aproximadas |
|---------|-------------------|
| `autentique-create-by-token/index.ts` | 761-784 |
| `autentique-create/index.ts` | ~725-750 |
| `autentique-evento-create/index.ts` | 461-476 |
| `autentique-vistoria-create/index.ts` | ~365-375 |

Manter a atualização de `whatsapp_enviado` como false / remover campos obsoletos.

### 4. Template WhatsApp na base

Desativar o template `assinatura_documento_v2` na tabela `whatsapp_meta_templates` (set `status = 'DELETED'` ou equivalente).

## Detalhes técnicos

**ConfirmacaoVistoria** — A seção `urlAssinatura` (linha 330) passa a renderizar:
```
┌──────────────────────────────────┐
│ 📝 Assine seu Contrato           │
│                                  │
│ Clique abaixo para acessar e     │
│ assinar seu contrato digital.    │
│                                  │
│ [🔗 Acessar e Assinar Documento] │
│ [📋 Copiar Link]                 │
│                                  │
│ 🔄 Verificando automaticamente.. │
└──────────────────────────────────┘
```

**EventoAguardandoTermo** — Layout similar, com `autentiqueUrl` vindo do sinistro.

## Arquivos alterados
- `src/components/associado/ConfirmacaoVistoria.tsx`
- `src/components/evento/EventoAguardandoTermo.tsx`
- `supabase/functions/autentique-create-by-token/index.ts`
- `supabase/functions/autentique-create/index.ts`
- `supabase/functions/autentique-evento-create/index.ts`
- `supabase/functions/autentique-vistoria-create/index.ts`
- 1 migração SQL para desativar o template

