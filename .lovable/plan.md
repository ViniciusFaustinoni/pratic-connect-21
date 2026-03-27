

# Mover elegibilidade do Plano para Coberturas e Beneficios

## Resumo

As regras de elegibilidade (Varia com FIPE, Regiao, Tipo de Uso, Tipo de Placa, Combustivel) sao movidas do nivel do **Plano** para o nivel de cada **Cobertura** e **Beneficio** individual. Assim, o mesmo plano pode aparecer para diferentes veiculos, mas exibindo apenas as coberturas/beneficios cujos filtros correspondem ao veiculo.

## Alteracoes

### 1. Expandir `CoberturaSheet` e `BeneficioSheet` em `CatalogoCoberturasBeneficios.tsx`

Adicionar secao de elegibilidade abaixo dos campos Nome/Descricao/Valor:

- **Varia com FIPE?** — Switch. Se sim, exibe campos Min/Max (R$). Se nao, aparece para todas as FIPEs.
- **Regiao** — Badges multi-select (de `useRegioes`)
- **Tipo de Uso** — Badges multi-select (de `useConfiguracaoJson('tipos_uso')`)
- **Tipo de Placa** — Badges multi-select (de `useConfiguracaoJson('tipos_placa')`)
- **Combustivel** — Badges multi-select (de `useCombustiveis`)

Ao salvar, gravar regras na tabela `entity_eligibility_rules` com `entity_type = 'cobertura'` ou `'beneficio'`. Ao editar, carregar regras existentes e pre-popular os campos.

### 2. Remover elegibilidade do `PlanoFormSheet.tsx`

- Remover todo o BLOCO 3 (Regras de Elegibilidade, linhas ~377-537)
- Remover states: `selTipoVeiculo`, `selUso`, `selMarcas`, `selPlaca`, `selCombustivel`, `fipeMin`, `fipeMax`, `anoMin`, `anoMax`
- Remover funcao `insertRules` e a limpeza de `entity_eligibility_rules` no save
- Remover imports de `useCategoriasVeiculoPlano`, `useConfiguracaoJson('tipos_uso')`, `useConfiguracaoJson('tipos_placa')`, `useCombustiveis`, `useMarcasModelos`
- Manter: Regioes no plano (controla disponibilidade do plano inteiro), Coberturas/Beneficios selecionados, Identificacao

### 3. Atualizar motor de cotacao (`usePlanosCotacao.ts`)

Atualmente, regras de `entity_type = 'plano'` bloqueiam o plano inteiro. Nova logica:

- O plano continua visivel se passa nas regras de **Linha** e **Regiao do plano** (planos_regioes)
- Apos aprovar o plano, filtrar individualmente cada cobertura e beneficio vinculado:
  - Carregar regras de `entity_type = 'cobertura'` e `'beneficio'` do `useAllEligibilityRules`
  - Para cada cobertura/beneficio do plano, rodar `checkAllRules` contra o `VehicleContext`
  - Coberturas/beneficios que nao passam sao **removidos da lista exibida** (nao ocultam o plano)
  - O valor mensal do plano pode ser recalculado sem os itens removidos

### 4. Exibir indicador visual no catalogo

Na `ItemList` do catalogo, mostrar um pequeno indicador (icone ou badge) quando o item tem regras de elegibilidade configuradas, para que o diretor saiba quais itens tem restricoes.

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx` | Expandir CoberturaSheet e BeneficioSheet com UI de elegibilidade; carregar/salvar regras |
| `src/components/gestao-comercial/PlanoFormSheet.tsx` | Remover bloco de elegibilidade inteiro |
| `src/hooks/usePlanosCotacao.ts` | Filtrar coberturas/beneficios individualmente por regras |

## Fluxo na cotacao

```text
Veiculo (FIPE, regiao, uso, placa, combustivel)
    │
    ├─ Plano A (passa regras da Linha + Regiao)
    │   ├─ Cobertura 1 (sem regras) ✓ exibe
    │   ├─ Cobertura 2 (FIPE > 50k) ✗ oculta se FIPE < 50k
    │   ├─ Beneficio 1 (apenas Passeio) ✓ exibe se uso = passeio
    │   └─ Beneficio 2 (sem regras) ✓ exibe
    │
    └─ Plano B ...
```

