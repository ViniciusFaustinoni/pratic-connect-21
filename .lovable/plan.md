

# Unificar "Nova Cotação" e "Outras Entradas" em um único ponto de entrada

## Resumo

Remover o botão "Outras Entradas" e transformar o botão "Nova Cotação" no único ponto de entrada. Ao clicar, abre um Dialog com 5 opções (Nova Cotação + as 4 existentes). Toda a lógica já implementada no `OutrasEntradasMenu` é preservada.

## Alterações

### 1. `src/components/vendas/OutrasEntradasMenu.tsx` → Refatorar para Dialog

- Renomear componente para `NovaEntradaDialog` (ou manter o arquivo, apenas mudar a interface)
- Trocar de `Popover` para `Dialog` (mais espaço, melhor UX para o fluxo multi-step)
- Receber props `open` e `onOpenChange` (controle externo pelo Cotacoes.tsx)
- Receber callback `onNovaCotacao` para quando o usuário escolher "Nova Cotação" (dispara `setShowCotacaoForm(true)` no pai)
- Adicionar **Opção 1 — Nova Cotação** como primeiro item na lista, com destaque visual:
  - Ícone: `Plus`
  - Descrição: "Cliente novo ou lead que quer se associar."
  - Estilo: borda colorida ou fundo primary/10 para destacar como opção principal
- Ao clicar "Nova Cotação": fecha o dialog e chama `onNovaCotacao()`
- As 4 opções restantes permanecem com a mesma lógica, busca, validações e redirecionamentos já implementados
- Manter o botão "Voltar" (ArrowLeft) para retornar à tela de seleção a partir de qualquer sub-fluxo

### 2. `src/pages/vendas/Cotacoes.tsx`

- Remover a importação e uso de `<OutrasEntradasMenu />`
- Remover o `PermissionGate` que envolvia o `OutrasEntradasMenu`
- O botão "Nova Cotação" passa a abrir o dialog unificado em vez de `setShowCotacaoForm(true)` diretamente:
  ```tsx
  const [showNovaEntrada, setShowNovaEntrada] = useState(false);
  
  <Button onClick={() => setShowNovaEntrada(true)}>
    <Plus /> Nova Cotação
  </Button>
  
  <NovaEntradaDialog
    open={showNovaEntrada}
    onOpenChange={setShowNovaEntrada}
    onNovaCotacao={() => setShowCotacaoForm(true)}
  />
  ```
- Manter o `PermissionGate` com `cotacao.canCreate` apenas no botão

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/vendas/OutrasEntradasMenu.tsx` | Refatorar de Popover para Dialog; adicionar opção "Nova Cotação"; receber props externas |
| `src/pages/vendas/Cotacoes.tsx` | Remover botão separado; conectar "Nova Cotação" ao dialog unificado |

Nenhuma lógica de negócio é alterada — apenas a estrutura visual e o ponto de entrada mudam.

