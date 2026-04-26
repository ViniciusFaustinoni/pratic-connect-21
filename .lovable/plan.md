# Remover página Mapa de Atendimento

## Escopo

Remover a página `/monitoramento/mapa-atendimento` (Regiões de Atuação) e os componentes que existem apenas para alimentá-la.

## Atenção — decisão importante antes de prosseguir

A tabela `municipios_atendimento` que essa página gerencia é consumida em fluxos críticos do sistema:

- `src/pages/vendas/Cotador.tsx` — bloqueia cotação para municípios "Fora de Cobertura"
- `src/pages/cadastro/AssociadoDetalhe.tsx` — exibe classificação do município do associado
- `supabase/functions/autentique-create/index.ts` — usa na geração de contrato
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts` — usa na criação automática da instalação pós-pagamento

Também há uma memória do projeto (`features/operations/geographic-intelligence-service-map-v2`) que define essa classificação como regra de negócio ativa.

**O plano abaixo remove APENAS a tela de gestão (UI editável), preservando a tabela e o consumo nas demais áreas.** Se a intenção for remover também o bloqueio de cotação por município, o uso em contratos e a criação automática de instalação, isso é um trabalho bem maior e precisa ser confirmado explicitamente — me avise.

## Mudanças

### Arquivos a deletar

- `src/pages/monitoramento/MapaAtendimentoPage.tsx`
- `src/components/gestao-comercial/MapaAtendimento.tsx` (componente legado, sem imports ativos)

### Arquivos a editar

- `src/App.tsx`
  - Remover o `lazy(() => import("./pages/monitoramento/MapaAtendimentoPage"))`
  - Remover a `<Route path="/monitoramento/mapa-atendimento" ... />`
- `src/pages/monitoramento/DashboardCoordenador.tsx`
  - Remover o item "Regiões de Atuação" do array `acoesRapidas`

### Não mexer

- Tabela `municipios_atendimento` (preservada)
- `src/pages/vendas/Cotador.tsx`, `src/pages/cadastro/AssociadoDetalhe.tsx` e as duas Edge Functions — continuam consultando a tabela normalmente
- Memória `geographic-intelligence-service-map-v2` permanece válida; apenas a edição via UI sai do ar

## Resultado esperado

- A rota `/monitoramento/mapa-atendimento` deixa de existir (404 se acessada diretamente)
- O atalho "Regiões de Atuação" some do dashboard do coordenador
- Cotações continuam sendo bloqueadas para municípios marcados como "Fora de Cobertura" (alteração de classificação só será possível via SQL/migration daqui pra frente)
