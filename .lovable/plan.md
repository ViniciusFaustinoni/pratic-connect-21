

# Unificar "Condições Especiais" e "Tipo de Placa" em campo unico

## Problema

O formulario de cotacao tem dois campos que fazem a mesma coisa:
1. **Tipo de Placa** (dropdown dinamico de `tipos_placa`) — contem itens como "Chassi remarcado", "Veiculo proveniente de leilao", "Placa Vermelha", "Ex-taxi", "Taxi", etc.
2. **Condicoes Especiais / Desagios** (`VehicleCategorySelect`) — contem exatamente os mesmos itens hardcoded

O usuario quer manter apenas **Tipo de Placa** e eliminar o bloco de Condicoes Especiais.

## Impacto tecnico

O campo `categoria` (vindo do `VehicleCategorySelect`) alimenta:
- Desagio de preco (`isDesagio` → `valorDesagio`)
- Cota diferenciada (`planos_cotas_categoria`)
- Bloqueio de planos (`blocked_categories`)
- Exclusao de beneficios (`benefit_exclusions`)
- Regras unificadas (`categoriaEspecial` no `VehicleContext`)
- Alertas visuais

Toda essa logica precisa passar a usar `tipoPlacaSelecionado` em vez de `categoria`.

## Alteracoes

### 1. `CotacaoFormDialog.tsx`

- **Remover** o bloco "Condicoes Especiais / Desagios" inteiro (linhas ~1967-2004): o `VehicleCategorySelect`, o alerta dinamico de categoria
- **Remover** o state `categoria` e `handleCategoriaChange`
- **Remover** import de `VehicleCategorySelect` e `CATEGORIAS_VEICULO`
- **Remover** import de `isCoberturaRemovida`
- **Alimentar** `usePlanosCotacao` com `categoria: tipoPlacaSelecionado` em vez de `categoria: categoria`
- **Alimentar** `alertaCategoria` usando `tipoPlacaSelecionado`
- Em todos os locais que referenciam `categoria`, substituir por `tipoPlacaSelecionado`
- No payload de save, mapear `categoria: tipoPlacaSelecionado || null`

### 2. `usePlanosCotacao.ts`

- Nenhuma alteracao estrutural — o parametro `categoria` continua existindo, so muda o valor que chega (agora vem de `tipoPlacaSelecionado`)
- A logica de desagio, cota, blocked_categories, benefit_exclusions continua funcionando porque os values dos `tipos_placa` no banco devem corresponder aos mesmos slugs usados nas categorias (ex: `chassi_remarcado`, `leilao`, `taxi`, etc.)

### 3. `EtapaCriteriosCotacao.tsx`

- Mesmo tratamento: remover `VehicleCategorySelect` do bloco de Condicoes Especiais, usar o Tipo de Placa como unica fonte

### 4. Cotador.tsx (pagina antiga)

- Manter por enquanto (pagina legada), mas verificar se tambem tem duplicidade e alinhar

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Remover bloco Condicoes Especiais, redirecionar `categoria` para `tipoPlacaSelecionado` |
| `src/components/cotacao/EtapaCriteriosCotacao.tsx` | Remover VehicleCategorySelect, usar tipo de placa |

