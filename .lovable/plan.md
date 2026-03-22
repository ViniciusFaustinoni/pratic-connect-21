

# Plano: Indicadores visuais de Landing Page e Agente IA nos cards de planos

## Resumo

Adicionar badges visuais no `PlanCard.tsx` (gerenciamento de planos) indicando se cada plano está ativo na Landing Page e/ou no Agente IA, usando os campos `visivel_landing` e `disponivel_agente` já existentes na tabela `planos`.

## Alteração em `src/components/admin/planos/PlanCard.tsx`

Na linha de badges do plano (após o badge "Inativo" e "APP", linhas 103-121), adicionar:

- **Badge "Landing Page"**: ícone `Globe` + texto, cor verde/teal, exibido quando `(plan as any).visivel_landing === true`
- **Badge "Agente IA"**: ícone `Bot` + texto, cor purple/blue, exibido quando `(plan as any).disponivel_agente === true`

Importar `Globe` e `Bot` de `lucide-react`.

Os mesmos badges também serão adicionados na seção mobile (linhas 176-192).

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/planos/PlanCard.tsx` | Badges "Landing Page" e "Agente IA" + imports |

