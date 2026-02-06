
# Plano: Correções no Fluxo de Recusa de Vistoria e Duplicidade de Documentos

## Problemas Identificados

Analisando o código e o comportamento reportado, identifiquei **3 problemas principais**:

### Problema 1: Veículos recusados NÃO vão para a Blacklist
**Onde:** `src/hooks/useVistoriaCompleta.ts` - hook `useRecusarVeiculoVistoria`

O hook apenas:
- Atualiza o veículo para status `suspenso`
- Atualiza a vistoria para `reprovada`
- Cancela a instalação
- Registra no histórico

**Falta:** Inserir o veículo na tabela `blacklist_veiculos` com `tipo_reprovacao = 'vistoria_reprovada'`

### Problema 2: Status do veículo é "suspenso" quando deveria ser "recusado"
**Onde:** Enum `status_veiculo` no banco de dados

O enum atual só possui:
```
{em_analise, aprovado, instalacao_pendente, ativo, suspenso, cancelado, sinistrado}
```

**Falta:** Adicionar valor `recusado` ao enum para representar veículos reprovados na vistoria.

### Problema 3: Documentos duplicados (Laudo Vistoria)
**Onde:** `supabase/functions/gerar-laudo-vistoria/index.ts`

A edge function insere um novo documento na tabela `documentos` **sem verificar** se já existe um laudo para aquele veículo (linhas 987-1000):

```typescript
const { error: docError } = await supabase
  .from('documentos')
  .insert({
    associado_id: associadoId,
    veiculo_id: veiculoId,
    tipo: 'laudo_vistoria',
    // ...
  });
```

Cada chamada cria um novo registro, causando duplicidade.

---

## Solução Proposta

### 1. Adicionar valor "recusado" ao enum status_veiculo

```sql
ALTER TYPE status_veiculo ADD VALUE 'recusado';
```

### 2. Atualizar hook useRecusarVeiculoVistoria

Modificar o hook para:

1. **Alterar status do veículo para 'recusado'** (em vez de 'suspenso')
2. **Adicionar veículo à blacklist** com tipo `vistoria_reprovada`
3. **Atualizar status do associado** para `suspenso` ou `cancelado`
4. **Atualizar contrato** (se existir) para status apropriado

**Arquivo:** `src/hooks/useVistoriaCompleta.ts`

```typescript
// Na função mutationFn, após atualizar a vistoria:

// 2. Atualizar veículo como RECUSADO (não suspenso)
const { data: veiculoData, error: veiculoError } = await supabase
  .from('veiculos')
  .update({ 
    status: 'recusado', // MUDANÇA: era 'suspenso'
    motivo_recusa_veiculo: data.observacoes,
    recusado_por: profile?.id,
    recusado_em: agora,
    updated_at: agora,
  })
  .eq('id', data.veiculoId)
  .select('placa, chassi')
  .single();

// NOVO: Adicionar à blacklist
if (veiculoData) {
  await supabase
    .from('blacklist_veiculos')
    .insert({
      placa: veiculoData.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      chassi: veiculoData.chassi,
      motivo: data.motivo,
      justificativa: data.observacoes,
      tipo_reprovacao: 'vistoria_reprovada',
      veiculo_id: data.veiculoId,
      associado_id: data.associadoId,
      adicionado_por: profile?.id,
      vistoria_id: data.vistoriaId, // referência à vistoria
      ativo: true,
    });
}

// NOVO: Atualizar associado para suspenso
await supabase
  .from('associados')
  .update({ 
    status: 'suspenso',
    updated_at: agora,
  })
  .eq('id', data.associadoId);

// NOVO: Atualizar contrato para cancelado
if (vistoriaData?.contrato_id) {
  await supabase
    .from('contratos')
    .update({ 
      status: 'cancelado',
      motivo_cancelamento: `Vistoria reprovada: ${data.motivo}`,
    })
    .eq('id', vistoriaData.contrato_id);
}
```

### 3. Corrigir duplicidade de documentos (Laudo Vistoria)

**Arquivo:** `supabase/functions/gerar-laudo-vistoria/index.ts`

Antes de inserir, verificar se já existe e fazer upsert ou delete do anterior:

```typescript
// NOVO: Deletar laudo anterior se existir (evita duplicidade)
const { data: laudoExistente } = await supabase
  .from('documentos')
  .select('id, arquivo_url')
  .eq('associado_id', associadoId)
  .eq('veiculo_id', veiculoId)
  .eq('tipo', 'laudo_vistoria')
  .maybeSingle();

if (laudoExistente) {
  console.log('[LAUDO] Laudo anterior encontrado, será substituído:', laudoExistente.id);
  
  // Deletar arquivo antigo do storage
  if (laudoExistente.arquivo_url) {
    const pathMatch = laudoExistente.arquivo_url.match(/\/documentos\/(.+)$/);
    if (pathMatch) {
      await supabase.storage.from('documentos').remove([pathMatch[1]]);
    }
  }
  
  // Deletar registro antigo
  await supabase
    .from('documentos')
    .delete()
    .eq('id', laudoExistente.id);
}

// Depois continuar com a inserção normal do novo laudo
```

### 4. (Opcional) Adicionar coluna vistoria_id à blacklist

Para rastrear qual vistoria originou o bloqueio:

```sql
ALTER TABLE blacklist_veiculos 
ADD COLUMN vistoria_id UUID REFERENCES vistorias(id);
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| **Migração SQL** | Adicionar valor `recusado` ao enum `status_veiculo` |
| **Migração SQL** | Adicionar coluna `vistoria_id` à tabela `blacklist_veiculos` (opcional) |
| `src/hooks/useVistoriaCompleta.ts` | Atualizar lógica de recusa para incluir blacklist, status correto e associado |
| `supabase/functions/gerar-laudo-vistoria/index.ts` | Verificar duplicidade antes de inserir laudo |

---

## Fluxo Esperado Após Correções

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Técnico recusa veículo durante vistoria                 │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Vistoria atualizada para status "reprovada"             │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Veículo atualizado para status "recusado"               │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Veículo inserido na blacklist_veiculos                  │
│     com tipo_reprovacao = 'vistoria_reprovada'              │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Associado atualizado para status "suspenso"             │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Contrato atualizado para status "cancelado"             │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Veículo aparece na página Blacklist - Diretoria         │
└─────────────────────────────────────────────────────────────┘
```

---

## Comportamento Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Recusar vistoria | Veículo fica "suspenso" | Veículo fica "recusado" |
| Recusar vistoria | Não vai para blacklist | Vai para blacklist automaticamente |
| Recusar vistoria | Associado mantém status | Associado fica "suspenso" |
| Recusar vistoria | Contrato inalterado | Contrato fica "cancelado" |
| Gerar laudo | Cria novo documento sempre | Substitui laudo anterior |
| Página Blacklist | Sem registro da recusa | Mostra "Vistoria Reprovada" |

---

## Testes Recomendados

1. Acessar como vistoriador e recusar uma vistoria
2. Verificar se o veículo aparece na Blacklist com tipo "Vistoria Reprovada"
3. Verificar se o status do veículo é "recusado"
4. Verificar se o status do associado é "suspenso"
5. Verificar se não há documentos duplicados na lista de documentos
6. Tentar fazer uma cotação com a mesma placa e confirmar que é bloqueada
