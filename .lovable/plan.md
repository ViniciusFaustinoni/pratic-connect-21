
# Dashboard do Analista de Eventos com KPIs relevantes

## Problema

O Analista de Eventos acessa `/dashboard` e ve o dashboard generico com KPIs como "Associados Ativos", "Leads do Mes", "Instalacoes/Mes", "Receita Mensal" — completamente irrelevantes para sua funcao. Ja existe um componente `AnalistaEventosHome` com KPIs corretos (Aguardando Analise, Analisados Hoje, Aprovados/Reprovados no Mes), mas ele nao esta sendo utilizado no Dashboard principal.

## Solucao

Adicionar uma verificacao no `src/pages/Dashboard.tsx` para renderizar o componente `AnalistaEventosHome` quando o usuario for `isAnalistaEventosOnly`, seguindo o mesmo padrao ja usado para `DashboardCadastro` e `DashboardCoordenador`.

## Mudancas

### Arquivo: `src/pages/Dashboard.tsx`

1. Importar `isAnalistaEventosOnly` no destructuring do `usePermissions()` (linha 293)
2. Importar o componente `AnalistaEventosHome` de `src/pages/analista-eventos/AnalistaEventosHome`
3. Adicionar bloco condicional logo apos o check de `isAnalistaCadastroOnly` (linha 312):

```
if (isAnalistaEventosOnly) {
  return <AnalistaEventosHome />;
}
```

Os KPIs exibidos serao:
- Aguardando Analise (sinistros com status `aguardando_analise`)
- Analisados Hoje (aprovados + reprovados no dia)
- Aprovados no Mes
- Reprovados no Mes

Nenhum outro arquivo precisa ser modificado.
