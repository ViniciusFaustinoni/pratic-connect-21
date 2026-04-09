

## Plano: Converter Linhas e Planos de grid de cards para lista compacta

### Situacao atual
As linhas ja usam `Collapsible` para expandir/recolher. Dentro de cada linha, os planos sao exibidos em um grid de cards grandes (2 colunas) com contadores de coberturas/beneficios ocupando muito espaco vertical.

### O que muda
Substituir o grid de cards dos planos por uma **lista compacta** (tabela/rows) onde cada plano e uma linha horizontal com:
- Nome + badge
- Contadores inline (coberturas/beneficios em texto, nao cards)
- Switch de ativo/inativo
- Botoes de acao (editar, duplicar, excluir) alinhados a direita

### Arquivo alterado
**`src/components/gestao-comercial/LinhasPlanos.tsx`** (linhas 340-441)

Substituir o bloco `<CollapsibleContent>` interno:
- Trocar `grid grid-cols-1 xl:grid-cols-2` por `divide-y` vertical list
- Cada plano vira uma row flex com: nome | badges | coberturas X | beneficios Y | switch | acoes
- Remover os sub-cards de contagem (rounded-2xl com icone Shield/Sparkles)
- Manter toda a logica existente (modais, delete, duplicate, toggle)

### Layout da row

```text
| Nome do Plano [Badge]  |  🛡 9 cob.  ⭐ 7 ben.  |  Ordem 0  |  [toggle] [✏️] [📋] [🗑️] |
```

### Nao alterado
- Header da linha (Collapsible trigger) — mantem como esta
- Estatisticas globais (Linhas/Planos/Ativos)
- Modais (LinhaFormModal, PlanFormModal, ImportarLinhasModal)
- Hooks e logica de dados
- AlertDialog de exclusao

