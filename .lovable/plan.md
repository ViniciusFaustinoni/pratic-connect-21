

## Persistência de rascunho no Cotador (antes de criar a cotação)

### Resposta curta
Sim, é totalmente viável e **sem sobrecarregar o sistema** — a solução é 100% client-side usando `localStorage`, sem qualquer chamada extra ao banco ou edge function. Salva localmente enquanto o consultor digita; quando a cotação é efetivamente criada, o rascunho é descartado.

### Como vai funcionar (UX)

1. Consultor entra no cotador e começa a preencher (placa, FIPE, dados do associado, plano escolhido, etc.).
2. A cada alteração relevante, o estado do formulário é salvo automaticamente no navegador (debounce de ~800ms para não escrever a cada tecla).
3. Se o consultor:
   - Trocar de aba/página, fechar o navegador, ou recarregar → ao voltar para o cotador, aparece um banner discreto no topo:
     > "Encontramos um rascunho não finalizado de **{HH:mm} de hoje}**. Deseja continuar de onde parou?"  
     **[ Continuar rascunho ]   [ Descartar e começar do zero ]**
   - Clicar em "Continuar" → o formulário é re-hidratado em todas as etapas já preenchidas, inclusive a etapa atual do stepper.
   - Clicar em "Descartar" → rascunho é apagado.
4. Quando a cotação é **efetivamente criada** (POST bem-sucedido) → rascunho é apagado automaticamente.
5. Rascunhos expiram sozinhos após **24h** (limpeza preguiçosa na próxima abertura do cotador).

### Escopo e segurança

- **Por usuário e por dispositivo**: a chave do `localStorage` inclui o `user.id` logado, então rascunhos de um consultor não vazam para outro que use o mesmo navegador.
- **Sem dados sensíveis bloqueantes**: armazenamos apenas o que o consultor digitou (placa, FIPE, plano, telefone, etc.) — nenhum token, senha ou dado do Autentique.
- **Limite de tamanho**: rascunho típico < 5KB, muito abaixo do limite de 5MB do `localStorage`.
- **Compatível com fluxos especiais**: vale para cotação normal, substituição, inclusão de veículo e externa (cada tipo com sua própria chave).

### Por que não sobrecarrega

- ✅ Zero chamadas ao Supabase, zero edge functions, zero registros em tabela.
- ✅ Debounce evita escrita excessiva mesmo durante digitação rápida.
- ✅ Limpeza automática evita acúmulo eterno no navegador.
- ✅ Apenas o último rascunho por tipo de cotação é mantido (não vira histórico).

### Detalhes técnicos

**Arquivos novos**
- `src/hooks/useCotacaoDraft.ts` — hook genérico que recebe `(draftKey, currentState, setState)`, faz autosave com debounce, expõe `hasDraft`, `restoreDraft()`, `discardDraft()` e `clearOnSubmit()`.
- `src/components/cotacao/DraftRestoreBanner.tsx` — banner com os dois botões.

**Arquivos editados** (cotador principal e variantes)
- `src/pages/vendas/Cotador.tsx` (ou equivalente atual da rota `/vendas/cotacoes`) — integra o hook e o banner no topo.
- Se houver páginas separadas para inclusão / substituição / cotação externa, mesmo plug-in com `draftKey` distinto.

**Estrutura da chave no localStorage**
```
praticcar:cotador-draft:{userId}:{tipo}
  → { savedAt: ISO, version: 1, formState: {...} }
```

**Pseudocódigo do hook**
```ts
useEffect(() => {
  const t = setTimeout(() => {
    localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), version: 1, formState: state }));
  }, 800);
  return () => clearTimeout(t);
}, [state]);
```

**Limpeza**
- Após `criarCotacao` retornar sucesso → `discardDraft()`.
- Ao montar o cotador → se `Date.now() - savedAt > 24h`, descarta silenciosamente; senão, mostra banner.

### Fora do escopo (não vamos fazer agora)
- Salvar rascunho no banco/Supabase (seria a opção "multi-dispositivo", mas custaria infra e foi explicitamente pedido para não sobrecarregar).
- Histórico de múltiplos rascunhos.
- Sincronização entre abas abertas simultaneamente (se necessário, dá para adicionar via `storage` event depois).

### Validação rápida após implementação
1. Abrir cotador, preencher placa + FIPE + plano → fechar a aba → reabrir → banner aparece → restaurar → tudo volta.
2. Preencher, criar cotação com sucesso → reabrir cotador → banner **não** aparece.
3. Preencher, esperar > 24h (ou simular) → banner não aparece, rascunho some.
4. Logar com outro usuário no mesmo navegador → não vê rascunho do anterior.

