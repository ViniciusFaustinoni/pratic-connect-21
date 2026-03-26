

# Adicionar botao de exclusao nas Tabelas de Apoio

## Situacao atual

- **Combustiveis** ja tem botao "Remover" (remove do array JSON)
- **Regioes** tem `useDeleteRegiao` no hook mas o `RegioesTab` simplificado nao o utiliza
- **Tipos de Veiculo, Modalidades de Uso, Tipos de Placa** nao tem opcao de excluir — apenas editar e ativar/desativar

## Alteracoes

Adicionar um botao de excluir (icone Trash2) com dialogo de confirmacao em cada tab. A exclusao sera permanente, com confirmacao obrigatoria.

| Arquivo | Acao |
|---|---|
| `CategoriasVeiculoTab.tsx` | Adicionar botao Trash2 na linha do item + AlertDialog de confirmacao. Excluir = remover do array e salvar |
| `RegioesTab.tsx` | Importar `useDeleteRegiao` + adicionar botao Trash2 + AlertDialog de confirmacao |
| `TiposUsoTab.tsx` | Adicionar botao Trash2 + AlertDialog. Excluir = splice do array e salvar |
| `TiposPlacaTab.tsx` | Idem TiposUso |
| `CombustiveisTab.tsx` | Substituir o botao "Remover" por icone Trash2 consistente + AlertDialog de confirmacao (atualmente remove sem confirmar) |

### Padrao de UI

Cada linha de item tera, ao lado do botao de editar (Pencil):
- Botao `Trash2` (ghost, destructive, opacity-0 group-hover:opacity-100)
- Ao clicar, abre AlertDialog: "Tem certeza que deseja excluir [nome]? Esta acao nao pode ser desfeita."
- Botoes "Cancelar" e "Excluir" (destructive)

### Logica de exclusao

- **Categorias, TiposUso, TiposPlaca, Combustiveis**: `updated.splice(idx, 1)` + `saveMutation.mutate(updated)`
- **Regioes**: `deleteRegiao.mutate(id)` (hook existente com delete real no banco)

