## Aviso de produção

O `navigate('/vendas/cotador?...')` na linha 351 do `OutrosProcessosPanel.tsx` aponta para uma **rota inexistente** em `App.tsx`. O botão "Editar cotação" (lápis) da aba Outros Processos › Troca de Titularidade hoje cai em 404. Substituí-lo pelo `TrocaTimelineDrawer` (passo 3) **não interfere em nada que esteja funcionando** — é correção de bug latente, não mudança de fluxo vigente.

## Confirmação final de dependências

- `src/hooks/useCotacao.ts` — único importador externo é `src/pages/vendas/Cotador.tsx:52` (`useCriarCotacao`). Os outros 5 exports (`usePlanosCotacao`, `calcularValoresCotacao`, `useCalcularCotacao` interno, `useCotacoesFiltradas`, `useCotacaoDetalhe`) têm zero consumidores.
- `src/pages/vendas/Cotador.tsx` — sem rota em `App.tsx`; única referência externa é o `navigate` morto do passo 3.
- `src/components/cotador/VehicleCategorySelect.tsx` — preservado (usado por `BenefitsSelector`, `EtapaCategoriaVeiculo`).
- `src/hooks/usePlanosCotacao.ts`, `src/hooks/useCalcularCotacao.ts`, `src/hooks/useCotacoes.ts` — não tocar.

## Passos

### 1. Deletar `src/pages/vendas/Cotador.tsx`
Remoção total. Sem ajustes em `App.tsx` (não há rota registrada).

### 2. Deletar `src/hooks/useCotacao.ts`
Remoção total do arquivo. Não restará importador algum após o passo 1.

### 3. Corrigir `src/components/cotacoes/OutrosProcessosPanel.tsx:343-356`

O `OutroProcessoItem` no panel não traz `associado_antigo_id` nem `veiculo_origem_id` (campos exigidos por `origemTroca` do `CotacaoFormDialog`). O padrão canônico que JÁ existe e já carrega esses dados é o `TrocaTimelineDrawer` — ele já está importado no panel (linha 20) e já monta o `CotacaoFormDialog` com `cotacaoBase` + `origemTroca` corretos (ver `TrocaTimelineDrawer.tsx:341-358`).

Mudança: o botão lápis (Pencil) passa a abrir o mesmo `TrocaTimelineDrawer` que o botão olho (Eye), reaproveitando `handleVerDetalhe(item)`. O drawer já oferece o botão "Realizar/Editar Cotação" dentro dele, que abre o `CotacaoFormDialog` em modo Troca com todos os parâmetros corretos.

Diff conceitual em `OutrosProcessosPanel.tsx` (linhas 343-356):

```tsx
{item.tipo === 'troca_titularidade' && item.pode_editar ? (
  <Tooltip><TooltipTrigger asChild>
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      onClick={(e) => {
        e.stopPropagation();
        handleVerDetalhe(item);   // abre TrocaTimelineDrawer; dentro dele há "Realizar/Editar Cotação"
      }}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  </TooltipTrigger><TooltipContent>Editar cotação (planos, região, cenário, uso)</TooltipContent></Tooltip>
) : ( ... )}
```

Nenhuma nova prop, nenhum novo state, nenhum novo import.

## Validação pós-mudança

- `rg -n "useCotacao'|from.*hooks/useCotacao\b|pages/vendas/Cotador|/vendas/cotador" src/` deve retornar zero matches.
- Build TypeScript limpo (sem referências quebradas).
- Smoke manual: abrir Outros Processos › Troca de Titularidade, clicar no lápis de uma linha editável, confirmar que o `TrocaTimelineDrawer` abre e o `CotacaoFormDialog` em modo Troca abre por dentro.

## Não tocar

- `src/components/cotador/VehicleCategorySelect.tsx`
- `src/hooks/usePlanosCotacao.ts`
- `src/hooks/useCalcularCotacao.ts`
- `src/hooks/useCotacoes.ts`
- Qualquer rota, edge function ou trigger DB.
