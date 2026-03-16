

## Plano: Corrigir prazo sinistro para 60 dias úteis (dinâmico)

### Alterações necessárias

**1. Atualizar valor no banco** (INSERT tool)
```sql
UPDATE configuracoes 
SET valor = '60', 
    descricao = 'Prazo em dias úteis para indenização de roubo, furto e perda total após entrega da documentação completa'
WHERE chave = 'operacional_prazo_sinistro';
```

**2. Locais com prazo hardcoded a corrigir:**

| Arquivo | Problema | Correção |
|---------|----------|----------|
| `PrazoRessarcimento.tsx` (linha 9) | `const PRAZO_TOTAL = 60` hardcoded | Receber `prazoTotal` como prop, buscar via `useConfiguracaoNumero('operacional_prazo_sinistro', 60)` no componente pai |
| `SinistroDetalheQuickStats.tsx` (linha 17) | `Math.max(0, 30 - diasDesdeAbertura)` hardcoded com **30** | Usar `useConfiguracaoNumero('operacional_prazo_sinistro', 60)` e substituir o 30 |
| `IniciarIndenizacaoModal.tsx` (linha 129) | `// 60 dias úteis ≈ 84 dias corridos` com `vencimento.setDate(+84)` hardcoded | Buscar config do banco e calcular `prazo * 1.4` (conversão dias úteis → corridos) |
| `IniciarIndenizacaoModal.tsx` (linha 244) | Texto `"60 dias úteis"` hardcoded na UI | Interpolar valor dinâmico |

**3. Hook já existe** — `useConfiguracaoNumero` em `src/hooks/useConteudosSistema.ts` faz exatamente `getConfiguracao('chave')`. Será usado em todos os pontos.

**4. Componentes afetados:**

- **`PrazoRessarcimento.tsx`**: Adicionar prop `prazoTotal` e remover constante. O `isProximo` passa a ser `diasUteisConsumidos > prazoTotal - 5`.
- **`SinistroDetalheQuickStats.tsx`**: Adicionar `useConfiguracaoNumero('operacional_prazo_sinistro', 60)` e usar no cálculo de dias restantes.
- **`IniciarIndenizacaoModal.tsx`**: Buscar prazo e usar dinamicamente no cálculo de vencimento e no texto informativo.
- **Quem renderiza `PrazoRessarcimento`**: Buscar o prazo e passar como prop (ou buscar internamente no componente).

### Notas
- Os SLAs por status em `useEventosSLA.ts` são SLAs de etapa (não o prazo global de sinistro), então ficam como estão.
- Os "60 dias" em `calcular-comissoes-mensais` referem-se a inadimplência (não sinistro), sem alteração.
- O "90 dias úteis" em `TerceiroTermo.tsx` é prazo de reparo, diferente do prazo de indenização.

