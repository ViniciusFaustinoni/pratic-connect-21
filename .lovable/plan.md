# Aba "Negados" em Serviços de Campo

## 0. Diagnóstico (antes de implementar)

**Onde o status de negação vive hoje:**

| Camada | Campo | Valor quando negado | Quem escreve |
|---|---|---|---|
| Serviço | `servicos.status` | `'reprovada'` | `useAprovacaoMonitoramento.handleReprovar` (linha 460); também via `useAnaliseVistoria` quando `decisao='reprovada'` |
| Veículo | `veiculos.status` | `'recusado'` | mesmo hook (linha 475) + `motivo_recusa_veiculo` |
| Contrato | `contratos.status` | `'recusado'` | mesmo hook (linha 487) |
| Notificação | `notificacoes.tipo` | `'protecao_360_reprovada_monitoramento'` | mesmo hook (linha 497) |

**Sinal canônico definitivo de "veículo negado" = `veiculos.status = 'recusado'`** (escrito pelo único fluxo de reprovação do Monitoramento). É autoritativo e mutuamente exclusivo de `instalacao_pendente`/`ativo`/`cancelado`.

**Estado real dos 3 casos da tela hoje:**

| Placa | `veiculos.status` | `cobertura_suspensa_motivo` | Serviços ativos | Reprovados | Conclusão |
|---|---|---|---|---|---|
| RKL6I08 | **`recusado`** | "Recusa do instalador — aguardando análise do monitoramento" | 0 | 1 (`reprovada`) | ✅ Único que vai para Negados |
| RUU9D60 | `instalacao_pendente` | "Instalação não realizada no prazo de 72h após assinatura" | 0 | 0 | Fica em Suspensos |
| LPQ3D34 | `instalacao_pendente` | "Instalação não realizada no prazo de 48h após agendamento" | 0 | 0 | Fica em Suspensos |

Discriminante limpo, sem necessidade de string-matching. RKL6I08 aparece hoje em Suspensos só porque `useVeiculosSuspensos` filtra por `cobertura_suspensa=true` + ILIKE motivo e ignora `veiculos.status='recusado'`. Vai sair da aba Suspensos automaticamente assim que excluirmos `status='recusado'` no hook.

## 1. Arquivos a tocar

```
src/pages/monitoramento/VistoriasInstalacoesMon.tsx     (adiciona TabsTrigger + TabsContent)
src/hooks/useVeiculosSuspensos.ts                       (exclui status='recusado')
src/hooks/useVeiculosNegados.ts                         (NOVO — lê veiculos.status='recusado')
src/pages/monitoramento/VeiculosNegadosTab.tsx          (NOVO — lista + botões)
src/components/servicos-campo/NovaVistoriaNegadoModal.tsx (NOVO — atribuição direta)
src/components/servicos-campo/HistoricoNegadoDrawer.tsx (NOVO — timeline)
```

Edge function existente `reprovar-servico` / `handleReprovar` do `useAprovacaoMonitoramento` já faz parte da cascata (marca serviço, veículo, contrato). **Não vamos alterar essa lógica**; só garantir que ela cancele em cascata os outros serviços do veículo que ainda estão `pendente|agendada|em_rota|em_andamento` (passo 2 abaixo) e logue em `logs_auditoria`.

## 2. Cascata canônica ao negar

Implementar trigger DB `trg_cascata_negacao_veiculo` (BEFORE/AFTER UPDATE em `veiculos`) que, quando `OLD.status <> 'recusado' AND NEW.status = 'recusado'`:

1. `UPDATE servicos SET status='cancelada', observacoes = COALESCE(observacoes,'') || ' [cancelado por negação do veículo]' WHERE veiculo_id = NEW.id AND status IN ('pendente','agendada','em_rota','em_andamento')`
2. `INSERT INTO logs_auditoria` com `acao='atualizar'`, descrição `[VEICULO_NEGADO] {motivo}` referenciando o veículo + serviços cancelados.
3. Não tocar contrato (já é tratado pelo hook do Monitoramento) nem em `cobertura_suspensa` (preserva motivo histórico).

Defesa em profundidade: o `handleReprovar` atual já cancela 1 serviço; a trigger garante cascata mesmo quando houver múltiplos serviços paralelos abertos (encaixe, manutenção, etc.).

## 3. Hook `useVeiculosNegados`

