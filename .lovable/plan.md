
## Objetivo

Dar ao consultor uma visão visual e dedicada para acompanhar processos que **não são cotação nova**: troca de titularidade, substituição de placa, inclusão de veículo e migração. Hoje essas solicitações já existem em `cotacoes` (com `dados_extras.tipo_entrada`), mas ficam misturadas e com sinalização fraca na aba principal.

---

## O que será feito

### 1. Nova aba "Outros Processos" ao lado de "Cotações"

Em `src/pages/vendas/Cotacoes.tsx`, envolver a listagem em um `Tabs` com duas abas:

- **Cotações** (default) — comportamento atual, mas filtrando OUT registros cujo `dados_extras.tipo_entrada` esteja em `['troca_titularidade','substituicao_placa','inclusao_veiculo','migracao']`. Cotação nova continua exatamente como está.
- **Outros Processos** — nova visão com tabela própria adaptada por tipo.

Contagem de cada aba aparece em badge no `TabsTrigger` (ex: "Outros Processos · 12"), usando o mesmo padrão de `useCotacoesFunilCounts`.

### 2. Hook `useOutrosProcessos`

Novo hook em `src/hooks/useOutrosProcessos.ts` que faz **uma query unificada** retornando registros normalizados:

```text
{
  id, tipo: 'troca'|'substituicao'|'inclusao'|'migracao',
  cotacao_id, criado_em, vendedor,
  titular_origem: { nome, cpf },
  titular_destino: { nome, cpf } | null,   // só troca
  veiculo: { placa, marca, modelo },
  etapa_atual: string,                      // legível: "Termo pendente", "Aguardando cadastro"...
  status_termo: 'nao_aplicavel'|'pendente'|'enviado'|'assinado'|'recusado',
  status_assinatura_contrato: ...,           // quando aplicável
  pendencia_financeira?: { qtd, total },
  acao_disponivel: string                    // CTA contextual
}
```

Fontes:
- **Troca** → `solicitacoes_troca_titularidade` + `cotacoes` + `relacionamento_debitos_pendentes` (já consumidos por `useSolicitacoesTroca` e `TrocaTitularidadeBadge`).
- **Substituição** / **Inclusão** / **Migração** → `cotacoes` filtradas por `dados_extras.tipo_entrada` + join com `contratos`/`veiculos` para resolver etapa.

Reaproveita o motor de status do `TrocaTitularidadeBadge` (mapa `STATUS_LABELS`) e expande para os outros tipos.

### 3. Componente `OutrosProcessosTable`

Novo componente `src/components/cotacoes/OutrosProcessosTable.tsx` (irmão de `CotacoesTable.tsx`), com colunas dedicadas:

- Tipo (chip colorido por tipo: troca = âmbar, substituição = azul, inclusão = verde, migração = roxo)
- Origem → Destino (ex: "João Silva → Maria Souza" para troca; "ABC1D23 → DEF4G56" para substituição)
- Veículo
- Vendedor (sem truncamento — segue correção já aplicada no `CotacoesTable`)
- Etapa atual (badge igual ao `TrocaTitularidadeBadge`, expandido)
- Termo / Assinatura (ícone de status)
- Última atualização
- Ações (Ver detalhes, Reenviar termo, Abrir cotação relacionada, Cancelar)

Versão mobile em `OutrosProcessosMobileList.tsx` (mesmo padrão de `CotacoesMobileList`).

### 4. Filtros locais da aba

Linha de filtros acima da tabela:
- **Tipo**: Todos / Troca / Substituição / Inclusão / Migração
- **Etapa**: Em andamento / Aguardando cliente / Aguardando interno / Concluídos / Reprovados
- **Vendedor** (respeitando regra `funil-cotacao-vendor-scoping` — vendedor não-gestor só vê os próprios)
- **Busca**: nome, CPF, placa

### 5. Drawer de detalhe unificado

`OutrosProcessosDetailDrawer.tsx` reutilizando `TelaAnaliseTrocaTitularidade` para troca; para os demais tipos abre o `CotacaoDetalhesModal` existente. Sem reescrever telas — só roteia.

### 6. Limpeza visual da aba "Cotações" original

- Como trocas saem da listagem principal, o `TrocaTitularidadeBadge` deixa de aparecer ali (continua usado dentro da nova aba).
- Mantém o filtro server-side; a contagem do funil já existente passa a refletir só cotações novas.

---

## Detalhes técnicos

- **Sem migração de schema**. Tudo é leitura sobre tabelas existentes.
- `useCotacoes`/`useCotacoesPaginadas` ganham um parâmetro opcional `excluirTiposEntrada?: string[]` para filtrar `dados_extras->>tipo_entrada NOT IN (...)`. A aba "Cotações" passa a lista padrão; a aba "Outros Processos" usa o novo hook.
- O hook novo agrega por `cotacao_id` para evitar duplicação quando uma troca tem cotação espelho.
- Permissões: respeita `usePermissions` (`vendas.cotacoes.view`) — não introduz nova permissão.
- Realtime: assina canais de `cotacoes` e `solicitacoes_troca_titularidade` (já há padrão em `useCotacoesRealtime`).
- Performance: query única paginada (limit 50, infinite scroll opcional), `staleTime` 30s.

---

## Fluxo final do consultor (depois)

```text
/vendas/cotacoes
 ├── [Cotações]            → só cotações novas, limpas
 └── [Outros Processos N]  → trocas, substituições, inclusões, migrações
       └─ linha clicável → drawer com etapa, status do termo, ações
```

Exemplo da linha de uma troca em curso:

```text
[Troca]  João Silva → Maria Souza   ABC1D23 Civic 2020   Ana (vendedora)
        ▸ Termo enviado · aguardando assinatura do antigo titular
        ▸ Pendência R$ 380 (2 boletos)                 [Ver]  [Reenviar termo]
```

---

## Não está no escopo

- Cancelamento e Eventos em andamento (você pediu só troca/substituição/inclusão/migração).
- Mudanças no fluxo de criação/aprovação dos processos — só visualização e acompanhamento.
- Alteração nos hooks/edge functions de troca já existentes.
