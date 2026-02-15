
# Corrigir label do status "aguardando_analise"

## Problema

O status `aguardando_analise` nao possui entrada no `statusConfig` da pagina de analise (`SinistroAnalise.tsx`), entao o badge exibe o texto cru "aguardando_analise" em vez de um label legivel. Alem disso, na listagem (`SinistrosList.tsx`), o label atual eh "Aguard. Analise" -- o usuario deseja que seja "Aguardando Analise Final".

## Alteracoes

### 1. `src/pages/eventos/SinistroAnalise.tsx` (linha ~83)

Adicionar entrada no `statusConfig`:

```typescript
aguardando_analise: { label: 'Aguardando Análise Final', class: 'bg-blue-100 text-blue-800 border-blue-300' },
```

### 2. `src/pages/eventos/SinistrosList.tsx` (linha ~68)

Alterar o label de `aguardando_analise` de "Aguard. Analise" para "Aguard. Análise Final":

```typescript
aguardando_analise: { label: 'Aguard. Análise Final', class: 'bg-blue-100 text-blue-800' },
```

(Na listagem usa-se a versao abreviada para caber na tabela.)

## Resultado esperado

- Na pagina de analise: badge exibe "Aguardando Analise Final" com estilo azul
- Na listagem de sinistros: badge exibe "Aguard. Analise Final"
