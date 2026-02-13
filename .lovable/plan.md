

# Corrigir crash no "Agendar Vistoria" do menu de Acoes do Sinistro

## Problema

Ao clicar em "Agendar Vistoria" no menu de acoes, a pagina crasha com o erro:
```
Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.
```

Este e um conflito conhecido entre os componentes Radix UI `DropdownMenu` e `Dialog`. Quando o DropdownMenu fecha e tenta remover seus nodes do DOM ao mesmo tempo que o Dialog tenta montar, ocorre uma colisao no DOM.

## Causa raiz

O `AgendarVistoriaModal` usa `Dialog` (Radix) internamente. Embora o codigo ja use `setTimeout(() => setModalVistoriaOpen(true), 0)` para atrasar a abertura, isso nao e suficiente porque o DropdownMenu ainda esta no processo de desmontagem.

Os modais "Atualizar Status" e "Emitir Parecer" usam o mesmo padrao e funcionam -- a diferenca e que o `AgendarVistoriaModal` possui `SelectContent` (outro portal Radix) dentro do Dialog, criando multiplos portais aninhados que agravam o conflito.

## Solucao

Adicionar `modal={false}` ao DropdownMenu para evitar que ele crie um portal separado, ou usar a prop `forceMount` no Dialog. A abordagem mais confiavel e garantir que o DropdownMenu esteja completamente fechado antes de abrir o Dialog.

## Alteracao

| Arquivo | Descricao |
|---|---|
| `src/pages/eventos/SinistroDetalhe.tsx` | Fechar o dropdown explicitamente via estado controlado antes de abrir qualquer modal. Usar `onCloseAutoFocus` com `e.preventDefault()` para evitar conflito de foco. |

### Detalhes tecnicos

1. Tornar o `DropdownMenu` controlado com estado `dropdownOpen`
2. Nos handlers dos `DropdownMenuItem`, fechar o dropdown primeiro e usar `setTimeout` com delay maior (100ms) para abrir o modal
3. Adicionar `onCloseAutoFocus={(e) => e.preventDefault()}` no `DropdownMenuContent` para evitar que o Radix tente focar um elemento que ja foi removido

```typescript
// Estado controlado do dropdown
const [dropdownOpen, setDropdownOpen] = useState(false);

// Handler para abrir modais com seguranca
const openModalSafely = (setter: (v: boolean) => void) => {
  setDropdownOpen(false);
  setTimeout(() => setter(true), 150);
};

// No DropdownMenu
<DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
  ...
  <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
    <DropdownMenuItem onSelect={(e) => {
      e.preventDefault();
      openModalSafely(setModalVistoriaOpen);
    }}>
      Agendar Vistoria
    </DropdownMenuItem>
    ...
  </DropdownMenuContent>
</DropdownMenu>
```

Essa abordagem sera aplicada a todos os itens do menu que abrem modais (Atualizar Status, Agendar Vistoria, Emitir Parecer, Vincular Processo, Excluir Sinistro) para consistencia e prevencao de problemas futuros.

