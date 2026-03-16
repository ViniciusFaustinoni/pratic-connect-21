

## Plano: Corrigir busca de motos na seleção manual FIPE

### Problema raiz

Existem 3 bugs na integração FIPE para motos no `CotacaoFormDialog.tsx`:

1. **Race condition no tipo**: Quando o usuário seleciona uma marca de moto (ex: HONDA), `handleMarcaChange` chama `setMarcaSelecionada(value)` e depois usa `tipoVeiculoDetectado` para decidir o tipo FIPE. Mas `tipoVeiculoDetectado` depende de `marcaSelecionada` via `useMemo` -- que ainda não atualizou (state do React é assíncrono). Resultado: sempre usa `'carros'` na primeira seleção.

2. **`getAnos` hardcoded para carros**: Na linha 512, `getAnos(marcaSelecionada, value, 'carros')` ignora completamente o tipo detectado.

3. **Marcas duplicadas sem distinção de tipo**: Ao fazer merge de marcas carros + motos, marcas como "HONDA" aparecem em ambas as listas com **códigos diferentes**. Quando o usuário seleciona "HONDA" (motos, código 31), o sistema pode estar tentando buscar modelos como se fosse "HONDA" (carros, código 25), causando erro.

### Solução

Rastrear o tipo FIPE (`carros` ou `motos`) junto com cada marca, para que ao selecionar uma marca o sistema saiba exatamente qual tipo usar nas chamadas subsequentes.

### Edições

**1. `src/components/cotacoes/CotacaoFormDialog.tsx`**

- Criar um tipo estendido `FipeMarcaComTipo` que adiciona `tipoFipe: 'carros' | 'motos'` ao `FipeMarca`.
- No fetch de marcas (linhas 441-445), ao mergear as listas, adicionar o campo `tipoFipe` a cada item:
  ```typescript
  const marcasCarros = dataCarros.map(m => ({ ...m, tipoFipe: 'carros' as const }));
  const marcasMotos = dataMotos.map(m => ({ ...m, tipoFipe: 'motos' as const }));
  setMarcas([...marcasCarros, ...marcasMotos]);
  ```
- Adicionar state `tipoFipeSelecionado` (`'carros' | 'motos'`), atualizado em `handleMarcaChange` com base na marca selecionada.
- Em `handleMarcaChange` (linha 491): usar o `tipoFipe` da marca selecionada ao invés de `tipoVeiculoDetectado`.
- Em `handleModeloChange` (linha 512): usar `tipoFipeSelecionado` ao invés de `'carros'` hardcoded.
- No auto-buscar FIPE (linha 463): usar `tipoFipeSelecionado` ao invés de `tipoVeiculoDetectado`.

**2. Atualizar tipagem do state `marcas`**

- De `useState<FipeMarca[]>` para `useState<FipeMarcaComTipo[]>`.

### Resultado
- Selecionar "HONDA" (motos) carrega modelos de motos (CG 160, Bros, etc.)
- Selecionar "HONDA" (carros) carrega modelos de carros (Civic, Fit, etc.)
- Anos e preços usam o tipo correto
- Sem erro na busca

