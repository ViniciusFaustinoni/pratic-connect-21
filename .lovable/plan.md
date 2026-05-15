# Auto-atualizar o número de versão a cada publish

## Problema
O número exibido no rodapé do dropdown (`2026051...`) é o `BUILD_ID` definido em `vite.config.ts`. Hoje ele cai no fallback `new Date().toISOString()...` porque nem `BUILD_ID`, nem `VERCEL_GIT_COMMIT_SHA`, nem `COMMIT_REF` estão setados no pipeline do Lovable. Resultado: o número até muda a cada build, mas é um timestamp opaco — não rastreável a um commit/publish específico.

## Objetivo
Sempre que você publicar (= novo commit no repositório), o número exibido deve mudar para o **SHA curto do commit**, garantindo:
- Muda automaticamente a cada publish.
- É rastreável (você consegue achar exatamente o commit no histórico).
- Permanece estável entre múltiplas visitas do mesmo deploy (não muda a cada refresh).

## Mudanças

### 1. `vite.config.ts` — ler o SHA do git em build time
Adicionar uma tentativa de `git rev-parse --short=7 HEAD` antes do fallback de timestamp:

```ts
import { execSync } from "child_process";

const gitSha = (() => {
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
  } catch { return null; }
})();

const BUILD_ID =
  process.env.BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_REF ||
  gitSha ||
  new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 12);
```

A ordem garante: se a plataforma já injetar um SHA via env, usamos; senão, lemos do `.git`; só em último caso caímos no timestamp.

### 2. Nada mais precisa mudar
- `useBuildVersion.ts` já consome `__BUILD_ID__` e faz polling de `/version.json` a cada 5 min — o ponto âmbar "atualizar" continua funcionando para usuários em abas antigas.
- `BuildVersionIndicator.tsx` já mostra os 7 primeiros chars — formato perfeito para SHA curto.
- `writeVersionJson` plugin já grava `public/version.json` com o novo `BUILD_ID` em todo `buildStart`.

## Comportamento resultante

| Situação | Número exibido | Atualiza? |
|---|---|---|
| Você edita no preview (dev/HMR) | SHA do último commit | Não (HMR não re-roda vite.config) |
| Você clica **Publish** → novo commit | SHA novo | Sim, automaticamente |
| Usuário com aba aberta antes do deploy | SHA antigo + ponto âmbar + botão "atualizar" | Sim, detectado em ≤5 min |
| Build sem `.git` disponível | Timestamp (fallback atual) | Sim |

## Detalhes técnicos
- `execSync` com `stdio: ignore` no stderr evita poluir logs caso `.git` não exista.
- `--short=7` força 7 chars (consistente com o `.slice(0,7)` do componente).
- Não adiciona dependências; `child_process` é nativo do Node.
- Custo: ~5ms no boot do Vite, uma única vez.

## Arquivos alterados
- `vite.config.ts` (única edição: ~8 linhas)
