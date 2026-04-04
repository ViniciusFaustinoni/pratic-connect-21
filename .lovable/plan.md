

# Abrir Detalhes da Instalação em Modal Centralizado (Dialog)

## Problema
Atualmente, o componente `InstalacaoDetailDrawer` usa um `Drawer` (painel lateral que sobe de baixo). O usuário quer que ao clicar num item da lista, abra um modal centralizado. Além disso, as linhas da tabela têm `cursor-pointer` mas não têm `onClick`.

## Alterações

### 1. `src/components/instalacoes/InstalacaoDetailDrawer.tsx`
- Trocar `Drawer`/`DrawerContent`/`DrawerHeader`/`DrawerTitle` por `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` (já importados no arquivo)
- Ajustar classes do `DialogContent` para ser largo e com scroll: `max-w-4xl max-h-[90vh] overflow-y-auto`
- Remover imports não utilizados de Drawer

### 2. `src/pages/monitoramento/Instalacoes.tsx`
- Adicionar `onClick={() => handleOpenDetail(instalacao.id)}` no `<TableRow>` (linha 185) para que clicar na linha inteira abra o modal

## Impacto
- 2 arquivos alterados
- Funcionalidade idêntica, apenas layout muda de drawer lateral para modal centralizado
- Clique na linha da tabela também abre o modal

