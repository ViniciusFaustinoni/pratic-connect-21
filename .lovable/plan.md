

## Exibição Progressiva de Planos + Campo de Região — ✅ Implementado

### Alterações realizadas

1. **Removidos 5 resets desnecessários** de `setCotacaoCalculada(false)` em `Cotador.tsx` — mantido apenas no `limparTudo`
2. **Adicionado `useEffect` auto-display** — seta `cotacaoCalculada = true` quando `valorFipe > 0` e `planosDB` tem resultados
3. **Adicionado campo Região** (RJ, Lagos, SP) no formulário, antes de "Uso para aplicativo"
4. **Substituído hardcode `regiao: 'rj'`** por estado `regiao` no `parametrosPlanos`
5. **Auto-atualização de tab** — quando lista de planos muda, tab selecionada é revalidada
6. **`regiao` incluída** no payload de salvar cotação (`CriarCotacaoPayload` + `useCotacao.ts`)
7. **`regiao` resetada** no `limparTudo` para `'rj'`
