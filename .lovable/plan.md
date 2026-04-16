

## Plano: Incluir Vistorias Base na Aba de Atribuição Manual

### Problema
A aba "Atribuição Manual" em Serviços de Campo busca apenas da tabela `servicos` (instalações e vistorias agendadas). Vistorias do tipo **base** (`agendamentos_base`) não aparecem na lista de serviços pendentes, impossibilitando sua atribuição manual.

### Mudanças

#### 1. `src/hooks/useAtribuicaoManual.ts` — `useServicosParaAtribuir`
- Adicionar query paralela à tabela `agendamentos_base` filtrando por `atendido_por IS NULL` e `status` pendente (`agendado`), com `data_agendada >= hoje`.
- Normalizar os resultados de `agendamentos_base` para o mesmo formato dos serviços (`id`, `tipo: 'vistoria_base'`, `data_agendada`, `hora_agendada`, `associado: { nome }`, `veiculo: { placa }`, `bairro`, etc.), usando os campos `cliente_nome`, `veiculo_placa`, `horario`.
- Mesclar ambas as listas ordenadas por data.

#### 2. `src/hooks/useAtribuicaoManual.ts` — `useAtribuirServicoManual`
- Detectar se o `servicoId` pertence a `agendamentos_base` (via flag `isBase` no data do draggable).
- Se for base: fazer `update` em `agendamentos_base` setando `atendido_por` e `status: 'confirmado'` ao invés de atualizar `servicos`.
- Manter log de atribuição e notificação WhatsApp.

#### 3. `src/components/monitoramento/AtribuicaoManualTab.tsx`
- Adicionar `"vistoria_base"` ao filtro de tipos no `Select` (novo item "Vistorias Base").
- Ajustar `getTipoLabel`, `getTipoBadgeClass`, `getTipoIcon` para o novo tipo.
- Passar flag `isBase: true` no data do draggable para itens de `agendamentos_base`.

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useAtribuicaoManual.ts` | Adicionar query `agendamentos_base` + merge; ajustar mutation |
| `src/components/monitoramento/AtribuicaoManualTab.tsx` | Adicionar tipo base no filtro e helpers visuais |

