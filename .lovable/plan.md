

# Plano: Corrigir Reset Completo ao Reverter Recusa

## Problema Identificado

Ao reverter uma recusa da blacklist, o contrato e a cotação **não estão sendo resetados** porque:

1. **Bug na inserção**: O hook `useRecusarVeiculoServico` (linhas 1137-1151) **não passa** `contrato_id` e `cotacao_id` ao inserir na blacklist, mesmo tendo esses valores disponíveis
2. **Bug na reversão**: O hook `useRemoverBlacklist` depende exclusivamente dos campos `contrato_id` e `cotacao_id` da blacklist, que estão null

### Estado Atual do Marcus Vinicius (LTB4J74)

| Entidade | Status Atual | Status Esperado |
|----------|-------------|-----------------|
| Associado | `pendente_vistoria` | OK |
| Veículo | `em_analise` | OK |
| Contrato | `cancelado` | `rascunho` |
| Cotação | `recusada` + `veiculo_recusado` | `aceita` + `aguardando_vistoria` |

---

## Solução Proposta

### 1. Corrigir inserção na blacklist

**Arquivo:** `src/hooks/useServicos.ts`

Na função `useRecusarVeiculoServico`, adicionar `contrato_id` e `cotacao_id` ao inserir na blacklist:

```typescript
// Linha 1137-1151 - Adicionar contrato_id e cotacao_id
await supabase
  .from('blacklist_veiculos')
  .insert({
    placa: veiculoData.placa?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '',
    chassi: veiculoData.chassi,
    motivo: data.motivo,
    justificativa: `Veículo recusado pelo técnico: ${data.motivo}`,
    tipo_reprovacao: 'vistoria_reprovada',
    veiculo_id: data.veiculoId,
    associado_id: data.associadoId,
    contrato_id: contratoId,   // ADICIONAR
    cotacao_id: cotacaoId,     // ADICIONAR
    adicionado_por: profile?.id,
    vistoria_id: vistoriaId,
    ativo: true,
  });
```

### 2. Corrigir reversão para buscar dados faltantes

**Arquivo:** `src/hooks/useBlacklist.ts`

Modificar `useRemoverBlacklist` para buscar `contrato_id` e `cotacao_id` diretamente do associado quando não existirem na blacklist:

```typescript
// Se solicitado reverter status do veículo (reset completo do processo)
if (reverterVeiculo && blacklistItem?.veiculo_id) {
  // NOVO: Buscar contrato e cotação pelo associado se não existirem na blacklist
  let contratoId = blacklistItem.contrato_id;
  let cotacaoId = blacklistItem.cotacao_id;

  if (blacklistItem.associado_id && (!contratoId || !cotacaoId)) {
    const { data: contratosData } = await supabase
      .from('contratos')
      .select('id, cotacao_id')
      .eq('associado_id', blacklistItem.associado_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (contratosData) {
      contratoId = contratoId || contratosData.id;
      cotacaoId = cotacaoId || contratosData.cotacao_id;
    }
  }

  // 1. Reverter veículo para 'em_analise'
  // ... código existente ...

  // 3. Resetar contrato para rascunho (usar contratoId da busca)
  if (contratoId) {
    // ... código existente usando contratoId ...
  }

  // 4. Resetar cotação para aceita (usar cotacaoId da busca)
  if (cotacaoId) {
    // ... código existente usando cotacaoId ...
  }

  // 5. Limpar referência de vistoria_id na blacklist ANTES de excluir vistorias
  await supabase
    .from('blacklist_veiculos')
    .update({ vistoria_id: null })
    .eq('veiculo_id', blacklistItem.veiculo_id);

  // 6. Excluir vistorias antigas do veículo
  // ... código existente ...
}
```

### 3. Invalidar queries adicionais

**Arquivo:** `src/hooks/useBlacklist.ts`

Adicionar invalidação de queries para contratos e cotações:

```typescript
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({ queryKey: ['blacklist-veiculos'] });
  queryClient.invalidateQueries({ queryKey: ['blacklist-check'] });
  queryClient.invalidateQueries({ queryKey: ['veiculos'] });
  queryClient.invalidateQueries({ queryKey: ['associados'] });
  queryClient.invalidateQueries({ queryKey: ['contratos'] });    // ADICIONAR
  queryClient.invalidateQueries({ queryKey: ['cotacoes'] });     // ADICIONAR
  queryClient.invalidateQueries({ queryKey: ['propostas'] });    // ADICIONAR
  
  // ... resto do código ...
}
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useServicos.ts` | Adicionar `contrato_id` e `cotacao_id` ao inserir na blacklist |
| `src/hooks/useBlacklist.ts` | Buscar contrato/cotação pelo associado quando não existir na blacklist |
| `src/hooks/useBlacklist.ts` | Limpar `vistoria_id` antes de excluir vistorias |
| `src/hooks/useBlacklist.ts` | Invalidar queries de contratos e cotações |

---

## Fluxo Corrigido de Reversão

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Diretor clica em "Remover e Reverter"                   │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Blacklist tem contrato_id/cotacao_id null?              │
│     Sim → Buscar pela tabela contratos usando associado_id  │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Blacklist → ativo = false, vistoria_id = null           │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Veículo → status = 'em_analise'                         │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Associado → status = 'pendente_vistoria'                │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Contrato → status = 'rascunho' (encontrado pela busca)  │
│     Assinatura e pagamento resetados                        │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Cotação → status = 'aceita'                             │
│              status_contratacao = 'aguardando_vistoria'     │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  8. Vistorias antigas excluídas                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após a correção, ao reverter a recusa do associado "Marcus Vinicius":

| Entidade | Antes | Depois |
|----------|-------|--------|
| Blacklist | Inativo | Inativo (mantém histórico) |
| Veículo | Em Análise | Em Análise |
| Associado | Pendente Vistoria | Pendente Vistoria |
| **Contrato** | **Cancelado** | **Rascunho** |
| **Cotação** | **Recusada + veiculo_recusado** | **Aceita + aguardando_vistoria** |

---

## Correção Imediata para Marcus Vinicius

Após implementar as correções, será necessário **reverter novamente** o status do Marcus Vinicius, pois os registros atuais estão inconsistentes.

Alternativamente, posso incluir um SQL de correção para aplicar manualmente no banco.

