
# Plano: Novo Status "Reagendar Manutenção" para Rastreadores

## Entendimento do Problema

Quando o técnico marca "Associado Ausente" e o coordenador escolhe **reagendar** (ao invés de cancelar), o rastreador precisa de um status específico que indique claramente que está aguardando uma nova data de manutenção.

### Fluxo Atual (incorreto)
```text
Técnico marca "Ausente" → Rastreador: manutencao
Coordenador reagenda   → Rastreador: manutencao (ambíguo!)
```

### Fluxo Desejado
```text
Técnico marca "Ausente" → Rastreador: manutencao
Coordenador reagenda   → Rastreador: reagendar_manutencao (claro!)
```

---

## Solução

### 1. Criar novo status no enum

Adicionar o valor `reagendar_manutencao` ao enum `status_rastreador` no banco de dados.

### 2. Atualizar tipos TypeScript

Modificar `src/types/rastreadores.ts`:
- Adicionar `reagendar_manutencao` ao tipo `StatusRastreador`
- Adicionar label: "Reagendar Manutenção"
- Adicionar cor: laranja/amarelo (bg-amber-100 text-amber-800)
- Atualizar transições permitidas

### 3. Modificar hook useReagendarPosAusencia

No arquivo `src/hooks/useVistoriaManutencao.ts`, após mudar o serviço para `pendente`, também atualizar o rastreador para `reagendar_manutencao`.

### 4. Modificar hook de agendamento

Quando o coordenador agendar uma nova data, o rastreador volta para `manutencao` (indicando que está em atendimento ativo).

---

## Detalhes Técnicos

### Migração SQL

```sql
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'reagendar_manutencao' AFTER 'manutencao';
```

### Alterações em src/types/rastreadores.ts

```typescript
export type StatusRastreador = 
  | 'estoque'
  | 'reservado'
  | 'instalado'
  | 'manutencao'
  | 'reagendar_manutencao'  // NOVO
  | 'retorno_base'
  | 'triagem'
  | 'em_analise_plataforma'
  | 'em_garantia'
  | 'baixado';

export const STATUS_RASTREADOR_LABELS: Record<StatusRastreador, string> = {
  // ... existentes ...
  reagendar_manutencao: 'Reagendar Manutenção',
};

export const STATUS_RASTREADOR_COLORS: Record<StatusRastreador, string> = {
  // ... existentes ...
  reagendar_manutencao: 'bg-amber-100 text-amber-800',
};

export const TRANSICOES_STATUS_RASTREADOR: Record<StatusRastreador, StatusRastreador[]> = {
  // ... ajustar ...
  manutencao: ['instalado', 'reagendar_manutencao', 'retorno_base', 'baixado'],
  reagendar_manutencao: ['manutencao', 'instalado'],  // NOVO
};
```

### Alterações em src/hooks/useVistoriaManutencao.ts

**Hook useReagendarPosAusencia** (adicionar update do rastreador):
```typescript
export function useReagendarPosAusencia() {
  return useMutation({
    mutationFn: async (servicoId: string) => {
      // Buscar rastreador_id
      const { data: servico } = await supabase
        .from('servicos')
        .select('rastreador_id')
        .eq('id', servicoId)
        .single();

      // Atualizar serviço
      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'pendente',
          data_agendada: null,
          periodo: null,
          profissional_id: null,
        })
        .eq('id', servicoId);
      
      if (error) throw new Error('Erro ao reagendar');

      // Atualizar rastreador para novo status
      if (servico?.rastreador_id) {
        await supabase
          .from('rastreadores')
          .update({ 
            status: 'reagendar_manutencao',
            updated_at: new Date().toISOString()
          })
          .eq('id', servico.rastreador_id);
      }

      return { servicoId };
    },
  });
}
```

**Hook useAgendarVistoriaManutencao** (voltar para manutencao ao agendar):
```typescript
// Ao agendar, verificar se rastreador está em 'reagendar_manutencao'
// e voltar para 'manutencao'
if (servico?.rastreador_id) {
  await supabase
    .from('rastreadores')
    .update({ 
      status: 'manutencao',
      updated_at: new Date().toISOString()
    })
    .eq('id', servico.rastreador_id)
    .eq('status', 'reagendar_manutencao');
}
```

### Correção do rastreador atual

Corrigir o rastreador que foi alterado incorretamente (se o serviço foi cancelado, está certo como `instalado`; mas se for reagendado futuramente, precisará do novo status).

---

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar `reagendar_manutencao` ao enum |
| `src/types/rastreadores.ts` | Adicionar tipo, label, cor e transições |
| `src/hooks/useVistoriaManutencao.ts` | Modificar useReagendarPosAusencia e useAgendarVistoriaManutencao |
| `src/integrations/supabase/types.ts` | Atualizar tipo gerado |

---

## Fluxo Final Completo

```text
┌─────────────────────────────┐
│ Manutenção aberta           │
│ Rastreador: manutencao      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Técnico marca "Ausente"     │
│ Serviço: nao_compareceu     │
│ Rastreador: manutencao      │
└─────────────┬───────────────┘
              │
      ┌───────┴───────┐
      │               │
      ▼               ▼
┌─────────────┐ ┌─────────────────────┐
│ REAGENDAR   │ │ CANCELAR + SUSPENDER│
└─────┬───────┘ └──────────┬──────────┘
      │                    │
      ▼                    ▼
┌─────────────────────┐ ┌────────────────────┐
│ Serviço: pendente   │ │ Serviço: cancelada │
│ Rastreador:         │ │ Rastreador:        │
│ reagendar_manutencao│ │ instalado          │
└─────────┬───────────┘ └────────────────────┘
          │
          ▼
┌─────────────────────┐
│ Coordenador agenda  │
│ nova data           │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Serviço: agendada   │
│ Rastreador:         │
│ manutencao          │
└─────────────────────┘
```
