
# Adicionar botão de Excluir Sinistro na listagem (para Diretores)

## Problema

O botão de excluir sinistro existe apenas dentro da pagina de detalhe (`SinistroDetalhe.tsx`). Na listagem (`SinistrosList.tsx`), a coluna "Acoes" mostra apenas os botoes de Analisar, Enviar para Oficina e Visualizar -- sem opcao de exclusao para diretores.

## Solucao

Adicionar um botao de exclusao (icone de lixeira vermelha) na coluna de Acoes da listagem, visivel apenas para diretores. Ao clicar, abre o `ConfirmacaoExclusaoDialog` ja existente, que exige motivo e confirmacao antes de chamar a edge function `delete-sinistro`.

## Arquivo a modificar

**`src/pages/eventos/SinistrosList.tsx`**

1. Importar `Trash2` do lucide-react
2. Importar `ConfirmacaoExclusaoDialog` e `useDeleteSinistro`
3. Adicionar estados para controlar o modal de exclusao (`sinistroParaExcluir`, `modalExcluirOpen`)
4. Adicionar o botao de lixeira na coluna de Acoes, condicional a `isDiretor`
5. Renderizar o `ConfirmacaoExclusaoDialog` com callback de exclusao que invalida a query apos sucesso

### Mudancas na coluna de Acoes (apos o botao Eye, linha ~467)

```typescript
{isDiretor && (
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8 text-destructive hover:text-destructive"
    onClick={() => {
      setSinistroParaExcluir(sinistro);
      setModalExcluirOpen(true);
    }}
    title="Excluir Sinistro"
  >
    <Trash2 className="h-4 w-4" />
  </Button>
)}
```

### Modal no final do JSX

```typescript
{isDiretor && sinistroParaExcluir && (
  <ConfirmacaoExclusaoDialog
    open={modalExcluirOpen}
    onOpenChange={setModalExcluirOpen}
    protocolo={sinistroParaExcluir.protocolo}
    onConfirm={async (motivo) => {
      await deleteSinistro({
        sinistroId: sinistroParaExcluir.id,
        motivo
      });
    }}
  />
)}
```

Nenhum arquivo novo precisa ser criado. O dialog e o hook de exclusao ja existem e serao reutilizados.
