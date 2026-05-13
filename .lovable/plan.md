## Objetivo

Adicionar uma forma **discreta** no dropdown do avatar (header) para sabermos se todos os usuários estão rodando a mesma versão do app — sem expor um número de versão visível como destaque.

## Como vai funcionar

No rodapé do `DropdownMenuContent` em `src/components/layout/AppHeader.tsx` (e mesma coisa no app do associado em `src/components/app/AppUserDropdown.tsx`), adicionar uma linha pequena com:

- Um **hash curto de build** (6 caracteres, ex.: `b3a91f`) em texto `text-[10px] text-muted-foreground` alinhado ao centro/direita.
- Um pequeno ponto colorido ao lado:
  - **verde** = versão do usuário coincide com a versão atualmente publicada
  - **âmbar** = usuário está em versão antiga (precisa dar reload)
- Tooltip ao passar o mouse: "Versão do app: b3a91f · atualizada" (ou "desatualizada — recarregue a página").
- Clique no hash copia para o clipboard (utilidade para suporte comparar entre usuários).

Assim, qualquer pessoa pode comparar rapidamente o hash entre dois usuários, ou olhar a cor do ponto para confirmar que todos estão na mesma build.

## Detalhes técnicos

1. **Hash de build (injetado no Vite)**
   - Em `vite.config.ts`, expor via `define`:
     ```ts
     define: {
       __BUILD_ID__: JSON.stringify(
         process.env.BUILD_ID ||
         new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,12)
       ),
     }
     ```
   - Tipar em `src/vite-env.d.ts`: `declare const __BUILD_ID__: string;`
   - Cada build gera um id único; em dev usa timestamp do start.

2. **Endpoint estático para "versão atual publicada"**
   - Gerar `public/version.json` no build com o mesmo `__BUILD_ID__`.
   - Pode ser via um pequeno plugin Vite ou um script `prebuild`. Conteúdo: `{ "buildId": "..." }`.
   - Servido em `/version.json` (sem cache via `<meta>` fetch com `cache: 'no-store'`).

3. **Hook `useBuildVersion`**
   - Retorna `{ current: __BUILD_ID__, latest, isStale }`.
   - Faz `fetch('/version.json', { cache: 'no-store' })` ao montar e a cada 5 min (e no `visibilitychange`).
   - `isStale = latest && latest !== current`.

4. **UI no dropdown** (`AppHeader.tsx` e `AppUserDropdown.tsx`)
   - Após o último `DropdownMenuSeparator`, adicionar:
     ```tsx
     <div className="px-2 py-1 flex items-center justify-center gap-1.5">
       <span className={cn("h-1.5 w-1.5 rounded-full",
         isStale ? "bg-amber-500" : "bg-emerald-500")} />
       <button onClick={copy} title={isStale ? "Versão antiga — recarregue" : "Atualizada"}
         className="text-[10px] text-muted-foreground font-mono hover:text-foreground">
         {current.slice(0,6)}
       </button>
     </div>
     ```
   - Tooltip via `title=` (sem peso visual extra).

## Arquivos a alterar/criar

- `vite.config.ts` — definir `__BUILD_ID__` e plugin que escreve `public/version.json` no build.
- `src/vite-env.d.ts` — declarar `__BUILD_ID__`.
- `src/hooks/useBuildVersion.ts` — novo hook.
- `src/components/layout/AppHeader.tsx` — rodapé do dropdown.
- `src/components/app/AppUserDropdown.tsx` — mesmo rodapé no app do associado.

## Não-objetivos

- Não exibir número/semver completo no header.
- Não forçar reload automático (apenas indicar via cor).
- Não impactar telas mobile/responsividade já existentes.
