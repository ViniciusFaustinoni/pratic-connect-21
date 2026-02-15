
# Dashboard de SLA de Sinistros

## Objetivo

Criar uma nova pagina dedicada ao acompanhamento de SLA (Service Level Agreement) de cada sinistro, mostrando em qual etapa esta, ha quantos dias permanece nela, e destacando alertas visuais para prazos vencidos ou proximos do vencimento.

## Dados disponíveis

- Tabela `sinistro_historico` registra cada mudanca de status com `status_anterior`, `status_novo` e `created_at` -- permite calcular tempo exato em cada fase
- Tabela `sinistros` tem `status`, `created_at`, `updated_at`, `tipo`, `protocolo`, associado e veiculo
- Constantes `PRAZOS_SINISTRO` ja definem SLAs padrao por fase (ex: documentos 30 dias, sindicancia 30 dias, oficina 90 dias)
- Labels e cores de status ja existem em `STATUS_SINISTRO_LABELS` e `STATUS_SINISTRO_COLORS`

## Arquitetura

A pagina sera acessada via `/eventos/sla` e tera 4 secoes:

### Secao 1 -- KPIs de SLA
4 cards resumo:
- **Dentro do SLA**: sinistros com tempo na etapa atual dentro do prazo
- **Proximo do Vencimento**: entre 80-100% do prazo consumido
- **SLA Estourado**: acima do prazo
- **Tempo Medio na Etapa**: media de dias dos sinistros abertos na etapa atual

### Secao 2 -- Tabela Principal
Tabela com todos os sinistros abertos, mostrando:
- Protocolo (link para detalhe)
- Associado / Placa
- Tipo
- Status atual (badge colorido)
- Dias na etapa atual (calculado via `updated_at` ou ultimo registro em `sinistro_historico`)
- SLA da etapa (prazo padrao)
- Barra de progresso visual (verde/amarelo/vermelho)
- Indicador de urgencia (icone de alerta quando estourado)

Filtros: por status, por tipo, apenas vencidos, busca por protocolo/placa.
Ordenacao padrao: mais criticos primeiro (maior % do SLA consumido).

### Secao 3 -- Grafico de Distribuicao
Grafico de barras horizontais agrupado por fase, mostrando quantos sinistros estao dentro, proximo e fora do SLA em cada fase.

### Secao 4 -- Historico de Transicoes (expansivel)
Ao clicar em um sinistro na tabela, expande e mostra o historico de transicoes de status com tempo gasto em cada fase.

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useEventosSLA.ts` | Hook com queries: buscar sinistros abertos com status/updated_at, calcular dias na etapa, mapear SLA por status, retornar KPIs e lista |
| `src/pages/eventos/EventosSLADashboard.tsx` | Pagina principal com filtros + 4 secoes |
| `src/components/eventos/sla/SLAKpiCards.tsx` | 4 cards resumo |
| `src/components/eventos/sla/SLATabelaSinistros.tsx` | Tabela principal com barra de progresso |
| `src/components/eventos/sla/SLADistribuicaoChart.tsx` | Grafico de barras por fase |
| `src/components/eventos/sla/SLAHistoricoTransicoes.tsx` | Painel expansivel com timeline de transicoes |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Adicionar rota `/eventos/sla` |
| `src/components/layout/AppSidebar.tsx` | Adicionar item "SLA" no menu Eventos |
| `src/components/layout/GlobalBreadcrumb.tsx` | Adicionar breadcrumb para `/eventos/sla` |

## Detalhes Tecnicos

### Mapeamento de SLA por status

Usar `PRAZOS_SINISTRO` como base e criar um mapa adicional:

```typescript
const SLA_POR_STATUS: Record<string, number> = {
  comunicado: 3,              // deve ser triado em 3 dias
  documentacao_pendente: 30,   // associado tem 30 dias
  aguardando_vistoria: 7,     // agendar em 7 dias
  em_vistoria: 5,             // concluir vistoria em 5 dias
  aguardando_parecer: 5,      // parecer em 5 dias
  em_analise: 7,              // analise em 7 dias
  aguardando_analise: 3,      // triagem em 3 dias
  em_sindicancia: 30,         // sindicancia 30 dias
  aprovado: 5,                // encaminhar em 5 dias
  aguardando_cota: 30,        // cota em 30 dias
  aguardando_termo: 30,       // termo em 30 dias
  em_reparo: 90,              // oficina 90 dias
  em_recuperacao: 30,         // recuperacao 30 dias
};
```

### Calculo de dias na etapa

Usar `updated_at` do sinistro como proxy (atualizado a cada mudanca de status). Para precisao extra, buscar o ultimo registro de `sinistro_historico` para o sinistro.

```typescript
const diasNaEtapa = differenceInDays(new Date(), new Date(sinistro.updated_at));
const slaDaEtapa = SLA_POR_STATUS[sinistro.status] || 30;
const percentual = (diasNaEtapa / slaDaEtapa) * 100;
```

### Classificacao visual
- Verde: percentual <= 60%
- Amarelo: percentual > 60% e <= 100%
- Vermelho: percentual > 100%

### Query principal
Buscar sinistros com status NOT IN ('encerrado', 'cancelado', 'pago', 'negado', 'indenizado') com select de associado e veiculo para exibicao na tabela.
