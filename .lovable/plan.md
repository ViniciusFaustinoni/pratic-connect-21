
# Correção do Fluxo de Manutenção - Rastreador Inconsistente

## Diagnóstico do Problema

### O que aconteceu (linha do tempo real)

```text
1. Instalação concluída (rastreador: instalado)
2. Manutenção aberta (rastreador: manutencao, serviço: agendada)
3. Técnico foi ao local
4. Técnico clicou "Associado Ausente" (serviço: nao_compareceu)
   → Rastreador CONTINUA em 'manutencao' (CORRETO!)
   → Serviço vai para coordenador decidir

5. Coordenador cancelou COM suspensão de proteção (serviço: cancelada)
   → PROBLEMA: Rastreador NÃO voltou para 'instalado'
```

### Estado atual no banco

| Entidade | Status Atual | Status Esperado |
|----------|--------------|-----------------|
| Serviço `94c2fd9d...` | `cancelada` + `protecao_suspensa = true` | Correto |
| Rastreador `3f41f3c1...` | `manutencao` | Deveria ser `instalado` |

### Causa raiz

O hook `useCancelarVistoriaManutencao` (linhas 891-897) faz o update do rastreador **sem capturar o erro**:

```typescript
// Código atual - erro ignorado silenciosamente
await supabase
  .from('rastreadores')
  .update({ status: 'instalado' })
  .eq('id', servico.rastreador_id);
// Se falhar aqui, ninguém sabe!
```

O update do rastreador falhou (possivelmente por RLS, timeout ou constraint), mas o código continuou sem alertar.

---

## Solução

### Parte 1: Correção Imediata (SQL)

Corrigir o rastreador que está em estado inconsistente:

```sql
UPDATE rastreadores
SET 
  status = 'instalado',
  updated_at = NOW()
WHERE id = '3f41f3c1-cbe5-47fc-b305-d1291abc407d';

INSERT INTO estoque_movimentacoes (
  tipo, quantidade, status_anterior, status_novo, 
  rastreador_id, observacoes
) VALUES (
  'alteracao_status', 1, 'manutencao', 'instalado',
  '3f41f3c1-cbe5-47fc-b305-d1291abc407d',
  'Correção manual: rastreador não foi atualizado quando manutenção foi cancelada'
);
```

### Parte 2: Prevenção Futura (Código)

Modificar o hook `useCancelarVistoriaManutencao` em `src/hooks/useVistoriaManutencao.ts` para capturar e alertar sobre erros no update do rastreador.

#### Alteração proposta (linhas 889-908)

```typescript
// Se tinha rastreador, voltar para 'instalado' (cancelamento não é baixa)
if (servico?.rastreador_id) {
  const { error: rastreadorError } = await supabase
    .from('rastreadores')
    .update({ 
      status: 'instalado',
      updated_at: new Date().toISOString()
    })
    .eq('id', servico.rastreador_id);

  if (rastreadorError) {
    console.error('[useCancelarVistoriaManutencao] ERRO ao atualizar rastreador:', rastreadorError);
    // Não lançar erro para não reverter o cancelamento, mas avisar o usuário
    toast.warning('Atenção: rastreador pode precisar de ajuste manual', {
      description: 'Verifique o status do rastreador na listagem.'
    });
  } else {
    // Registrar movimentação apenas se update foi bem sucedido
    await supabase.from('estoque_movimentacoes').insert({
      tipo: 'alteracao_status',
      quantidade: 1,
      status_anterior: 'manutencao',
      status_novo: 'instalado',
      rastreador_id: servico.rastreador_id,
      observacoes: motivo || 'Manutenção cancelada - rastreador retornou ao status instalado',
    });
  }
}
```

---

## Resumo das Alterações

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Banco de dados | SQL | Corrigir status do rastreador para `instalado` |
| `src/hooks/useVistoriaManutencao.ts` | Modificar | Adicionar tratamento de erro no cancelamento (linhas 889-908) |

---

## Detalhes Técnicos

### O fluxo correto de "Associado Ausente"

```text
                      ┌─────────────────────────────┐
                      │  Técnico marca              │
                      │  "Associado Ausente"        │
                      └─────────────┬───────────────┘
                                    │
                                    ▼
                      ┌─────────────────────────────┐
                      │  Serviço: nao_compareceu    │
                      │  Rastreador: manutencao     │
                      │  (MANTÉM em manutenção!)    │
                      └─────────────┬───────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
              ▼                                           ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│  Coordenador clica      │               │  Coordenador clica      │
│  "Reagendar"            │               │  "Cancelar + Suspender" │
└───────────┬─────────────┘               └───────────┬─────────────┘
            │                                         │
            ▼                                         ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│  Serviço: pendente      │               │  Serviço: cancelada     │
│  Rastreador: manutencao │               │  protecao_suspensa: true│
│  (continua manutenção)  │               │  Rastreador: instalado  │
│                         │               │  (volta para instalado) │
│  → Coordenador agenda   │               └─────────────────────────┘
│    nova data com opção  │
│    de encaixe           │
└─────────────────────────┘
```

### Por que rastreador FICA em `manutencao` no reagendamento

Quando o coordenador escolhe **reagendar**, o rastreador continua em `manutencao` porque:
- O problema ainda não foi resolvido
- Vai haver uma nova tentativa de atendimento
- Só volta para `instalado` quando a manutenção for **concluída** ou **cancelada**
