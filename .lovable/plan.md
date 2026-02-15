
# Adicionar Botao de Excluir na Lista de Chamados de Assistencia (Diretor)

## Problema

A tela de lista de chamados (Fila de Chamados) so mostra o botao de visualizar (olho). O diretor precisa de um botao de excluir tambem nessa lista, com dialogo de confirmacao.

## Alteracoes

### Arquivo: `src/pages/assistencia/ChamadosList.tsx`

1. Importar `Trash2` do lucide-react
2. Importar `usePermissions` do hook de permissoes
3. Importar `ConfirmacaoExclusaoChamadoDialog` ja criado
4. Importar `supabase` e `toast`
5. Adicionar estados: `dialogExcluir` (boolean), `chamadoParaExcluir` (objeto com id e protocolo)
6. Adicionar funcao `handleExcluir` que chama a edge function `delete-chamado-assistencia`
7. Na coluna "Acoes" (linha 413-424), adicionar um botao de lixeira vermelho ao lado do botao de visualizar, visivel apenas para `isDiretor`
8. Renderizar o `ConfirmacaoExclusaoChamadoDialog` no final do componente

### Trecho da coluna de acoes (apos o botao Eye)

```tsx
<TableCell>
  <div className="flex items-center gap-1">
    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(...); }}>
      <Eye className="h-4 w-4" />
    </Button>
    {isDiretor && (
      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
        onClick={(e) => {
          e.stopPropagation();
          setChamadoParaExcluir({ id: chamado.id, protocolo: chamado.protocolo });
          setDialogExcluir(true);
        }}>
        <Trash2 className="h-4 w-4" />
      </Button>
    )}
  </div>
</TableCell>
```

Nenhuma edge function nova e necessaria -- reutiliza a `delete-chamado-assistencia` ja existente e o componente de confirmacao `ConfirmacaoExclusaoChamadoDialog` ja criado.
