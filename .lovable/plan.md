

# Adicionar regras de FIPE e tipo de veículo nos benefícios do catálogo

## Problema

O painel lateral (Sheet) de criação/edição de benefícios no catálogo da Gestão Comercial não permite configurar regras de elegibilidade. O sistema de regras já existe (`EligibilityRulesEditor`) e já suporta `fipe_range` e `categoria_veiculo`, mas não está integrado nessa interface simplificada.

## Solução

Adicionar o `EligibilityRulesEditor` dentro do **BeneficioSheet** em `CatalogoCoberturasBeneficios.tsx`, visível apenas no modo de edição (quando o benefício já tem um `id`). Isso permite ao diretor:

1. Definir **valor mínimo FIPE** (a partir de quanto o benefício se aplica)
2. Selecionar **tipos de veículo** aceitos (Carro, Moto, ou qualquer tipo criado)
3. Deixar sem regras = aceita qualquer valor/veículo

Não é necessário criar nada novo — apenas integrar o componente existente.

## Alterações

| Arquivo | Ação |
|---|---|
| `CatalogoCoberturasBeneficios.tsx` | Importar `EligibilityRulesEditor` e renderizá-lo dentro do `BeneficioSheet` quando em modo edição |

### Detalhes

No `BeneficioSheet`, após os campos Nome/Descrição/Valor e antes dos botões, adicionar:

```tsx
{item?.id && (
  <div className="border-t pt-4">
    <EligibilityRulesEditor entityType="beneficio" entityId={item.id} />
  </div>
)}
```

O editor já oferece a UI completa: adicionar regra de Faixa FIPE (min/max), Categoria de Veículo (checkboxes dinâmicos), e todas as outras regras do motor de elegibilidade. Sem regras configuradas, exibe "Nenhuma regra — aceita todos os veículos".

