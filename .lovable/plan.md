

# Revisao do Sistema de Regras de Elegibilidade — Status Atual

## Verificacao Completa dos 8 Tipos de Regra

| # | Regra | Editor UI | Motor Cotacao | Dados |
|---|---|---|---|---|
| 1 | Valor FIPE (faixa) | ✅ Inputs min/max | ✅ `fipe_range` em `checkRuleAgainstVehicle` | ✅ `valorFipe` no contexto |
| 2 | Ano (faixa) | ✅ Inputs min/max | ✅ `ano_range` | ✅ `anoVeiculo` no contexto |
| 3 | Categoria Veiculo Aceita | ✅ Checkboxes do CRUD (`useCategoriasVeiculoPlano`) | ✅ `categoria_veiculo` | ✅ `categoriaVeiculo` derivado de `tipoVeiculo` |
| 4 | Categoria Especial | ✅ Checkboxes do CRUD (`useCategoriasVeiculo`) | ✅ `categoria_especial` | ✅ `categoriaEspecial` = `params.categoria` |
| 5 | Regiao | ✅ Checkboxes do CRUD (`useRegioes`) | ✅ `regiao` | ✅ `regiao` no contexto |
| 6 | Marca/Modelo/Versao | ✅ Inputs texto + modo include/exclude | ✅ `marca_modelo` com contains match | ✅ `marca`, `modelo` no contexto |
| 7 | Tipo de Uso | ✅ Checkboxes do CRUD (`tipos_uso`) | ✅ `tipo_uso` | ✅ `tipoUso` derivado de `usoApp` |
| 8 | Combustivel | ✅ Checkboxes do CRUD (`useCombustiveis`) | ✅ `combustivel` | ✅ `combustivel` no contexto |

## Integracao nos 4 Formularios

| Entidade | Formulario | Status |
|---|---|---|
| Linha | `LinhaFormModal.tsx` | ✅ `EligibilityRulesEditor entityType="linha"` |
| Plano | `PlanFormModal.tsx` | ✅ Aba "Regras" com o editor `entityType="plano"` |
| Cobertura | `CoberturaUnificadaFormModal.tsx` | ✅ Secao de regras `entityType="cobertura"` |
| Beneficio | `BeneficioFormModal.tsx` (produto) | ✅ Secao de regras `entityType="beneficio"` |

## Motor de Cotacao — Cascata

1. **Linha**: regras verificadas (linhas 511-518 de `usePlanosCotacao.ts`) — bloqueia plano inteiro
2. **Plano**: regras verificadas (linhas 519-524) — bloqueia plano inteiro
3. **Cobertura + Beneficio**: regras verificadas (linhas 693-710) — remove item individual do plano

## Conclusao

**O sistema esta completo e alinhado com os 8 requisitos.** Nao ha correcoes pendentes. Todos os dados fluem corretamente:
- Editor busca opcoes dos CRUDs do diretor (Cadastros Base)
- Motor de cotacao constroi `VehicleContext` com separacao correta de `categoriaVeiculo` vs `categoriaEspecial`
- Regras sao aplicadas em cascata (linha → plano → cobertura/beneficio)
- Backward compatibility mantida com filtros legados existentes

Nenhuma alteracao de codigo e necessaria neste momento.

