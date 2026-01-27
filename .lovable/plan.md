

# Plano: Integrar Vistoria na Base ao Fluxo de Análise Cadastral

## Diagnóstico do Problema

O fluxo de vistorias na base está **desconectado** da análise cadastral. Quando o coordenador marca o agendamento como "realizado", nada acontece com a cotação ou contrato vinculado.

### Fluxo Atual (Quebrado)

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente agenda  │────►│ Coordenador     │────►│ agendamentos_   │
│ vistoria base   │     │ marca realizado │     │ base = realizado│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ✘ FIM (sem propagação)
                                                        
┌─────────────────┐
│ Analista de     │ ← Nunca recebe a proposta
│ Cadastro        │
└─────────────────┘
```

### Fluxo Desejado

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente agenda  │────►│ Coordenador     │────►│ agendamentos_   │
│ vistoria base   │     │ marca realizado │     │ base = realizado│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │ cotacao.status_ │
                                                │ contratacao =   │
                                                │ 'vistoria_ok'   │
                                                └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Analista de     │
                                                │ Cadastro vê a   │
                                                │ proposta ✅     │
                                                └─────────────────┘
```

## Implementação

### 1. Atualizar a Mutação `useAtualizarAgendamentoBase`

Quando o status for alterado para `realizado`, buscar a cotação vinculada e atualizar seu `status_contratacao`:

**Arquivo:** `src/hooks/useAgendamentoBase.ts`

```typescript
export function useAtualizarAgendamentoBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dados: {
      id: string;
      status: string;
      observacoes?: string;
      atendidoPor?: string;
    }) => {
      // 1. Buscar dados do agendamento para obter cotacao_id
      const { data: agendamento, error: fetchError } = await supabase
        .from('agendamentos_base')
        .select('cotacao_id')
        .eq('id', dados.id)
        .single();

      if (fetchError) throw fetchError;

      // 2. Atualizar status do agendamento
      const { error } = await supabase
        .from('agendamentos_base')
        .update({
          status: dados.status,
          observacoes: dados.observacoes,
          atendido_por: dados.atendidoPor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dados.id);

      if (error) throw error;

      // 3. Se marcou como realizado e tem cotacao_id, atualizar cotação
      if (dados.status === 'realizado' && agendamento?.cotacao_id) {
        await supabase
          .from('cotacoes')
          .update({
            status_contratacao: 'vistoria_ok',
            updated_at: new Date().toISOString(),
          })
          .eq('id', agendamento.cotacao_id);

        // 4. Atualizar status do associado/contrato para 'em_analise'
        const { data: cotacao } = await supabase
          .from('cotacoes')
          .select('contrato:contratos!contratos_cotacao_id_fkey(id, associado_id)')
          .eq('id', agendamento.cotacao_id)
          .single();

        if (cotacao?.contrato) {
          // Atualizar associado
          if (cotacao.contrato.associado_id) {
            await supabase
              .from('associados')
              .update({ status: 'em_analise' })
              .eq('id', cotacao.contrato.associado_id);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Agendamento atualizado!');
      queryClient.invalidateQueries({ queryKey: ['agendamentos-base-dia'] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['propostas-stats'] });
    },
    ...
  });
}
```

### 2. Atualizar Filtro de Propostas Pendentes

Incluir propostas com vistoria na base concluída no filtro:

**Arquivo:** `src/hooks/usePropostasPendentes.ts` (linha ~438-444)

```typescript
// REGRA ATUALIZADA: Incluir propostas que tenham:
// - Instalação concluída (fluxo normal)
// - OU Autovistoria concluída com fotos (aguardando aprovação roubo/furto)
// - OU Vistoria na Base concluída (novo)
const temAutovistoria = vistoria && vistoria.fotos && vistoria.fotos.length > 0;

// NOVO: Verificar se tem vistoria na base concluída
let temVistoriaBaseRealizada = false;
if (contrato.cotacao_id) {
  const { data: agendamentoBase } = await supabase
    .from('agendamentos_base')
    .select('id, status')
    .eq('cotacao_id', contrato.cotacao_id)
    .eq('status', 'realizado')
    .limit(1)
    .maybeSingle();
  
  temVistoriaBaseRealizada = !!agendamentoBase;
}

if (!instalacaoInfo && !temAutovistoria && !temVistoriaBaseRealizada) {
  return null;
}
```

### 3. Atualizar KPI de Stats

Incluir vistorias na base na contagem:

**Arquivo:** `src/hooks/usePropostasPendentes.ts` (linha ~1053-1059)

```typescript
// Buscar agendamentos base realizados
const { data: agendamentosRealizados } = await supabase
  .from('agendamentos_base')
  .select('cotacao_id')
  .eq('status', 'realizado');

const cotacoesComVistoriaBase = new Set(
  agendamentosRealizados?.map(a => a.cotacao_id).filter(Boolean) || []
);

// Contar apenas propostas prontas para análise
aguardando = contratosAssinados.filter(contrato => {
  // Tem instalação concluída?
  if (contratosComInstalacao.has(contrato.id)) return true;
  // Tem autovistoria com fotos?
  if (contrato.cotacao_id && cotacoesComFotos.has(contrato.cotacao_id)) return true;
  // NOVO: Tem vistoria na base realizada?
  if (contrato.cotacao_id && cotacoesComVistoriaBase.has(contrato.cotacao_id)) return true;
  return false;
}).length;
```

### 4. Atualizar Tela de Análise - Exibir Info da Vistoria Base

Adicionar seção específica para exibir detalhes da vistoria na base:

**Arquivo:** `src/pages/cadastro/PropostaAnalise.tsx`

Adicionar novo tipo e busca para `agendamentos_base` e exibir card informativo quando a vistoria foi realizada na base.

### 5. Adicionar Campo ao Interface `PropostaPendente`

**Arquivo:** `src/hooks/usePropostasPendentes.ts`

```typescript
export interface PropostaPendente {
  // ... campos existentes
  vistoria_base_info: {
    id: string;
    data_agendada: string;
    horario: string;
    status: string;
    atendido_por_nome: string | null;
  } | null; // NOVO
}
```

## Migração de Dados

Para corrigir registros existentes (cotação de teste que ficou sem `tipo_vistoria`):

```sql
UPDATE cotacoes 
SET tipo_vistoria = 'agendada_base' 
WHERE id IN (
  SELECT DISTINCT cotacao_id 
  FROM agendamentos_base 
  WHERE cotacao_id IS NOT NULL
) AND (tipo_vistoria IS NULL OR tipo_vistoria = '');
```

## Alterações de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAgendamentoBase.ts` | Propagar status para cotação quando `realizado` |
| `src/hooks/usePropostasPendentes.ts` | Incluir propostas com vistoria base no filtro e stats |
| `src/pages/cadastro/PropostaAnalise.tsx` | Exibir informações da vistoria na base |

## Resultado Esperado

1. Coordenador marca agendamento como "Realizado" ✅
2. Sistema atualiza `cotacoes.status_contratacao = 'vistoria_ok'` ✅
3. Proposta aparece na fila do analista de cadastro ✅
4. KPI "Aguardando Análise" incrementa ✅
5. Analista pode aprovar a proposta ✅

