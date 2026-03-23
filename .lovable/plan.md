

# Plano: SLA de Prazo Visível em Todo o Sistema

## Resumo

Adicionar indicador de prazo (SLA) em cards de tarefas do instalador, lista do coordenador e painéis de configuração da Diretoria/RH, usando um componente reutilizável `SlaIndicador`.

---

## PARTE 1 — Configuração na Diretoria + DB

**DB**: Inserir 2 chaves na tabela `configuracoes`:
- `sla_horas_instalacao` = `48`
- `sla_horas_manutencao` = `24`

**`InstalacaoRotasConfig.tsx`**:
- Adicionar `sla_horas_instalacao` e `sla_horas_manutencao` ao `CONFIG_CHAVES`
- Adicionar 2 campos numéricos ao bloco "Jornada dos Vistoriadores" (ou novo bloco "Prazos de SLA")
- State vars `slaInstalacao` / `slaManutencao`, populate do DB, salvar junto com os outros

---

## PARTE 2 — Componente `SlaIndicador`

**Novo arquivo**: `src/components/ui/SlaIndicador.tsx`

Props:
- `criadoEm: string` (ISO date)
- `tipoServico: string` (instalacao, vistoria, manutencao, retirada)

Lógica interna:
- Query `configuracoes` para `sla_horas_instalacao` e `sla_horas_manutencao` (com cache longo)
- Seleciona prazo correto por tipo (manutencao/retirada = `sla_horas_manutencao`, demais = `sla_horas_instalacao`)
- Calcula `prazoFinal = criadoEm + prazoHoras`, `restante = prazoFinal - agora`
- Atualiza via `setInterval` a cada 60s
- Exibe Badge colorida:
  - Verde (>50%), Amarelo (25-50%), Vermelho (<25%), Vermelho escuro ("VENCIDO")
  - Formato: "Xh Ymin" ou "VENCIDO"

---

## PARTE 3 — App do Instalador

**`TarefaAtualCard.tsx`**: Adicionar `<SlaIndicador>` no card, após o nome do cliente, usando `tarefa.created_at` e `tarefa.tipo_servico`

**`InstaladorHome.tsx`**: O `TarefaAtualCard` já é renderizado aqui — herdará automaticamente

**`InstaladorTarefas.tsx`**: Nos cards de histórico/hoje, adicionar `<SlaIndicador>` se a tarefa não estiver concluída

---

## PARTE 4 — Painel do Coordenador

**`InstalacoesList.tsx`**:
- Adicionar coluna/badge `<SlaIndicador>` em cada linha da tabela, usando `instalacao.created_at` e tipo `instalacao`
- Adicionar botão "Atenção Urgente" na barra de filtros (toggle) que filtra client-side mostrando apenas itens com <25% de prazo ou vencidos
- O `SlaIndicador` expõe uma função utilitária `calcularPercentualSla()` para uso no filtro

---

## PARTE 5 — Painel RH

**`JornadasProfissionais.tsx`**: Adicionar 2 cards read-only no grid de parâmetros:
- "Prazo instalação/vistoria: Xh"
- "Prazo manutenção/retirada: Xh"
- Buscar `sla_horas_instalacao` e `sla_horas_manutencao` junto com as outras chaves já buscadas

---

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| DB (insert) | 2 registros: `sla_horas_instalacao`, `sla_horas_manutencao` |
| `src/components/gestao-comercial/InstalacaoRotasConfig.tsx` | 2 campos SLA + chaves no hook |
| `src/components/ui/SlaIndicador.tsx` | **Novo** — componente reutilizável |
| `src/components/vistoriador/TarefaAtualCard.tsx` | Adicionar SlaIndicador |
| `src/pages/instalador/InstaladorTarefas.tsx` | SlaIndicador nos cards |
| `src/pages/monitoramento/InstalacoesList.tsx` | SlaIndicador + filtro "Atenção Urgente" |
| `src/pages/rh/JornadasProfissionais.tsx` | 2 cards SLA read-only |

