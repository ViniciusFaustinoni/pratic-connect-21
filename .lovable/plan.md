
# Exibir botao de analise para eventos aguardando analise

## Problema

Quando o regulador conclui a vistoria, o status do sinistro muda para `aguardando_analise`. Porem, na listagem de sinistros (`SinistrosList.tsx`):

1. O status `aguardando_analise` nao esta no mapa de configuracao de status, entao o badge exibe "Comunicado" (fallback) em vez de "Aguard. Analise"
2. O botao de "Analisar" (icone ClipboardCheck) so aparece para status `comunicado` ou `em_analise`, ignorando `aguardando_analise`
3. Os contadores (KPI cards) nao contam sinistros com status `aguardando_analise`

## Alteracoes

### Arquivo: `src/pages/eventos/SinistrosList.tsx`

**1. Adicionar `aguardando_analise` ao `statusConfig` (linha ~68)**

Incluir a entrada:
```
aguardando_analise: { label: 'Aguard. Analise', class: 'bg-blue-100 text-blue-800' },
```

**2. Expandir condicao do botao "Analisar" (linha ~445)**

Alterar de:
```typescript
sinistro.status === 'comunicado' || sinistro.status === 'em_analise'
```
Para:
```typescript
sinistro.status === 'comunicado' || sinistro.status === 'em_analise' || sinistro.status === 'aguardando_analise'
```

**3. Adicionar contador de `aguardando_analise` nos KPI cards (linha ~130-143)**

Incluir contagem de `aguardando_analise` no objeto de contadores e somar ao card "Em Analise" (ja que sao sinistros prontos para analise do analista).

### Resultado esperado

- O analista de eventos vera o badge correto "Aguard. Analise" para sinistros onde o regulador ja concluiu a vistoria
- O botao de "Analisar" aparecera para esses sinistros, levando a pagina `/eventos/sinistros/:id/analisar` com todas as informacoes e arquivos do regulador
- O icone de visualizacao (olho) continuara funcionando normalmente, mostrando os mesmos dados mas sem acoes de aprovar/reprovar (pagina `SinistroDetalhe`)
