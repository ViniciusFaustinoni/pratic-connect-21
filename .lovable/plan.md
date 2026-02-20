
# Corrigir: Diretor Não Consegue Editar Prestador de Assistência

## Diagnóstico Completo

### Problema 1 — Botão de editar na lista não faz nada
Em `PrestadoresList.tsx`, linha 374–376:
```tsx
<Button variant="ghost" size="icon">
  <Pencil className="h-4 w-4" />
</Button>
```
O botão existe visualmente mas não tem `onClick` — qualquer clique é ignorado.

### Problema 2 — Rota de edição não existe
Em `PrestadorDetalhe.tsx`, o menu "Ações → Editar" navega para `/assistencia/prestadores/${id}/editar`, mas no `App.tsx` essa rota não está registrada:
```tsx
// App.tsx — só tem essas rotas para assistência:
<Route path="/assistencia/prestadores" element={<PrestadoresList />} />
<Route path="/assistencia/prestadores/:id" element={<PrestadorDetalhe />} />
// ❌ Falta: /assistencia/prestadores/:id/editar
```
Resultado: clicar em "Editar" no detalhe navega para uma página em branco ou 404.

### Causa raiz
O `NovoPrestadorModal` (componente de formulário de prestador) foi criado apenas para **criação**, sem suporte a edição. A rota `/editar` foi adicionada ao código mas nunca implementada.

## Solução

A abordagem mais limpa é **adaptar o `NovoPrestadorModal` para aceitar um prestador existente**, tornando-o um modal tanto de criação quanto de edição — exatamente como o `PrestadorFormDialog` já faz para os prestadores de eventos. Depois:

1. Conectar o botão da lista ao modal de edição
2. Conectar o botão do detalhe ao mesmo modal (em vez de navegar para uma rota inexistente)
3. Registrar a rota de edição no `App.tsx` como redirecionamento para o detalhe (por segurança)

## Mudanças Técnicas

### 1. `src/components/assistencia/NovoPrestadorModal.tsx`

**Adicionar suporte a edição:**
- Nova prop `prestador?: Prestador` (tipo com todos os campos necessários)
- Quando `prestador` for fornecido: pré-preencher o formulário com `reset(defaultValues)` no `useEffect`
- Adicionar `updateMutation` que faz `supabase.from('prestadores_assistencia').update(...).eq('id', prestador.id)`
- No `onSubmit`: chamar `updateMutation` se `prestador` existe, `createMutation` se não existe
- Mudar título do Dialog para "Editar Prestador" quando for edição
- Adicionar `prestador_id` prop na interface

### 2. `src/pages/assistencia/PrestadoresList.tsx`

**Conectar botão de editar:**
- Adicionar estado `editingPrestador: Prestador | null`
- No botão lápis da tabela: `onClick={() => setEditingPrestador(prestador)}`
- Adicionar `<NovoPrestadorModal open={!!editingPrestador} onClose={() => setEditingPrestador(null)} prestador={editingPrestador} />`

### 3. `src/pages/assistencia/PrestadorDetalhe.tsx`

**Substituir navegação pelo modal:**
- Importar `NovoPrestadorModal` e adicionar estado `editOpen: boolean`
- Trocar `navigate('/assistencia/prestadores/${id}/editar')` por `setEditOpen(true)`
- Adicionar `<NovoPrestadorModal open={editOpen} onClose={() => setEditOpen(false)} prestador={prestador} />`

### 4. `src/App.tsx`

**Registrar a rota como fallback:**
- Adicionar `<Route path="/assistencia/prestadores/:id/editar" element={<PrestadorDetalhe />} />` — redireciona para o detalhe onde o modal pode ser aberto (proteção contra URLs diretas)

## Arquivos a Alterar

| Arquivo | Alteração |
|---|---|
| `src/components/assistencia/NovoPrestadorModal.tsx` | Adicionar prop `prestador?`, pré-preencher formulário, adicionar `updateMutation`, lógica de submit dual |
| `src/pages/assistencia/PrestadoresList.tsx` | Adicionar estado `editingPrestador`, `onClick` no botão lápis, renderizar modal de edição |
| `src/pages/assistencia/PrestadorDetalhe.tsx` | Substituir navegação para rota inexistente por abertura de modal |
| `src/App.tsx` | Registrar rota `/assistencia/prestadores/:id/editar` |

## Resultado Esperado

- Clicar no lápis na lista → abre modal pré-preenchido com os dados do prestador
- Clicar em "Ações → Editar" no detalhe → abre o mesmo modal pré-preenchido
- Salvar → chama `UPDATE` na tabela `prestadores_assistencia` e invalida o cache React Query
- Toast de sucesso "Prestador atualizado com sucesso!"
