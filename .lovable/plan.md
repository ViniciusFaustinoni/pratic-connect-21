
# Correção Completa: Sincronização de Status e Histórico de Rastreadores

## Problemas Identificados

Após análise profunda do código em `useVistoriaManutencao.ts`, encontrei **4 cenários críticos** onde o status do rastreador **NÃO está sendo atualizado** ou o **histórico não está sendo registrado**:

### 1. ❌ Cenário: "Não Resolvido" + "Reagendar" (Linhas 686-699)
**Problema**: Quando uma manutenção não é resolvida e o técnico escolhe "reagendar":
- Atualiza apenas `servicos.status = 'pendente'`
- **NÃO atualiza `rastreadores.status = 'reagendar_manutencao'`**
- **NÃO registra movimentação em `estoque_movimentacoes`**

**Esperado**: 
```
rastreador.status: manutencao → reagendar_manutencao
estoque_movimentacoes: tipo='reagendamento', status_anterior='manutencao', status_novo='reagendar_manutencao'
```

### 2. ❌ Cenário: "Não Compareceu" (Linhas 784-792)
**Problema**: Quando associado não comparece:
- Atualiza apenas `servicos.status = 'nao_compareceu'`
- **NÃO atualiza status do rastreador**
- **NÃO registra movimentação no histórico**

**Esperado**:
```
rastreador.status: manutencao → reagendar_manutencao (estado suspenso até decisão)
estoque_movimentacoes: tipo='nao_comparecimento', com observações
```

### 3. ✅ Cenário: "Resolvido" (Linhas 499-579)
**Status**: OK - Atualiza rastreador para 'instalado' e registra movimentação

### 4. ✅ Cenário: "Substituição" (Linhas 581-679)
**Status**: OK - Atualiza ambos rastreadores e registra movimentações

### 5. ✅ Cenário: "Não Resolvido" + "Cancelar" (Linhas 701-738)
**Status**: OK - Atualiza rastreador para 'instalado' e registra movimentação

### 6. ✅ Cenário: Manutenção Cancelada Globalmente
**Status**: OK (linhas 938-956) - Registra corretamente

## Solução Proposta

### Arquivo: `src/hooks/useVistoriaManutencao.ts`

#### Correção 1: "Não Resolvido" + "Reagendar" (Linhas 686-699)

**Antes**:
```typescript
if (acao === 'reagendar') {
  // Reagendar: serviço volta para pendente
  const { error: servicoUpdateError } = await supabase
    .from('servicos')
    .update({
      status: 'pendente',
      observacoes_analise: `Não resolvido: ${params.descricao}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.servicoId);

  if (servicoUpdateError) {
    throw new Error('Erro ao reagendar serviço');
  }
}
```

**Depois**:
```typescript
if (acao === 'reagendar') {
  // Reagendar: serviço volta para pendente e rastreador para reagendar_manutencao
  const { error: servicoUpdateError } = await supabase
    .from('servicos')
    .update({
      status: 'pendente',
      observacoes_analise: `Não resolvido: ${params.descricao}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.servicoId);

  if (servicoUpdateError) {
    throw new Error('Erro ao reagendar serviço');
  }

  // Atualizar rastreador para aguardar novo agendamento
  if (rastreadorAntigoId) {
    const { error: rastreadorError } = await supabase
      .from('rastreadores')
      .update({
        status: 'reagendar_manutencao',
        updated_at: new Date().toISOString(),
      })
      .eq('id', rastreadorAntigoId);

    if (rastreadorError) {
      console.error('[useRegistrarResultadoManutencao] Erro ao atualizar rastreador:', rastreadorError);
      throw new Error('Erro ao atualizar status do rastreador');
    }

    // Registrar movimentação
    await supabase.from('estoque_movimentacoes').insert({
      tipo: 'alteracao_status',
      quantidade: 1,
      status_anterior: 'manutencao',
      status_novo: 'reagendar_manutencao',
      rastreador_id: rastreadorAntigoId,
      observacoes: `Manutenção não resolvida - aguardando reagendamento: ${params.descricao}`,
    });
  }
}
```

#### Correção 2: "Não Compareceu" (Linhas 784-792)

**Antes**:
```typescript
export function useMarcarNaoCompareceu() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MarcarNaoCompareceuParams) => {
      const { error } = await supabase
        .from('servicos')
        .update({
          status: 'nao_compareceu' as any,
          observacoes_analise: params.observacao || 'Associado não compareceu',
          updated_at: new Date().toISOString(),
          // NÃO suspender proteção ainda - coordenador/diretor decide
        })
        .eq('id', params.servicoId);

      if (error) {
        console.error('[useMarcarNaoCompareceu] Erro:', error);
        throw new Error('Erro ao marcar não comparecimento');
      }

      return { servicoId: params.servicoId };
    },
```

**Depois**:
```typescript
export function useMarcarNaoCompareceu() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MarcarNaoCompareceuParams) => {
      // 1. Buscar o rastreador_id do serviço
      const { data: servico, error: servicoGetError } = await supabase
        .from('servicos')
        .select('rastreador_id')
        .eq('id', params.servicoId)
        .single();

      if (servicoGetError || !servico) {
        throw new Error('Erro ao buscar dados do serviço');
      }

      // 2. Atualizar status do serviço
      const { error } = await supabase
        .from('servicos')
        .update({
          status: 'nao_compareceu' as any,
          observacoes_analise: params.observacao || 'Associado não compareceu',
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.servicoId);

      if (error) {
        console.error('[useMarcarNaoCompareceu] Erro:', error);
        throw new Error('Erro ao marcar não comparecimento');
      }

      // 3. Atualizar status do rastreador para 'reagendar_manutencao'
      if (servico.rastreador_id) {
        const { error: rastreadorError } = await supabase
          .from('rastreadores')
          .update({
            status: 'reagendar_manutencao',
            updated_at: new Date().toISOString(),
          })
          .eq('id', servico.rastreador_id);

        if (rastreadorError) {
          console.error('[useMarcarNaoCompareceu] Erro ao atualizar rastreador:', rastreadorError);
          throw new Error('Erro ao atualizar status do rastreador');
        }

        // 4. Registrar movimentação no histórico
        await supabase.from('estoque_movimentacoes').insert({
          tipo: 'alteracao_status',
          quantidade: 1,
          status_anterior: 'manutencao',
          status_novo: 'reagendar_manutencao',
          rastreador_id: servico.rastreador_id,
          observacoes: `Não comparecimento: ${params.observacao || 'Associado ausente na data agendada'}`,
        });
      }

      return { servicoId: params.servicoId };
    },
```

## Resumo das Alterações

| Cenário | Linha | Ação |
|---------|-------|------|
| Não Resolvido + Reagendar | 686-699 | ➕ Adicionar atualização de rastreador + movimentação |
| Não Compareceu | 784-792 | ➕ Adicionar busca de rastreador_id + atualização + movimentação |
| Resolvido | 499-579 | ✅ Sem alterações (já funciona) |
| Substituição | 581-679 | ✅ Sem alterações (já funciona) |
| Não Resolvido + Cancelar | 701-738 | ✅ Sem alterações (já funciona) |

## Resultado Esperado

Após as correções, **todos os 6 cenários de conclusão de manutenção** terão:
- ✅ Status do rastreador atualizado corretamente
- ✅ Movimentação registrada em `estoque_movimentacoes`
- ✅ Histórico completo e auditável na aba "Histórico" do rastreador
- ✅ Estados válidos conforme a máquina de estados definida em `rastreadores.ts`
