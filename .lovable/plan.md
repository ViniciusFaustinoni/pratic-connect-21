

# Plantoes apenas nos Finais de Semana

## Resumo

Restringir o sistema de plantoes para funcionar **somente nos finais de semana** (sabado e domingo). Durante a semana, todos os profissionais estarao disponiveis automaticamente sem necessidade de alocacao.

## Alteracoes

### 1. Calendario Mensal (`PlantoesCalendario.tsx`)

- Dias de segunda a sexta aparecem com visual desabilitado (cinza, sem clique)
- Exibir label "Todos disponíveis" nos dias uteis
- Somente sabados e domingos serao clicaveis para abrir o modal de alocacao
- Resumo do mes conta apenas dias de final de semana

### 2. Modal de edicao (`PlantaoDiaModal.tsx`)

- Sem alteracao funcional — o calendario ja impede abertura em dias uteis

### 3. Validacao de ponto (`useIniciarServico.ts`)

- Na verificacao de alocacao "base", adicionar checagem do dia da semana
- Se for dia util (segunda a sexta): pular validacao de proximidade, todos trabalham normalmente
- Se for final de semana: manter a logica atual (verificar se esta alocado como "base" e validar proximidade)

### 4. Hook de alocacao diaria (`useAlocacaoDiaria.ts`)

- Se o dia atual for dia util: retornar `isRota: true` sem consultar o banco
- Se for final de semana: manter consulta normal

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/components/equipe/PlantoesCalendario.tsx` | Desabilitar clique em dias uteis, visual diferenciado |
| `src/hooks/useIniciarServico.ts` | Pular validacao de base em dias uteis |
| `src/hooks/useAlocacaoDiaria.ts` | Retornar rota automaticamente em dias uteis |

