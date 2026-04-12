

## Plano: Ordenar planos alfabeticamente

### Alteração única

**Arquivo: `src/components/gestao-comercial/LinhasPlanos.tsx`** (linha ~577)

Onde os planos são renderizados com `linha.plans.map(...)`, adicionar `.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))` antes do `.map()` para garantir ordem alfabética.

Isso afeta apenas a exibição na gestão comercial. A ordem no banco (`ordem`) permanece inalterada para uso em cotações/outros contextos.

