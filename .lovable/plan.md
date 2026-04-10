

## Plano: Permitir editar o nome da linha ao duplicar

### Alteracao

Substituir o campo de "Nome resultante da linha" (hoje read-only, calculado automaticamente) por um Input editavel. O usuario podera alterar o nome livremente. O hook recebera um campo `nome` opcional que, se informado, sera usado no lugar da logica `nome + sufixo`.

### Arquivos

**1. `src/components/admin/planos/DuplicarLinhaModal.tsx`**
- Adicionar estado `nomeLinha` inicializado com `linha.name + ' (cópia)'`
- Substituir o `<p>` read-only por um `<Input>` editavel
- Atualizar `nomeResultante` para refletir o input + sufixo
- Passar `nome: nomeLinha` no `mutateAsync`

**2. `src/hooks/usePlansAdmin.ts`**
- Adicionar `nome?: string` ao `DuplicateLineInput`
- Na criacao da linha clonada (linha 1046), usar `input.nome` se fornecido, senao manter a logica atual com sufixo

