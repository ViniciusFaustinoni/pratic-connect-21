

# Fix: Enviar template Meta `tarefa_vistoriador_v2` ao vistoriador na atribuição

## Problema
Quando o cron atribui uma vistoria ao vistoriador (linhas 609-646 do `cron-atribuir-tarefas`), apenas um **push notification** é enviado. Nenhuma mensagem WhatsApp é disparada. O template Meta `tarefa_vistoriador_v2` existe e está **APPROVED**, mas nunca é invocado em nenhum lugar do código.

Adicionalmente, a notificação WhatsApp para instaladores (linhas 593-601) usa `enviar-whatsapp`, uma Edge Function que **não existe** — logo, essa notificação também falha silenciosamente.

## Template disponível
**`tarefa_vistoriador_v2`** (APPROVED):
- `{{1}}` = nome do vistoriador
- `{{2}}` = nome do associado  
- `{{3}}` = localização
- `{{4}}` = data

## Solução
No arquivo `supabase/functions/cron-atribuir-tarefas/index.ts`:

### 1. Vistorias: adicionar envio do template Meta após o push (após linha 646)
- Buscar telefone do vistoriador via `profiles`
- Invocar `whatsapp-send-text` com `template_name: 'tarefa_vistoriador_v2'` e os 4 parâmetros

### 2. Instalações: corrigir chamada `enviar-whatsapp` → `whatsapp-send-text` (linha 593)
- Trocar `enviar-whatsapp` por `whatsapp-send-text`
- Manter envio como texto livre (sem template), já que não há template específico para instalador

### Código da mudança (vistorias)
```typescript
// Após o push notification do vistoriador (linha 646), adicionar:
try {
  const { data: vistProfile } = await supabase
    .from('profiles')
    .select('telefone, nome')
    .eq('id', prof.vistoriador_id)
    .single();

  if (vistProfile?.telefone) {
    const dataFormatada = new Date(servico.data_agendada + 'T12:00:00').toLocaleDateString('pt-BR');
    const endereco = [servico.logradouro, servico.numero, servico.bairro, servico.cidade].filter(Boolean).join(', ') || servico.local_vistoria || 'A definir';

    await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: vistProfile.telefone,
        template_name: 'tarefa_vistoriador_v2',
        template_params: [
          vistProfile.nome?.split(' ')[0] || 'Vistoriador',
          servico.associado_nome,
          endereco,
          dataFormatada,
        ],
        referencia_tipo: 'vistoria',
        referencia_id: servico.vistoria_origem_id,
      }
    });
    console.log(`[cron-atribuir-tarefas] ✓ WhatsApp template enviado ao vistoriador ${vistProfile.nome}`);
  }
} catch (whatsErr) {
  console.error('[cron-atribuir-tarefas] Erro ao enviar WhatsApp ao vistoriador:', whatsErr);
}
```

### Arquivo
- `supabase/functions/cron-atribuir-tarefas/index.ts` — adicionar envio WhatsApp para vistorias + corrigir chamada para instalações
- Redeploy da edge function

