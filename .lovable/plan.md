

# Corrigir Ranking e Rota da Equipe Comercial

## Problemas Identificados

### 1. Rota incorreta
A sidebar (`AppSidebar.tsx` linha 165) aponta para `/vendas/propostas` com o titulo "Consultores". A pagina mostra "Equipe Comercial" mas a rota diz "propostas". Precisa renomear para `/vendas/equipe-comercial`.

### 2. Ranking hardcoded (PROBLEMA PRINCIPAL)
No `usePropostasMetricas.ts` (linhas 228-241), existe uma lista **hardcoded** de nomes de consultores "prioritarios" que forca a ordenacao independentemente do desempenho real:

```typescript
const consultoresPrioritarios = [
  'KALAYANE SHASNAM MURADO',
  'JEICIELI DOS SANTOS LIMA',
  // ... 10 nomes fixos
];
```

Isso significa que o ranking nunca reflete a performance real -- o #1 sera sempre KALAYANE, o #2 sempre JEICIELI, etc.

### 3. Ordenacao conflitante
O hook ordena pela lista hardcoded, mas depois `Propostas.tsx` (linha 73) re-ordena por `valorFechado`. Como todos tem R$0,00, a ordem final e arbitraria e os badges de #1/#2/#3 nao significam nada.

## Correcoes

### Arquivo 1: `src/hooks/usePropostasMetricas.ts`
- **Remover** a lista `consultoresPrioritarios` (linhas 227-241)
- **Substituir** a ordenacao por ranking real baseado em metricas: `propostasFechadas` (primario) > `valorFechado` (secundario) > `emCotacao + contratoEnviado` (terciario)
- O campo `ranking` sera atribuido apos a ordenacao real

### Arquivo 2: `src/pages/vendas/Propostas.tsx`
- **Remover** o re-sort por `valorFechado` (linha 73) pois o hook ja retornara a ordem correta
- Manter a posicao do ranking baseada na ordem do hook (nao na posicao da pagina)
- Passar `consultor.ranking` ao componente `ConsultorCardNew` em vez de `(page - 1) * PAGE_SIZE + index + 1`

### Arquivo 3: `src/components/layout/AppSidebar.tsx`
- Alterar a URL de `/vendas/propostas` para `/vendas/equipe-comercial`

### Arquivo 4: `src/App.tsx`
- Alterar a rota de `/vendas/propostas` para `/vendas/equipe-comercial`
- Adicionar redirect de `/vendas/propostas` para `/vendas/equipe-comercial` (compatibilidade)

### Arquivo 5: `src/hooks/useModuleItemVisibility.ts`
- Atualizar o mapeamento de rota de `/vendas/propostas` para `/vendas/equipe-comercial`

### Arquivo 6: `src/pages/vendas/Consultores.tsx`
- Atualizar o botao de voltar de `/vendas/propostas` para `/vendas/equipe-comercial`

## Resultado
- Ranking baseado em desempenho real (vendas fechadas, valor, atividade)
- Rota correta: `/vendas/equipe-comercial`
- Medalhas #1/#2/#3 refletem os melhores consultores do periodo

