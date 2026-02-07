
# Plano: Permitir Reagendamento Após "Associado Ausente"

## Problema Atual

Quando o vistoriador marca "Associado Ausente":
- O hook `useMarcarNaoCompareceu` define `status: 'cancelada'`
- O serviço desaparece da lista de manutenções pendentes
- O coordenador/diretor não consegue reagendar porque o serviço está "cancelado"

## Solução

Criar um novo status intermediário `nao_compareceu` que:
1. Indica claramente que o associado não estava presente
2. Permite ao coordenador/diretor visualizar e reagendar
3. Mantém a opção de cancelar definitivamente se necessário

---

## Alterações Necessárias

### 1. Adicionar Novo Status `nao_compareceu`

**Arquivo:** `src/hooks/useServicos.ts`

Adicionar o novo status no tipo e nos labels:

```typescript
export type StatusServico = 
  | 'pendente' 
  | 'agendada' 
  | 'em_rota' 
  | 'em_andamento'
  | 'concluida' 
  | 'aprovada' 
  | 'reprovada'
  | 'aprovada_ressalvas'
  | 'em_analise'
  | 'reagendada' 
  | 'nao_compareceu'  // NOVO
  | 'cancelada';

export const STATUS_SERVICO_LABELS: Record<StatusServico, string> = {
  // ... existentes
  nao_compareceu: 'Não Compareceu',
};

export const STATUS_SERVICO_COLORS: Record<StatusServico, string> = {
  // ... existentes
  nao_compareceu: 'bg-orange-100 text-orange-800',
};
```

### 2. Atualizar Hook `useMarcarNaoCompareceu`

**Arquivo:** `src/hooks/useVistoriaManutencao.ts`

Alterar para usar o novo status ao invés de `cancelada`:

```typescript
export function useMarcarNaoCompareceu() {
  return useMutation({
    mutationFn: async (params: MarcarNaoCompareceuParams) => {
      const { error } = await supabase
        .from('servicos')
        .update({
          status: 'nao_compareceu',  // Era 'cancelada'
          observacoes_analise: params.observacao || 'Associado não compareceu',
          updated_at: new Date().toISOString(),
          // NÃO suspender proteção ainda - coordenador decide
        })
        .eq('id', params.servicoId);
      // ...
    }
  });
}
```

### 3. Atualizar Tabela de Manutenções para Mostrar "Não Compareceu"

**Arquivo:** `src/components/monitoramento/manutencao/ManutencaoTabela.tsx`

Adicionar botão de reagendar para itens com `status === 'nao_compareceu'`:

```typescript
{/* Status nao_compareceu - Permitir reagendar ou cancelar */}
{vistoria.status === 'nao_compareceu' && canManage && (
  <>
    <DropdownMenuItem onClick={() => onAgendar?.(vistoria)}>
      <RefreshCw className="h-4 w-4 mr-2" />
      Reagendar
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem 
      onClick={() => onCancelar?.(vistoria)}
      className="text-destructive"
    >
      <XCircle className="h-4 w-4 mr-2" />
      Cancelar e Suspender Proteção
    </DropdownMenuItem>
  </>
)}
```

### 4. Atualizar Consulta de Manutenções

**Arquivo:** `src/hooks/useVistoriaManutencao.ts`

Incluir `nao_compareceu` nos filtros padrão para que apareçam na lista:

```typescript
// Na query useVistoriasManutencao
.in('status', ['pendente', 'agendada', 'em_rota', 'em_andamento', 'nao_compareceu', ...])
```

### 5. Atualizar Métricas

**Arquivo:** `src/hooks/useVistoriaManutencao.ts`

Contar `nao_compareceu` na métrica existente:

```typescript
naoCompareceu: data?.filter(v => v.status === 'nao_compareceu').length || 0,
```

### 6. Atualizar Modal de Agendar para Aceitar Reagendamento

**Arquivo:** `src/components/monitoramento/manutencao/AgendarManutencaoModal.tsx`

Permitir agendar também para status `nao_compareceu`:

```typescript
// O modal já está preparado - apenas garantir que aceita o status
```

---

## Fluxo Atualizado

```
┌──────────────────────────────────────────────────────────────┐
│                      VISTORIADOR (Campo)                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Concluir Manutenção]     [Associado Ausente]               │
│         │                          │                         │
│         ▼                          ▼                         │
│   Modal de Resultado      status = 'nao_compareceu'          │
│   (Resolvido/Subst/etc)                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────┐
│               COORDENADOR/DIRETOR (Painel Admin)             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Tabela de Manutenções:                                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Protocolo │ Cliente │ Status           │ Ações      │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ MAN-001   │ João    │ [Não Compareceu] │ [⋮]        │    │
│  │           │         │                  │ ↳ Reagendar│    │
│  │           │         │                  │ ↳ Cancelar │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Ao clicar "Reagendar":                                      │
│    → Abre AgendarManutencaoModal                             │
│    → Seleciona nova data/período/técnico                     │
│    → status volta para 'agendada'                            │
│                                                              │
│  Ao clicar "Cancelar e Suspender":                           │
│    → status = 'cancelada'                                    │
│    → protecao_suspensa = true                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Destaque Visual

O status "Não Compareceu" terá destaque especial na tabela:
- Badge laranja chamativo
- Ícone de alerta
- Linha destacada (similar ao atual para proteção suspensa)

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useServicos.ts` | Adicionar tipo e labels para `nao_compareceu` |
| `src/hooks/useVistoriaManutencao.ts` | Atualizar `useMarcarNaoCompareceu` e queries |
| `src/components/monitoramento/manutencao/ManutencaoTabela.tsx` | Adicionar botão Reagendar para status `nao_compareceu` |
| `src/types/vistoriaManutencao.ts` | Atualizar métricas se necessário |

---

## Resultado Esperado

1. Vistoriador marca "Associado Ausente" → serviço vai para `nao_compareceu`
2. Coordenador/Diretor vê na lista com badge laranja
3. Pode clicar em "Reagendar" → abre modal para nova data
4. Ou clicar em "Cancelar e Suspender" → finaliza com proteção suspensa
