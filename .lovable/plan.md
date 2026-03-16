

## Plano: Ocultar planos negados e remover alerta visual

### Problema
Planos negados pela elegibilidade aparecem como selecionáveis na cotação. O alerta visual "planos indisponíveis" também é desnecessário — planos negados devem simplesmente não aparecer.

### Edições

**1. `src/hooks/usePlanosCotacao.ts` (linhas 387-395)** — Restaurar `continue` para que planos negados sejam excluídos dos resultados:

```typescript
if (elegibilidadeStatus === 'negado') {
  negados.push({
    planoId: plano.id,
    planoNome: plano.nome,
    linha,
    motivo: 'Modelo não elegível para este plano',
  });
  continue; // ← restaurar: plano negado não aparece na cotação
}
```

**2. `src/pages/vendas/Cotador.tsx`** — Remover o bloco `AlertaElegibilidadeNegada` (em torno da linha 1394) e o import correspondente.

**3. `src/pages/vendas/Cotacao.tsx`** — Remover o bloco `AlertaElegibilidadeNegada` (em torno da linha 420) e o import.

**4. `src/components/cotacoes/CotacaoFormDialog.tsx`** — Remover o bloco `AlertaElegibilidadeNegada` (em torno da linha 1711) e o import.

### Filtros de região e uso
Os filtros de região (`regiao`) e uso do veículo (`usoApp`, `categoria`) já são passados corretamente ao hook `usePlanosCotacao` e aplicados nos filtros internos (linhas 347-369). Nenhuma correção necessária nesses filtros.

### Resultado
- Planos negados por elegibilidade desaparecem completamente da cotação
- Sem alerta visual de "planos indisponíveis"
- Filtros de região e uso continuam funcionando normalmente

