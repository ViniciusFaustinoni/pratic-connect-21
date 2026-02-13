
# Fluxo pos-aprovacao: Termo Autentique + bloqueio de acoes + notificacao WhatsApp via IA

## Resumo

Apos o diretor aprovar um sinistro, o sistema deve:
1. Criar e enviar o Termo de Entrada de Evento via Autentique (email para o associado)
2. Notificar o associado via WhatsApp (pela IA) informando que o reparo foi aprovado e que um email com o termo para assinatura foi enviado
3. Bloquear todas as acoes administrativas no sinistro enquanto o termo nao for assinado (exceto exclusao pelo diretor)

## Alteracoes

| Arquivo / Recurso | Descricao |
|---|---|
| `supabase/functions/aprovar-sinistro/index.ts` | Apos aprovar, chamar `autentique-evento-create` para enviar o termo. Alterar a mensagem WhatsApp para informar sobre o email com o termo. |
| `src/pages/eventos/SinistroAnalise.tsx` | Bloquear acoes (Aprovar, Reprovar, Solicitar Docs) quando sinistro tem `autentique_documento_id` mas `termo_anuencia_assinado !== true`. Mostrar aviso "Aguardando assinatura do termo". |

## Detalhes tecnicos

### 1. Edge Function `aprovar-sinistro/index.ts`

Apos atualizar o status para `em_analise` e registrar historico, adicionar duas etapas:

**a) Chamar `autentique-evento-create`:**
```typescript
// Apos registrar historico (linha ~82)
try {
  const { data: termoData, error: termoError } = await supabase.functions.invoke('autentique-evento-create', {
    body: { sinistro_id }
  });
  if (termoError) {
    console.error('[aprovar-sinistro] Erro ao criar termo Autentique:', termoError);
  } else {
    console.log('[aprovar-sinistro] Termo Autentique criado:', termoData);
  }
} catch (termoErr) {
  console.error('[aprovar-sinistro] Erro ao invocar autentique-evento-create:', termoErr);
}
```

**b) Alterar a mensagem WhatsApp** para informar sobre a aprovacao e o email com o termo:
```
Otimas noticias! O reparo do seu evento (protocolo XXX) foi APROVADO!

Enviamos um email para [email] com o Termo de Entrada de Evento.
Por favor, abra o email e assine o documento para dar continuidade ao processo.

Apos a assinatura, nossa equipe dara andamento aos proximos passos.
```

### 2. Frontend `SinistroAnalise.tsx`

Na secao de acoes (linhas ~506-546), adicionar verificacao:

```typescript
const aguardandoAssinatura = sinistro.autentique_documento_id && !sinistro.termo_anuencia_assinado;
```

Quando `aguardandoAssinatura === true`:
- Exibir aviso em azul: "Aguardando assinatura do Termo de Entrada de Evento pelo associado"
- Ocultar botoes Aprovar, Reprovar e Solicitar Documentos
- Manter visivel apenas o botao de Excluir (se existir e for diretor)

O botao de excluir ja e controlado pelo `PermissionGate` com permissao de diretor na pagina `SinistroDetalhe.tsx`, entao ele continuara disponivel.

Quando o webhook Autentique processar a assinatura (ja implementado em `autentique-webhook/index.ts`), o campo `termo_anuencia_assinado` sera marcado como `true`, desbloqueando as acoes automaticamente.
