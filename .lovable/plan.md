

# Mover Mapa de Atendimento de Gestao Comercial para Monitoramento

## Contexto

O "Mapa de Atendimento" (classificacao de municipios como Volante/Viagem/Prestador/Fora de Cobertura) esta em Gestao Comercial, mas e uma funcionalidade operacional — nao tem relacao com as "regioes" comerciais que sao criadas livremente pelo diretor para elegibilidade de planos.

Ja existe uma pagina `src/pages/monitoramento/RegioesAtendimento.tsx` que lida com vinculos de vistoriadores a cidades. O Mapa de Atendimento deve ser integrado ao modulo de Monitoramento.

## Plano

### 1. Remover "Mapa de Atendimento" da Gestao Comercial

- **TabNavigation.tsx**: Remover o item `Mapa de Atendimento` do grupo "Operacao"
- **GestaoComercial.tsx**: Remover import de `MapaAtendimento`, remover `activeTab === 7`, reindexar tabs 8 e 9 para 7 e 8, atualizar `sectionBanners`

### 2. Criar rota dedicada no Monitoramento

- Adicionar rota `/monitoramento/mapa-atendimento` no router
- Criar pagina wrapper que renderiza o componente `MapaAtendimento` com hierarquia por estado (agrupar municipios por UF com secoes colapsaveis)
- Adicionar link de acesso rapido no `DashboardCoordenador.tsx`

### 3. Reorganizar MapaAtendimento com hierarquia por UF

- Mover `src/components/gestao-comercial/MapaAtendimento.tsx` para `src/pages/monitoramento/MapaAtendimentoPage.tsx` (ou reutilizar)
- Agrupar municipios por estado (UF) em secoes colapsaveis com Collapsible
- Manter funcionalidade existente (filtro por tipo, busca, adicionar, alterar tipo)

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/gestao-comercial/TabNavigation.tsx` | Remover item Mapa de Atendimento |
| `src/pages/diretoria/GestaoComercial.tsx` | Remover tab 7, reindexar |
| `src/pages/monitoramento/MapaAtendimentoPage.tsx` | Novo — pagina com hierarquia por UF |
| `src/App.tsx` (router) | Adicionar rota `/monitoramento/mapa-atendimento` |
| `src/pages/monitoramento/DashboardCoordenador.tsx` | Adicionar link de acesso rapido |