```ts
// retorna: id, placa, marca, modelo, associado_nome/cpf,
//          motivo_recusa_veiculo, recusado_em (= updated_at do veiculo quando status virou recusado),
//          recusado_por (de logs_auditoria mais recente com tipo VEICULO_NEGADO),
//          historico_servicos: [{id, tipo, status, data_agendada, profissional_nome, observacoes}]
.from('veiculos').select(...).eq('status', 'recusado').not('status','in','(cancelado)')
```

Ordena por `updated_at desc`. `staleTime: 30_000`.

## 4. Aba "Negados" em `VistoriasInstalacoesMon.tsx`

Inserir entre "Veículos Suspensos" e "Mapa":

```tsx
<TabsTrigger value="negados" className="gap-2 shrink-0">
  <Ban className="h-4 w-4" />
  <span className="hidden sm:inline">Negados</span>
  {negados?.length > 0 && <Badge variant="destructive">{negados.length}</Badge>}
</TabsTrigger>
```

`<TabsContent value="negados">` carrega `VeiculosNegadosTab` (lazy). Cada card mostra:

- Placa + marca/modelo + associado + CPF
- Badge `Negado`
- Motivo da negação (de `motivo_recusa_veiculo`)
- Quem negou + data (de `logs_auditoria`)
- Mini-resumo dos serviços anteriores (qtd + último)
- **Botão "Ver Histórico"** → abre `HistoricoNegadoDrawer` (timeline `servicos` + `logs_auditoria` do veículo)
- **Botão "Criar Nova Vistoria"** → abre `NovaVistoriaNegadoModal`

## 5. Modal "Criar Nova Vistoria"

Campos:
- Profissional (select; usa `useVistoriadoresAtivos`)
- Data agendada (date picker)
- Período (manhã/tarde)
- Tipo (radio: `vistoria_entrada` | `vistoria_manutencao`, default `vistoria_entrada`)
- Observações (opcional)

Ao confirmar — **edge function nova `monitoramento-revistoriar-negado`** (server-side para validar permissão e atomicidade):

1. Busca último serviço `reprovada` do veículo → pega `instalacao_origem_id` (se houver) e `contrato_id`.
2. `INSERT INTO servicos` com `status='agendada'`, `tipo`, `profissional_id`, `data_agendada`, `periodo`, `veiculo_id`, `associado_id`, `contrato_id`, `instalacao_origem_id` (preservado), `origem='monitoramento_revistoria_negado'`, `atribuido_em=now()`.
3. `UPDATE veiculos SET status='instalacao_pendente'` (libera o veículo da fila Negados — sai dela automaticamente pelo filtro do hook).
4. `INSERT INTO servicos_atribuicoes_log` (`tipo_atribuicao='manual_pos_negacao'`).
5. `INSERT INTO logs_auditoria` (`[REVISTORIA_POS_NEGACAO]`).

Não envolve associado: nenhum link público, nenhum WhatsApp.

## 6. Atualizar `useVeiculosSuspensos`

Adicionar `.neq('status', 'recusado')` no select (linha 64). RKL6I08 sai automaticamente da aba Suspensos. RUU9D60/LPQ3D34 permanecem (status `instalacao_pendente`).

## 7. Saneamento RKL6I08

Não precisa de saneamento de dados — `veiculos.status` já está `'recusado'`. Assim que (6) entrar e (4) renderizar, ele aparece em Negados e some de Suspensos. **Zero migração de dados**.

## 8. Validação E2E

1. Login diretor → Monitoramento › Serviços de Campo → aba "Negados" aparece com **RKL6I08** (1 caso).
2. Aba "Veículos Suspensos" mostra apenas **RUU9D60** e **LPQ3D34** (badge cai de 9 para os 8 restantes corretos).
3. Clicar em "Criar Nova Vistoria" no card RKL6I08, escolher profissional + data → serviço novo aparece em Atribuição Manual e Serviços; veículo sai da aba Negados.
4. Em outro caso (futuro), aprovar reprovação no fluxo de Monitoramento → veículo aparece automaticamente em Negados; serviços paralelos pendentes são cancelados pela trigger.

## Fora de escopo

- Não mexer em `handleReprovar` (já escreve o sinal canônico correto).
- Não mexer no fluxo de suspensão por 48h/72h.
- Não mexer em rotas, permissões ou sidebar.
- Não criar fluxo de "des-negar" o veículo — a re-vistoria já cumpre esse papel.
- Não mover RUU9D60/LPQ3D34.
