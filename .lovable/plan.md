

# Deixar claro que 1% FIPE é valor sugerido

Duas mudanças simples de texto nos labels do campo de adesão:

### 1. `src/components/cotacoes/CotacaoFormDialog.tsx`

**Linha 1611-1613** — Texto auxiliar do campo principal:
```
"Valor da taxa de filiação (NÃO inclui mensalidade)"
→ "Valor sugerido: 1% da FIPE (mín. R$ 100). Altere conforme necessário."
```

**Linha 2046** — Campo inline no resumo (linha 2046): adicionar `adesaoEditadaManualmente.current = true` no `onChange` (igual ao outro campo, para consistência do guard).

Nenhuma mudança de lógica — apenas clareza no texto para o consultor saber que pode editar livremente.

