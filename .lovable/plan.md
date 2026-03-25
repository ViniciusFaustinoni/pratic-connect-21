

# Gestão de Linhas de Produto dentro de Planos & Precos

## Problema
Nao existe acesso para criar/editar Linhas de Produto dentro da Gestao Comercial. O componente `LinhasTab` existe em `/admin/planos` mas esta isolado.

## Solucao
Adicionar um botao "Gerenciar Linhas" ao lado do filtro de linhas no header da aba Planos & Precos. Ao clicar, abre um Dialog/Sheet com a listagem de linhas (cards com editar, duplicar, excluir, ativar/desativar) e botao "Nova Linha" — reaproveitando a logica ja existente no `LinhasTab` e `LinhaFormModal`.

## Alteracoes

### 1. `src/components/gestao-comercial/ProdutosPlanos.tsx`
- Adicionar botao "Gerenciar Linhas" (icone Settings ou Layers) ao lado do Select de filtro de linhas (linha ~302)
- Controlar state `linhasSheetOpen` para abrir um `Dialog` com o conteudo de gerenciamento
- Dentro do Dialog, renderizar o componente `LinhasTab` existente
- Importar `LinhasTab` de `@/components/admin/planos/LinhasTab`
- Importar `Dialog, DialogContent, DialogHeader, DialogTitle` dos UI components

Resultado: o diretor filtra por linha E gerencia linhas no mesmo lugar, sem sair da pagina.

| Arquivo | Tipo |
|---|---|
| `src/components/gestao-comercial/ProdutosPlanos.tsx` | Editado |

