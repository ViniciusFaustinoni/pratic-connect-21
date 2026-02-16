
# Restringir Acesso do Analista de Eventos na Lista de Sinistros

## Problema

A pagina `/eventos/sinistros` (SinistrosList) mostra TODOS os sinistros para o analista de eventos, sem filtrar pelo status. O analista consegue ver e clicar em "Analisar" em eventos que ainda nao tiveram a vistoria do regulador concluida.

## Alteracoes

### Arquivo 1: `src/pages/eventos/SinistrosList.tsx`

Na query principal (linha ~126), adicionar filtro condicional: se o usuario for `isAnalistaEventos`, restringir a query para mostrar apenas sinistros com status `aguardando_analise` ou status posteriores (aprovado, negado, em_reparo, etc.). Eventos pre-vistoria ficam invisiveis para o analista.

```typescript
// Dentro da queryFn, ANTES dos filtros existentes:
if (isAnalistaEventos && !isDiretor) {
  query = query.in('status', [
    'aguardando_analise', 'aprovado', 'negado', 'reprovado',
    'em_reparo', 'em_recuperacao', 'aguardando_pagamento',
    'pago', 'encerrado', 'cancelado',
    'em_sindicancia', 'aguardando_diretoria'
  ] as any);
}
```

Na query de contadores (linha ~152), aplicar o mesmo filtro para que os cards de contagem reflitam apenas o que o analista pode ver.

Nos filtros de status do Select (dropdown), esconder os status de pre-vistoria (`comunicado`, `documentacao_pendente`, `aguardando_vistoria`, `pendente_vistoria_regulador`) quando o usuario for analista de eventos.

### Arquivo 2: `src/pages/eventos/SinistroAnalise.tsx`

Adicionar verificacao no topo: se o usuario for `isAnalistaEventos` e o sinistro nao estiver em `aguardando_analise` (ou posterior), redirecionar para `/eventos/sinistros` com uma mensagem de erro. Isso impede acesso direto via URL.

```typescript
// Apos carregar o sinistro, verificar:
const statusPreVistoria = ['comunicado', 'documentacao_pendente', 'aguardando_vistoria', 'pendente_vistoria_regulador'];
if (isAnalistaEventos && !isDiretor && statusPreVistoria.includes(sinistro?.status)) {
  navigate('/eventos/sinistros');
  toast.error('Este evento ainda nao esta disponivel para analise.');
  return;
}
```

## Resultado

- Analista de eventos so ve sinistros pos-vistoria na lista
- Analista nao consegue acessar a tela de analise de um sinistro pre-vistoria (nem via URL direta)
- Diretor continua vendo tudo normalmente
- A area de Pre-Analise (ja criada) continua sendo o ponto de acompanhamento do diretor para eventos pre-vistoria

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistrosList.tsx` | Filtrar sinistros e contadores para analista ver apenas pos-vistoria; esconder status pre-vistoria nos filtros |
| `src/pages/eventos/SinistroAnalise.tsx` | Bloquear acesso direto a sinistros pre-vistoria para o analista |
