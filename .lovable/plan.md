

## Plano: Corrigir exclusao de associado/veiculo na Base Antiga

### Problema
Ao excluir um associado (e seus veiculos), a FK `substituicoes_veiculo_veiculo_novo_id_fkey` e `substituicoes_veiculo_veiculo_antigo_id_fkey` na tabela `substituicoes_veiculo` bloqueia o DELETE nos veiculos.

### Correcao
**`src/hooks/useDeleteBaseAntiga.ts`** - antes de excluir veiculos, limpar referencias na tabela `substituicoes_veiculo`:

Para **tipo === 'veiculo'**:
1. Deletar registros de `substituicoes_veiculo` onde `veiculo_antigo_id = id` ou `veiculo_novo_id = id`
2. Depois deletar o veiculo

Para **tipo === 'associado'**:
1. Buscar IDs dos veiculos do associado
2. Deletar registros de `substituicoes_veiculo` onde `veiculo_antigo_id` ou `veiculo_novo_id` estejam na lista de IDs dos veiculos, **ou** onde `associado_id = id`
3. Deletar os veiculos
4. Deletar o associado

```typescript
// Antes de deletar veiculo(s), limpar substituicoes
const veiculoIds = [...]; // IDs a deletar
for (const vid of veiculoIds) {
  await supabase.from('substituicoes_veiculo').delete().eq('veiculo_antigo_id', vid);
  await supabase.from('substituicoes_veiculo').delete().eq('veiculo_novo_id', vid);
}
// Tambem limpar por associado_id
await supabase.from('substituicoes_veiculo').delete().eq('associado_id', id);
```

### Arquivo
- `src/hooks/useDeleteBaseAntiga.ts`

