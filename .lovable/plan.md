

# Ocultar Vistoria Concluida Automaticamente para o Regulador

## Problema

Quando o regulador finaliza uma vistoria, ele e redirecionado de volta para a lista, mas a vistoria concluida ainda aparece na lista porque o cache de dados nao e atualizado. O toast "Vistoria finalizada com sucesso!" aparece, porem o card permanece visivel.

## Causa Raiz

No componente `VistoriaEventoOrcamento.tsx`, apos finalizar com sucesso (linha 231), o codigo faz `navigate('/regulador/vistorias')` sem invalidar o cache do React Query (`vistorias-evento`). A lista continua mostrando dados antigos.

## Solucao

Adicionar invalidacao do cache apos a finalizacao bem-sucedida, garantindo que a lista seja recarregada ao voltar para a tela de vistorias.

## Detalhes Tecnicos

### `src/components/regulador/VistoriaEventoOrcamento.tsx`

1. Importar `useQueryClient` do `@tanstack/react-query`
2. Antes do `navigate`, adicionar:
   - `queryClient.invalidateQueries({ queryKey: ['vistorias-evento'] })`
   - `queryClient.invalidateQueries({ queryKey: ['vistorias-evento-contadores'] })`

Isso fara com que, ao retornar para a lista, o React Query busque os dados atualizados do banco, e a vistoria concluida sera filtrada automaticamente pelo filtro padrao que ja exclui status `concluida` e `cancelada` (logica existente no hook `useVistoriasEvento.ts`, linha 47).

| Arquivo | Alteracao |
|---|---|
| `src/components/regulador/VistoriaEventoOrcamento.tsx` | Adicionar invalidacao do cache `vistorias-evento` e `vistorias-evento-contadores` apos finalizar |

