
# Plano: Corrigir Notificações WhatsApp no Fluxo de Atribuição

## Problema Identificado

O fluxo de atribuição tem **duas falhas críticas** de notificação:

### 1. Vistoriador NÃO recebe dados do cliente
Quando uma tarefa é atribuída, o vistoriador deveria receber via WhatsApp:
- Nome e telefone do cliente
- Endereço completo
- Dados do veículo
- Link direto para WhatsApp do cliente

**Status atual**: A mensagem não foi enviada.

### 2. Cliente NÃO recebe aviso de técnico a caminho
Quando o técnico inicia a rota, o cliente deveria ser notificado:
- Nome do técnico
- Tipo de serviço
- Horário previsto

**Status atual**: A mensagem não foi enviada.

## Análise da Causa Raiz

### Cenário 1: Atribuição via Edge Function (Fluxo Automático)
O código na Edge Function `atribuir-proxima-tarefa` (linhas 818-931) **TEM a lógica** para enviar as notificações:

```text
Linha 844-855: Notificar cliente via notificar-cliente (tipo: tecnico_em_rota)
Linha 864-931: Notificar vistoriador via whatsapp-send-text
```

**Porém, os logs mostram que NENHUM serviço foi encontrado**:
```
[atribuir-proxima-tarefa] DEBUG: NENHUM serviço encontrado no sistema com status pendente/agendada
```

### Cenário 2: Atribuição Manual + Iniciar Rota (Hook Frontend)
Quando a tarefa foi criada, o `profissional_id` já veio preenchido no banco (atribuição manual via trigger ou fluxo de agendamento).

O vistoriador usou o hook `useIniciarRota` para iniciar a rota, que **apenas atualiza o status** sem chamar a Edge Function de notificação:

```typescript
// src/hooks/useTarefaAtual.ts - linha 178-186
const { error } = await supabase
  .from('servicos')
  .update({ 
    status: 'em_rota',
    em_rota_em: new Date().toISOString(),
  })
  .eq('id', tarefaId);
// ❌ NÃO envia notificações!
```

## Diagnóstico Final

| Cenário | Status Atual |
|---------|--------------|
| Atribuição automática via polling | Funcionaria, mas não encontrou serviços |
| Atribuição manual + iniciar rota | **NÃO ENVIA NOTIFICAÇÕES** |

A instalação testada foi atribuída **manualmente** (profissional_id já existia no momento da criação do serviço às 17:50:49). Quando o vistoriador clicou em "Iniciar Rota" às 18:00:01, o hook atualizou o status, mas **nunca chamou a Edge Function que dispara as notificações**.

## Solução Proposta

### Modificação 1: Hook `useIniciarRota` - Adicionar Envio de Notificações

**Arquivo:** `src/hooks/useTarefaAtual.ts`

Ao iniciar a rota, chamar a Edge Function `notificar-inicio-rota` (nova) para enviar as notificações:

```typescript
export function useIniciarRota() {
  // ... código existente
  
  mutationFn: async ({ tarefaId }: { tarefaId: string }) => {
    // ... validações existentes
    
    // Atualizar status
    const { error } = await supabase
      .from('servicos')
      .update({ 
        status: 'em_rota',
        em_rota_em: new Date().toISOString(),
      })
      .eq('id', tarefaId);
    
    if (error) throw error;
    
    // NOVO: Disparar notificações (em background, não bloqueia)
    supabase.functions.invoke('notificar-inicio-rota', {
      body: { servico_id: tarefaId }
    }).catch(err => console.warn('Erro ao notificar:', err));
  },
  // ...
}
```

### Modificação 2: Nova Edge Function `notificar-inicio-rota`

**Arquivo:** `supabase/functions/notificar-inicio-rota/index.ts`

Esta Edge Function será responsável por:

1. **Buscar dados do serviço** (cliente, veículo, endereço, profissional)
2. **Notificar o CLIENTE** via `notificar-cliente` (template: tecnico_em_rota)
3. **Notificar o VISTORIADOR** via `whatsapp-send-text` com dados do cliente

```typescript
// Estrutura básica
serve(async (req) => {
  const { servico_id } = await req.json();
  
  // 1. Buscar dados completos do serviço
  const { data: servico } = await supabase
    .from('servicos')
    .select(`
      *,
      associado:associados(nome, telefone, whatsapp),
      veiculo:veiculos(placa, marca, modelo),
      profissional:profiles!profissional_id(nome, whatsapp, telefone)
    `)
    .eq('id', servico_id)
    .single();
  
  // 2. Notificar cliente
  await supabase.functions.invoke('notificar-cliente', {
    body: {
      tipo: 'tecnico_em_rota',
      associado_id: servico.associado_id,
      dados: { ... }
    }
  });
  
  // 3. Notificar vistoriador
  await supabase.functions.invoke('whatsapp-send-text', {
    body: {
      telefone: profissionalTelefone,
      mensagem: `📋 *NOVA TAREFA*\n\n👤 Cliente: ${servico.associado.nome}\n...`
    }
  });
});
```

### Modificação 3: Atualizar `supabase/config.toml`

Adicionar a nova função ao arquivo de configuração.

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/notificar-inicio-rota/index.ts` | **CRIAR** - Nova Edge Function |
| `supabase/config.toml` | **MODIFICAR** - Adicionar config da nova função |
| `src/hooks/useTarefaAtual.ts` | **MODIFICAR** - Chamar Edge Function ao iniciar rota |

## Fluxo Atualizado

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FLUXO DE ATRIBUIÇÃO E NOTIFICAÇÃO                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Serviço Criado (via agendamento)                                        │
│     │                                                                       │
│     ▼                                                                       │
│  2A. Atribuição AUTOMÁTICA              2B. Atribuição MANUAL               │
│      │ (via polling)                        │ (já tem profissional_id)      │
│      ▼                                      ▼                               │
│  atribuir-proxima-tarefa           Vistoriador clica "Iniciar Rota"         │
│      │                                      │                               │
│      │                                      ▼                               │
│      │                              useIniciarRota (hook)                   │
│      │                                      │                               │
│      │                                      ▼                               │
│      │                              notificar-inicio-rota (NOVO)            │
│      │                                      │                               │
│      ▼ ─────────────────────────────────────┘                               │
│                                                                             │
│  3. NOTIFICAÇÕES ENVIADAS:                                                  │
│     ✅ Vistoriador recebe dados do cliente via WhatsApp                     │
│     ✅ Cliente recebe aviso de técnico a caminho via WhatsApp               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Comportamento Esperado Após Correção

| Ação | Antes | Depois |
|------|-------|--------|
| Atribuição automática | Notificações OK (já implementado) | Mantém |
| Atribuição manual + Iniciar Rota | **SEM notificações** | **COM notificações** |

## Testes Recomendados

1. Criar um agendamento de vistoria/instalação com vistoriador pré-atribuído
2. Acessar como vistoriador e clicar em "Iniciar Rota"
3. Verificar se:
   - Vistoriador recebeu WhatsApp com dados do cliente
   - Cliente recebeu WhatsApp avisando que técnico está a caminho
4. Verificar logs da Edge Function `notificar-inicio-rota`
