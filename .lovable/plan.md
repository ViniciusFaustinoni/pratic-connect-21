

# Plano: Enviar Notificação WhatsApp ao Aprovar Proposta para Roubo e Furto

## Problema

Quando o analista aprova a proposta para "Roubo e Furto", o cliente **não recebe notificação** informando que pode criar sua conta no app. A página de acompanhamento mostra o formulário de criação de conta, mas o cliente não sabe que precisa acessá-la.

## Análise do Fluxo Atual

```text
Analista aprova         associados.status    Página /acompanhar/:token      Cliente
  proposta       --->   muda para 'ativo'   ---> mostra "Criar Conta"       não sabe
                                                                              ↑
                                            ❌ SEM NOTIFICAÇÃO!              |
```

## Solução

Adicionar chamada à edge function `notificar-cliente` com um **novo template** que inclua o link de acompanhamento, após a aprovação da proposta.

## Mudanças Necessárias

### 1. Edge Function `notificar-cliente/index.ts`

Adicionar novo template `proposta_aprovada_roubo_furto`:

```typescript
proposta_aprovada_roubo_furto: {
  titulo: '🎉 Proposta Aprovada!',
  mensagem: 'Parabéns {nome}! Seu cadastro foi aprovado e a cobertura de Roubo e Furto já está ativa!\n\nAcesse o link abaixo para criar sua conta no app PRATIC:\n🔗 {link_acompanhamento}\n\nApós a instalação do rastreador, sua proteção será completa. Bem-vindo à PRATIC!',
  emailTemplate: 'generico',
},
```

### 2. Hook `usePropostasPendentes.ts`

Na mutation `useAprovarProposta`, após aprovar o associado e criar a instalação (linha ~1470), adicionar chamada de notificação:

```typescript
// 9. NOTIFICAR CLIENTE VIA WHATSAPP (NOVO)
// Buscar link_token do contrato para enviar link de acompanhamento
const { data: contratoComLink } = await supabase
  .from('contratos')
  .select('link_token')
  .eq('id', contratoId)
  .single();

if (contratoComLink?.link_token) {
  try {
    const linkAcompanhamento = `${window.location.origin}/acompanhar/${contratoComLink.link_token}`;
    
    await supabase.functions.invoke('notificar-cliente', {
      body: {
        tipo: 'proposta_aprovada_roubo_furto',
        associado_id: associadoId,
        dados: {
          link_acompanhamento: linkAcompanhamento,
        },
      },
    });
    console.log('[useAprovarProposta] Notificação WhatsApp enviada');
  } catch (notifError) {
    console.warn('[useAprovarProposta] Erro ao enviar notificação (não crítico):', notifError);
  }
}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/notificar-cliente/index.ts` | Adicionar template `proposta_aprovada_roubo_furto` |
| `src/hooks/usePropostasPendentes.ts` | Adicionar chamada à notificação após aprovação |

## Fluxo Após Correção

```text
Analista aprova       associados.status     notificar-cliente       Cliente recebe
  proposta     --->  muda para 'ativo' ---> envia WhatsApp    ---> "Acesse o link
                                            com link                para criar conta"
                                               |
                                               v
                                         Página /acompanhar/:token
                                         mostra formulário
                                         "Criar sua Conta"
```

## Mensagem que o Cliente Receberá

```
🎉 Proposta Aprovada!

Parabéns Marcus! Seu cadastro foi aprovado e a cobertura de Roubo e Furto já está ativa!

Acesse o link abaixo para criar sua conta no app PRATIC:
🔗 https://pratic-connect-21.lovable.app/acompanhar/abc123...

Após a instalação do rastreador, sua proteção será completa. Bem-vindo à PRATIC!
```

## Considerações Técnicas

1. **Idempotência**: Se a proposta já foi aprovada (`jaAprovado: true`), a notificação **não** será enviada novamente
2. **Fallback**: Se a notificação falhar, a aprovação continua normalmente (não bloqueia o processo)
3. **Link Token**: Usa o `link_token` do contrato para gerar o link de acompanhamento correto

## Tempo Estimado

~10 minutos

