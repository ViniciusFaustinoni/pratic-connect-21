

# Corrigir persistencia de marcas e filtro de oficinas

## Problema 1: Editar oficina como GLOBAL nao persiste

A interface `Oficina` em `src/types/database.ts` nao tem o campo `marcas_atendidas`. O hook `useUpdateOficina` usa `Partial<Oficina>`, entao o TypeScript silenciosamente descarta `marcas_atendidas` do payload. O campo e enviado no `OficinaFormDialog`, mas como nao faz parte do tipo, pode ser ignorado em certas operacoes tipadas.

Na pratica, o `OficinaFormDialog` faz spread do payload com `marcas_atendidas` direto no `mutateAsync`, entao o campo chega ao Supabase. Porem, ao verificar no banco, a oficina ABDALA NAJA MOTOPECAS ja tem `marcas_atendidas: [GLOBAL]`. Isso sugere que o save pode ter funcionado, mas o modal nao atualizou o estado local (o drawer/lista nao refletiu a mudanca).

**Correcao**: Adicionar `marcas_atendidas` na interface `Oficina` e garantir que apos salvar, o cache do React Query seja invalidado e a lista/drawer atualize.

## Problema 2: Nenhuma oficina compativel encontrada para Toyota

O filtro `oficinasCompativeis` (linha 91-102 do `AtribuirFornecedoresDialog.tsx`) exige que a oficina tenha especialidades que correspondam as etapas de reparo. A oficina ABDALA tem `especialidades: []` (vazio), entao e filtrada fora mesmo tendo `marcas_atendidas: [GLOBAL]`.

**Correcao**: Quando a oficina nao tem especialidades cadastradas (array vazio), considerar como "oficina generalista" e incluir na lista. O filtro so deve excluir oficinas que tenham especialidades cadastradas mas nenhuma compativel.

## Alteracoes

### 1. `src/types/database.ts` (linha 828)

Adicionar campo `marcas_atendidas` na interface `Oficina`:

```text
marcas_atendidas?: string[];
especialidades: string[];
```

### 2. `src/components/sinistros/AtribuirFornecedoresDialog.tsx` (linhas 91-102)

Alterar filtro para incluir oficinas sem especialidades cadastradas:

```text
// Antes: exclui oficinas sem especialidades
if (!o.especialidades?.length) return false;

// Depois: inclui oficinas sem especialidades (generalistas)
if (!o.especialidades?.length) return true;
```

### 3. `src/components/oficinas/OficinaDetailDrawer.tsx`

Garantir que o drawer exiba `marcas_atendidas` usando o tipo correto (sem cast `as any`).

