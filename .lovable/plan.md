## Problema

O indicador de versão compara dois valores que **não nascem da mesma fonte**:

- **`__BUILD_ID__`** (embutido no bundle) é calculado em `vite.config.ts` a cada build, com fallback em cascata: `process.env.BUILD_ID` → `VERCEL_GIT_COMMIT_SHA` → `COMMIT_REF` → `git rev-parse` → **data atual `YYYYMMDDHHMM`**.
- **`/version.json`** é gravado pelo plugin `writeVersionJson` em `buildStart`, e o arquivo `public/version.json` está **commitado no Git** (atualmente `e06fd39`, de um commit antigo).

Resultado prático nos screenshots:
- Bundle que o usuário recebeu: `2026051` (fallback de data — `git` não estava disponível no momento daquele build).
- `version.json` servido: `e06fd39` (versão antiga, congelada no repositório).
- `useBuildVersion` deveria marcar como "stale" (âmbar), mas em alguns casos `latest` ainda não chegou (fica `null`) e mostra verde — falsa impressão de "atualizado".

Além disso, em **dev/preview do Lovable** o Vite serve `public/version.json` direto do disco, sem rodar `buildStart`, então o arquivo nunca é atualizado — qualquer comparação fica permanentemente desalinhada.

## Plano (apenas frontend / build)

### 1. Tornar `BUILD_ID` determinístico e consistente entre bundle e `version.json`

Em `vite.config.ts`:

- Remover o fallback por `new Date()`, que gera IDs diferentes a cada execução e cria a impressão de "versão nova" sem mudança real de código.
- Nova cascata: `process.env.BUILD_ID` → `VERCEL_GIT_COMMIT_SHA` → `COMMIT_REF` → `git rev-parse --short=7 HEAD` → `"dev"` (constante, não data).
- Garantir que **o mesmo valor** seja injetado em `__BUILD_ID__` e gravado em `version.json` (já é, mas reforçar com um único `const BUILD_ID` exportado do escopo do `defineConfig`).

### 2. Servir `/version.json` dinamicamente em dev e preview

Adicionar dois hooks no plugin `writeVersionJson`:

- `configureServer(server)` → middleware que responde `GET /version.json` com `{ buildId: BUILD_ID, builtAt: <agora> }` e header `Cache-Control: no-store`.
- `configurePreviewServer(server)` → mesmo middleware para `vite preview`.

Assim, no preview do Lovable o `version.json` reflete o `BUILD_ID` real do processo em execução, não o arquivo congelado em disco.

### 3. Parar de versionar `public/version.json`

- Apagar `public/version.json` do repositório (será sempre gerado pelo plugin).
- Adicionar `public/version.json` ao `.gitignore`.

Com isso elimina-se a fonte de "fantasma" (`e06fd39` ficar pendurado para sempre porque foi commitado).

### 4. Corrigir o estado inicial do indicador

Em `src/hooks/useBuildVersion.ts`:

- Manter `isStale = !!latest && latest !== CURRENT` (correto).
- Em `src/components/layout/BuildVersionIndicator.tsx`: enquanto `latest === null` (ainda carregando), renderizar o ponto em **cinza** (`bg-muted-foreground/40`) em vez de verde, para não dar falsa sensação de "atualizado" antes da resposta de `/version.json`.

### 5. Verificação

- Recarregar a página em preview e em produção: o ponto deve aparecer cinza por um instante e em seguida verde com o **mesmo** hash exibido no rodapé do dropdown.
- Confirmar que o hash exibido casa com `curl https://app.praticcar.org/version.json`.
- Confirmar que, ao publicar uma nova versão, os usuários ainda na build anterior vêem o ponto âmbar com o botão "atualizar".

## Arquivos afetados

- `vite.config.ts` — cascata de `BUILD_ID` + hooks `configureServer`/`configurePreviewServer` no plugin.
- `src/hooks/useBuildVersion.ts` — sem mudança de lógica (só comentário/garantias).
- `src/components/layout/BuildVersionIndicator.tsx` — estado de carregamento cinza.
- `.gitignore` — adicionar `public/version.json`.
- `public/version.json` — remover do repositório.

## Fora do escopo

- Backend, edge functions, banco de dados.
- Mudança no fluxo de deploy/publish do Lovable (não temos acesso ao pipeline).
- Notificação push de nova versão (continua sendo o polling de 5 min já existente).
