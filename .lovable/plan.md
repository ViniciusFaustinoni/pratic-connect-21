

# Corrigir Persistência da Taxa Administrativa

## Problema

As operações de delete/insert em `planos_taxa_administrativa` dentro do `saveMutation` **não verificam erros**. Se a operação falhar (por RLS ou qualquer outro motivo), o código continua e exibe "Plano salvo" mesmo sem ter persistido as taxas.

## Alteração

### `src/components/gestao-comercial/PlanoFormSheet.tsx`

No `saveMutation.mutationFn`, adicionar verificação de erro (`if (error) throw error`) após cada operação de delete e insert na tabela `planos_taxa_administrativa`. Isso se aplica tanto ao fluxo de **edição** (linhas ~203-208) quanto ao de **criação** (linhas ~233-237).

**Edição (delete + insert):**
```ts
const { error: delTaxaErr } = await supabase.from('planos_taxa_administrativa').delete().eq('plano_id', planoId);
if (delTaxaErr) throw delTaxaErr;
if (taxaFaixas.length > 0) {
  const { error: insTaxaErr } = await supabase.from('planos_taxa_administrativa').insert(...);
  if (insTaxaErr) throw insTaxaErr;
}
```

**Criação (insert):**
```ts
if (taxaFaixas.length > 0) {
  const { error: insTaxaErr } = await supabase.from('planos_taxa_administrativa').insert(...);
  if (insTaxaErr) throw insTaxaErr;
}
```

Isso fará com que, caso haja falha de permissão ou qualquer erro, o toast mostre "Erro ao salvar plano" em vez de "Plano salvo".

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/gestao-comercial/PlanoFormSheet.tsx` | Adicionar error handling nas operações de taxa administrativa |

