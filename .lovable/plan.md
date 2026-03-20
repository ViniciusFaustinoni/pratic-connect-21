

# Plano: Aprovação do Monitoramento — Proteção 360 só após aprovação

## Resumo

Hoje, quando o técnico finaliza a instalação, o sistema ativa `cobertura_total = true` e envia a notificação automaticamente em dois hooks:
- `useAprovarVeiculoServico` (fluxo `servicos`) — linhas 1016-1049 de `useServicos.ts`
- `useAprovarVeiculoVistoria` (fluxo `vistorias`) — linhas 34-154 de `useVistoriaCompleta.ts`

A mudança: remover essa ativação automática e criar uma etapa de aprovação manual pelo monitoramento.

## Alterações

### 1. `useServicos.ts` — Remover ativação automática de cobertura_total

Nas linhas 1016-1061, onde hoje verifica `cobertura_roubo_furto` e seta `cobertura_total = true` + notificação:
- Remover o bloco que seta `cobertura_total: true`
- Remover o bloco de notificação `cobertura_total_ativada`
- Manter apenas o update de `veiculos.status = 'ativo'` (sem cobertura_total)
- Alterar toast de sucesso (linha 1168) para: "Instalação concluída! Aguardando aprovação do monitoramento."

### 2. `useVistoriaCompleta.ts` — Remover ativação automática de cobertura_total

Nas linhas 34-154 do `useAprovarVeiculoVistoria`:
- Remover `cobertura_total: true` do update do veículo (linha 39)
- Remover `associados.status = 'ativo'` e `data_ativacao` — deixar como `em_analise`
- Remover a notificação `cobertura_total_ativada` (linhas 141-154)
- Alterar o histórico (linha 88) para: "Instalação concluída — aguardando aprovação do monitoramento"
- Alterar toast (linha 163) para: "Instalação concluída! Aguardando aprovação do monitoramento."

### 3. Novo hook: `useAprovacaoMonitoramento.ts`

**`useInstalacoesAguardandoAprovacao`** — Query:
- Busca em `servicos` com `tipo = 'instalacao'`, `status = 'concluida'`
- JOIN com `veiculos` onde `cobertura_roubo_furto = true` e `cobertura_total = false`
- JOIN com `associados` para nome, telefone
- JOIN com `instalacoes` via `instalacao_origem_id` para dados legados
- Retorna: nome, placa, modelo, instalador, data conclusão, tempo de espera

**`useAprovarInstalacaoMonitoramento`** — Mutation aprovar:
- `veiculos.cobertura_total = true`
- `associados.status = 'ativo'`, `data_ativacao = now()`
- `cotacoes.status_contratacao = 'ativo'`
- `contratos.status = 'ativo'`
- Disparar `notificar-cliente` com `tipo: 'cobertura_total_ativada'` (a notificação que antes era enviada na conclusão)
- Registrar histórico: "Proteção 360 aprovada pelo monitoramento"

**`useReprovarInstalacaoMonitoramento`** — Mutation reprovar:
- Registrar motivo da reprovação
- Marcar serviço com observação de reprovação
- Notificar coordenador

### 4. Reescrever `AcionamentosRouboFurto.tsx` (Aprovação de Associados)

Substituir o conteúdo atual (que mostra propostas de cadastro usando `usePropostasPendentes`) por uma fila de instalações concluídas pendentes de aprovação do monitoramento.

- KPIs: Aguardando | Em análise | Aprovados hoje | Reprovados hoje
- Lista com cards: nome, placa, modelo, instalador, data, tempo de espera
- Click abre página de detalhe para análise

### 5. Nova página: `AprovacaoInstalacaoDetalhe.tsx`

Página de análise detalhada com:
- Dados do associado e veículo
- Galeria de fotos capturadas pelo técnico
- Checklist preenchido
- Dados do rastreador (IMEI, plataforma, local de instalação)
- Botões: **Aprovar** (ativa Proteção 360 + envia notificação) e **Reprovar** (com motivo)

### 6. Rota em `App.tsx`

Adicionar: `/monitoramento/aprovacao-associados/:id` → `AprovacaoInstalacaoDetalhe`

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useServicos.ts` | Remover ativação automática de `cobertura_total` e notificação |
| `src/hooks/useVistoriaCompleta.ts` | Remover ativação automática de `cobertura_total` e notificação |
| `src/hooks/useAprovacaoMonitoramento.ts` | **Novo** — hooks de consulta + aprovar/reprovar |
| `src/pages/monitoramento/AcionamentosRouboFurto.tsx` | Reescrever para fila de instalações pendentes |
| `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` | **Novo** — análise com fotos/checklist |
| `src/App.tsx` | Adicionar rota para detalhe |

## O que NÃO muda

- Ativação técnica do rastreador na plataforma (Softruck/Rede Veículos) — continua na conclusão pelo técnico
- Fluxo de recusa pelo técnico
- A página de análise do cadastro (`VistoriaCompletaAnalise.tsx`)

