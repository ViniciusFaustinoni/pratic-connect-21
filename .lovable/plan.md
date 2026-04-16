
## Problema

Erro 409: `update or delete on table "associados" violates foreign key constraint "rastreadores_associado_id_fkey" on table "rastreadores"`.

O hook `useDeleteBaseAntiga` (associado) deleta `veiculos` antes de `associados`, mas **não deleta os `rastreadores`** vinculados ao associado. A FK `rastreadores.associado_id → associados.id` bloqueia a exclusão.

## Investigação rápida necessária

Vou confirmar (na execução) com `supabase--read_query`:
- FKs em `rastreadores` apontando para `associados` e `veiculos` (e qual a regra `ON DELETE`)
- Se há rastreadores vinculados ao associado de SHT1E39
- Outras possíveis FKs órfãs (cobrancas, contratos, etc.) — mas a mensagem é específica de `rastreadores`

## Correção

### `src/hooks/useDeleteBaseAntiga.ts`

Antes de deletar `veiculos` e `associados`, **desvincular rastreadores** (não excluir o equipamento — ele volta para o estoque):

```ts
// 1. Desvincular rastreadores do associado (volta para estoque)
await supabase
  .from('rastreadores')
  .update({ 
    associado_id: null, 
    veiculo_id: null, 
    status: 'estoque' 
  })
  .eq('associado_id', id);

// 2. Para o caso 'veiculo', também desvincular rastreador desse veículo
await supabase
  .from('rastreadores')
  .update({ veiculo_id: null, status: 'estoque' })
  .eq('veiculo_id', id);

// 3. Depois deletar veículos e associado (fluxo atual)
```

Isso preserva o histórico do equipamento e libera a exclusão da base antiga (que é para registros legados sem operação real).

## Verificação pós-correção

Logar como `admin@teste.com` / `123456789`, abrir Base Antiga, buscar `SHT1E39`, excluir o associado **KAUA XAVIER DE SOUZA** e confirmar:
- Toast de sucesso
- Registro some da listagem
- Sem erro 409 no console
