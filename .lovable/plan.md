## Problema

Na aba **Inclusões** dos Processos Operacionais:

1. O nome do **consultor** nunca aparece — o `SELECT` da query de `cotacoes` não inclui `vendedor_id`, então o hook `useConsultoresProfiles([], vendedorUserIds)` recebe sempre lista vazia.
2. Não dá para **clicar no card e ver detalhes** — o `onDetalhes` só é setado quando existe `dados_extras.associado_id`, e mesmo quando existe, ele leva para o associado, não para a cotação (que é o objeto real do card).

Resultado: cards aparecem só com ícone de "abrir link público" no canto, sem botão Detalhes e sem consultor (como no print).

## Correção

Edição cirúrgica em `src/pages/cadastro/ProcessosOperacionais.tsx`, função `InclusoesTab` — somente leitura/UI, nenhuma mutação, nenhuma alteração de fluxo, RLS, edge function ou SGA.

### 1. Incluir `vendedor_id` no SELECT

```ts
.select('id, numero, status, valor_fipe, valor_total_mensal, veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, token_publico, created_at, dados_extras, contrato_gerado_id, vendedor_id')
```

Isso já alimenta o `useConsultoresProfiles` que já existe — o bloco de `consultor` no `ProcessoCardData` passa a resolver e o card mostra "Consultor: Fulano".

### 2. Tornar o card sempre clicável → abrir a cotação

A rota canônica de detalhe da cotação é `/vendas/cotacoes/:id` (já existe em `App.tsx`).

```ts
onDetalhes: () => navigate(`/vendas/cotacoes/${c.id}`),
detalhesLabel: 'Ver cotação',
```

E mover "Ver associado" para `acoesExtras` quando houver `associado_id`:

```ts
if (c.dados_extras?.associado_id) {
  acoesExtras.push({
    icon: User,
    title: 'Ver associado',
    onClick: () => navigate(`/cadastro/associados/${c.dados_extras.associado_id}`),
  });
}
```

Assim:
- Card inteiro vira clicável (cursor-pointer + hover já existem no `ProcessoCard` quando `onDetalhes` está definido).
- Botão "Ver cotação" no canto direito.
- Ícones extras: link público (`ExternalLink`) e atalho para o associado (`User`).

## Garantias

- Nenhuma mudança em mutations, RLS, edge functions, contadores, contagens, abas, busca, ordenação ou KPIs.
- Mesmo conjunto de cotações da query atual (filtro `dados_extras->>tipo_entrada = 'inclusao'` e `scopeAuthUserId` permanecem).
- Outras 3 abas (Titularidade, Substituições, Migrações) **não são tocadas**.
- Rota `/vendas/cotacoes/:id` já existe e é a tela canônica de detalhe — não criamos rota nova.

## Arquivos

- `src/pages/cadastro/ProcessosOperacionais.tsx` — apenas a função `InclusoesTab` (≈ 15 linhas alteradas).
