

# Unificar Agendamento de Vistoria de Sinistro com Padrão Manhã/Tarde

## Problema

O agendamento de vistoria de sinistro (`EventoAgendamento.tsx`) usa slots de 30 minutos (08:00–17:00), enquanto todo o resto do sistema usa períodos Manhã/Tarde com controle de vagas e opção de encaixe. Isso é inconsistente e precisa ser unificado.

## Solução

Refatorar o frontend `EventoAgendamento.tsx` e o backend `agendar-vistoria-evento/index.ts` para usar o padrão de períodos (manhã/tarde) com controle de vagas e permissão de encaixe, igual ao `AgendamentoVistoria.tsx`.

## Arquivos Alterados

| Arquivo | Ação |
|---------|------|
| `src/components/evento/EventoAgendamento.tsx` | Substituir slots por períodos manhã/tarde, adicionar switch de encaixe, mostrar vagas |
| `supabase/functions/agendar-vistoria-evento/index.ts` | Substituir lógica de slots por períodos, adicionar controle de vagas e encaixe |

## Detalhes

### Frontend (`EventoAgendamento.tsx`)

- Remover busca de slots via edge function (`action: 'horarios'`)
- Substituir grade de horários por 2 cards: Manhã (08:00–12:00) e Tarde (14:00–18:00), usando o mesmo visual do `AgendamentoVistoria.tsx` (ícones Sun/Sunset, indicador de vagas)
- Usar `useVagasPeriodo` para consultar vagas disponíveis na data selecionada (adaptado para `vistorias_evento` ao invés de `servicos`)
- Adicionar Switch "Permitir encaixe" com descrição explicativa
- Limitar datas a 3 próximos dias úteis (em vez de 15), usando botões de data como no `AgendamentoVistoria`
- Enviar `periodo` (manhã/tarde) ao invés de `horario_agendado` no formato HH:MM
- Respeitar: sábado = só manhã, domingo = indisponível

### Backend (`agendar-vistoria-evento/index.ts`)

- Remover action `horarios` (slots) — não será mais necessário
- Alterar validação: aceitar `periodo` (manhã/tarde) ao invés de `horario_agendado` no formato HH:MM
- Controlar vagas: contar vistorias_evento agendadas para a data+período, limitar a 10 por período
- Salvar `horario_agendado` como o período (ex: "manha" ou "tarde") ou null, e adicionar campo `periodo` se disponível na tabela
- Salvar `permite_encaixe` (já existe no insert, mas não era enviado pelo frontend antigo)

### Hook de Vagas

- Criar `useVagasPeriodoEvento` (ou adaptar `useVagasPeriodo`) para contar vagas de `vistorias_evento` por período, já que o hook atual conta apenas `servicos` com `local_vistoria = 'cliente'`

