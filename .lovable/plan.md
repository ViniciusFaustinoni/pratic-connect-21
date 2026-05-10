## Objetivo

Remover o botão "Sincronizar com SGA" do `TrocaTitularidadeDialog` e fazer a sincronização automaticamente quando o modal abre.

## Alteração — `src/components/associados/TrocaTitularidadeDialog.tsx`

1. **Auto-sync ao abrir**: adicionar um `useEffect` que dispara `handleSincronizarHinova()` automaticamente quando:
   - `open === true`
   - `cpfAntigo` válido (11 dígitos)
   - e ocorrer um dos gatilhos: `semCodigoHinova` (associado sem `codigo_hinova`) **ou** `semEspelhoLocal` (SGA tem veículos mas espelho local não existe)
   - guard com `useRef` para rodar 1× por abertura (evita loop), resetado quando `open` vira `false`.

2. **UI dos alerts** (linhas 219–266): substituir os dois botões "Sincronizar com SGA" por um indicador de carregamento ("Sincronizando com o SGA…" com `Loader2`) enquanto `sincronizando === true`. Em caso de falha (`syncErro`), mostrar a mensagem de erro + botão discreto "Tentar novamente" (mesmo handler) — necessário porque sem fallback manual o usuário fica preso se a primeira tentativa falhar.

3. **Manter** `handleSincronizarHinova` intacto (lógica de invoke + refetch). Apenas trocar o gatilho de clique por automático.

4. **Sem mudanças** no edge function `importar-associado-sga`, no schema, ou em outros pontos do fluxo.

## Detalhe técnico

```text
useEffect(() => {
  if (!open) { autoSyncRanRef.current = false; return; }
  if (autoSyncRanRef.current) return;
  if (sincronizando || carregando) return;
  if (!cpfAntigo || cpfAntigo.length !== 11) return;
  if (semCodigoHinova || semEspelhoLocal) {
    autoSyncRanRef.current = true;
    handleSincronizarHinova();
  }
}, [open, cpfAntigo, semCodigoHinova, semEspelhoLocal, carregando, sincronizando]);
```

O botão de "Tentar novamente" no estado de erro NÃO marca `autoSyncRanRef` — chama o handler diretamente para permitir nova tentativa manual sem reabrir o modal.
