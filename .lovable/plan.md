
# Auto-preencher Marca, Modelo e Ano do Veiculo no Orcamento

## Problema

Os campos Marca, Modelo e Ano no formulario de orcamento do regulador ainda exigem preenchimento manual (via dropdowns), mesmo quando esses dados ja existem no cadastro do veiculo vinculado ao sinistro. Isso gera retrabalho desnecessario.

## Solucao

Remover os dropdowns FIPE (Marca/Modelo/Ano) e substituir por campos somente leitura que sao preenchidos automaticamente a partir dos dados do veiculo do sinistro (`veiculo.marca`, `veiculo.modelo`, `veiculo.ano_modelo`). Isso elimina toda a logica de busca FIPE em cascata para o veiculo compartilhado, pois os dados ja estao disponiveis.

## Alteracoes

### Arquivo: `src/components/regulador/VistoriaEventoOrcamento.tsx`

1. **Remover estados e efeitos de busca FIPE compartilhada** (linhas 87-160):
   - Remover `sharedMarcas`, `sharedModelos`, `sharedAnos`, `loadingShared*`, `openShared*`, `autoMatchedRef`
   - Remover os 3 `useEffect` que fazem fetch na API FIPE para marcas/modelos/anos

2. **Inicializar `sharedVeiculo` diretamente dos dados do veiculo**:
   - Usar `veiculo.marca` como `marcaNome`
   - Usar `veiculo.modelo` como `modeloNome`  
   - Usar `veiculo.ano_modelo` como `anoNome`
   - Os campos `*Codigo` ficam vazios (nao sao necessarios para a funcionalidade do regulador)

3. **Substituir os dropdowns por campos de texto somente leitura** (secao "Veiculo aplicado a todos os itens"):
   - Em vez de Popovers/Comboboxes editaveis, exibir os valores como texto fixo ou `Input disabled`
   - Manter o resumo visual "Toyota - Corolla XEi 2.0 - 2013 Flex"

4. **Remover imports nao utilizados**: `Popover`, `PopoverContent`, `PopoverTrigger`, `Command*`, `ChevronsUpDown` (se nao usados em outro lugar do arquivo)

### Resultado visual

A secao "Veiculo (aplicado a todos os itens)" mostrara os dados preenchidos e travados:

```
Veiculo (aplicado a todos os itens)
Toyota — Corolla XEi 2.0 Flex 16V Aut. — 2013 Flex

Marca:   [Toyota]          (somente leitura)
Modelo:  [Corolla XEi...]  (somente leitura)
Ano:     [2013]            (somente leitura)
```

Sem necessidade de interacao do regulador - os dados vem direto do sistema.
