# Consolidar tipos de status de cotação

## Situação real no código (verificada)

- `src/types/database.ts:93` — fonte canônica do banco: `StatusCotacao = 'rascunho' | 'enviada' | 'aceita' | 'recusada' | 'expirada'`.
- `src/types/vendas.ts` — reexporta `StatusCotacao` e define `STATUS_COTACAO_LABELS`/`STATUS_COTACAO_COLORS` (5 estados, OK).
- `src/components/cotacoes/CotacoesTable.tsx:27` — `export type StatusCotacaoExtended = StatusCotacao | 'visualizada'` + `statusConfig` local.
- `src/components/cotacoes/CotacaoCard.tsx:21` — **redefine** `StatusCotacaoExtended` e **duplica** `statusConfig` (cópia divergente em potencial).
- `src/components/cotacoes/CotacoesMobileList.tsx` — importa `StatusCotacaoExtended` e `statusConfig` de `CotacoesTable` (acoplamento ruim: tipo morando dentro de um componente).
- `src/types/cotacaoPublica.ts > StatusCotacaoPublica` — tipo **legítimo e separado** (14 estados da jornada pública); fica fora do escopo.

Obs.: o item "types/cotacao.ts > StatusCotacaoExtended" citado no relato não existe; o tipo extended só vive nos 2 componentes.

## Objetivo

Uma única fonte de verdade para o status base e para o status estendido com `visualizada`, e um único `statusConfig` reutilizado.

## Mudanças

### 1. `src/types/database.ts`
- Manter `StatusCotacao` como está.
- Adicionar:
  ```ts
  /** Status base + 'visualizada' (derivado em runtime quando o link público é aberto). */
  export type StatusCotacaoExtended = StatusCotacao | 'visualizada';
  ```

### 2. Novo arquivo `src/components/cotacoes/statusConfig.ts`
- Move o `statusConfig` (mapa `StatusCotacaoExtended → { label, color, icon, ... }`) que hoje vive em `CotacoesTable.tsx` para um módulo próprio.
- Exporta `statusConfig` e reexporta o tipo via `export type { StatusCotacaoExtended } from '@/types/database'` para conveniência.

### 3. `src/components/cotacoes/CotacoesTable.tsx`
- Remover `export type StatusCotacaoExtended` e o `statusConfig` local.
- Importar ambos de `./statusConfig`.
- Manter o `export type { StatusCotacaoExtended }` reexportado (compat) — ou atualizar os imports dependentes.

### 4. `src/components/cotacoes/CotacaoCard.tsx`
- Remover a redefinição local de `StatusCotacaoExtended` e a duplicata de `statusConfig`.
- Importar ambos de `./statusConfig`.

### 5. `src/components/cotacoes/CotacoesMobileList.tsx`
- Trocar o import de `./CotacoesTable` por `./statusConfig`.

### 6. Verificação
- `rg "StatusCotacaoExtended|statusConfig" src/components/cotacoes` deve mostrar só imports do novo módulo.
- Build TS deve passar sem mudança de comportamento (mesmas chaves, mesmos valores).

## Fora de escopo
- `StatusCotacaoPublica` (jornada pública, conjunto de estados próprio e legítimo).
- Qualquer mudança visual nos badges ou nas labels.
