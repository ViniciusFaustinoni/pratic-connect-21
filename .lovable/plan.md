
# Corrigir erro ao salvar configuracoes

## Problema

Ao clicar em salvar, o sistema retorna erro **409** do Supabase:
- `updated_by` referencia o usuario logado (`4218616b-...`)
- Esse usuario existe em `auth.users` mas **nao tem registro na tabela `profiles`**
- A foreign key `configuracoes_updated_by_fkey` bloqueia o update

## Solucao

### 1. Inserir o profile ausente (dados)

Inserir o registro do usuario `admin@teste.com` na tabela `profiles` para resolver a constraint.

### 2. Tornar o codigo mais resiliente (codigo)

No arquivo `src/pages/diretoria/Configuracoes.tsx`, alterar a mutation para enviar `updated_by` como `null` caso o usuario nao tenha profile, evitando que o erro se repita com outros usuarios futuros:

```typescript
// Antes (linha 81-88):
const { data: { user } } = await supabase.auth.getUser();
const { error } = await supabase
  .from('configuracoes')
  .update({ 
    valor, 
    updated_at: new Date().toISOString(),
    updated_by: user?.id   // pode falhar se profile nao existe
  })
  .eq('chave', chave);

// Depois:
const { data: { user } } = await supabase.auth.getUser();
// Verificar se profile existe antes de referenciar
let updatedBy = null;
if (user?.id) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  updatedBy = profile?.id || null;
}
const { error } = await supabase
  .from('configuracoes')
  .update({ 
    valor, 
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  })
  .eq('chave', chave);
```

### Arquivos a alterar

| Arquivo | Alteracao |
|---------|-----------|
| Dados: tabela `profiles` | INSERT do usuario admin@teste.com |
| `src/pages/diretoria/Configuracoes.tsx` | Verificar existencia do profile antes de setar `updated_by` |
