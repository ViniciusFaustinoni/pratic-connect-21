

# Plano: Excluir Cotações Vinculadas ao Lead ao Excluir Associado

## Problema Identificado

Ao excluir um associado, a cotação permanece visível na lista porque:

1. A cotação está vinculada ao **lead** através de `lead_id`
2. O lead está vinculado ao **associado** através de `associado_id`
3. A função `delete-associado` apenas **desvincula** o lead do associado (linha 207-211), mas **não exclui** as cotações desse lead
4. Apenas cotações com **contrato vinculado** são excluídas (via `contrato.cotacao_id`)

### Fluxo Atual (Bug)

```text
Associado
    ↓
   Lead (associado_id → null após exclusão)
    ↓
  Cotação (lead_id permanece intacto) ← BUG: não é excluída!
```

### Cenário do Marcus Vinicius

| Entidade | Estado |
|----------|--------|
| Associado | **Excluído** |
| Lead | `associado_id = null` (desvinculado) |
| Cotação | **Permanece visível** com `lead_id` apontando para o lead |

---

## Solução Proposta

### Alterar a ordem de exclusão na função `delete-associado`

**Arquivo:** `supabase/functions/delete-associado/index.ts`

Adicionar exclusão de cotações vinculadas a leads do associado **ANTES** de desvincular os leads:

```typescript
// NOVO: Buscar todos os leads vinculados ao associado
const { data: leads } = await supabaseAdmin
  .from("leads")
  .select("id")
  .eq("associado_id", associadoId);

console.log(`[delete-associado] Leads vinculados: ${leads?.length || 0}`);

// NOVO: Excluir cotações vinculadas a esses leads (que não foram excluídas via contrato)
if (leads && leads.length > 0) {
  for (const lead of leads) {
    // Excluir cotacoes_historico primeiro (FK)
    await supabaseAdmin.from("cotacoes_historico").delete().eq("cotacao_id", 
      supabaseAdmin.from("cotacoes").select("id").eq("lead_id", lead.id)
    );
    
    // Excluir cotacao_beneficios primeiro (FK)
    const { data: cotacoesLead } = await supabaseAdmin
      .from("cotacoes")
      .select("id")
      .eq("lead_id", lead.id);
    
    if (cotacoesLead && cotacoesLead.length > 0) {
      for (const cotacao of cotacoesLead) {
        // Limpar dependências
        await supabaseAdmin.from("cotacao_beneficios").delete().eq("cotacao_id", cotacao.id);
        await supabaseAdmin.from("cotacoes_historico").delete().eq("cotacao_id", cotacao.id);
        await supabaseAdmin.from("servicos").delete().eq("cotacao_id", cotacao.id);
        await supabaseAdmin.from("instalacoes_pendentes_criacao").delete().eq("cotacao_id", cotacao.id);
        
        // Limpar referência do contrato se existir (já pode ter sido excluído)
        await supabaseAdmin
          .from("contratos")
          .update({ cotacao_id: null })
          .eq("cotacao_id", cotacao.id);
      }
      
      // Excluir cotações
      await supabaseAdmin.from("cotacoes").delete().eq("lead_id", lead.id);
    }
  }
}

// 3. Unlink leads (keep for history)
const { error: leadsError } = await supabaseAdmin
  .from("leads")
  .update({ associado_id: null })
  .eq("associado_id", associadoId);
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Buscar todos os leads vinculados ao associado           │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Para cada lead, buscar cotações vinculadas              │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Excluir dependências das cotações:                      │
│     - cotacao_beneficios                                    │
│     - cotacoes_historico                                    │
│     - servicos                                              │
│     - instalacoes_pendentes_criacao                         │
│     - desvincular de contratos                              │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Excluir cotações do lead                                │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Desvincular leads do associado                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/delete-associado/index.ts` | Adicionar exclusão de cotações vinculadas a leads |

---

## Posição no Código

A nova lógica será inserida **ANTES** da linha 207 (seção "3. Unlink leads"):

```typescript
// Linha ~206 - Inserir ANTES do código existente

// NOVO CÓDIGO AQUI ↓

// 3. Unlink leads (keep for history) ← Código existente
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Cotação permanece visível após excluir associado | Cotação é excluída junto com o associado |
| Lead fica com `associado_id = null` mas cotações intactas | Cotações do lead são excluídas antes de desvincular |

---

## Testes Recomendados

1. Criar um novo associado com cotação recusada (sem contrato gerado)
2. Excluir o associado
3. Verificar que a cotação não aparece mais na lista `/vendas/cotacoes`
4. Verificar que o lead permanece no sistema (apenas desvinculado)

