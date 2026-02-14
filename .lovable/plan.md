

# Revisao: Geracao de OS, Mensagem 15min, Painel Regulador

## Resultado da Verificacao Completa

### 1. Geracao Automatica da OS (gerar-os-cotacao-aprovada)

| Item | Status |
|---|---|
| OS contem itens do orcamento do regulador (MO + servicos) | OK (linhas 103-116) |
| OS contem pecas da cotacao aprovada | OK (linhas 88-101) |
| Etapas de reparo como checkpoints (status "pendente") | OK (linhas 59-64) |
| Oficina atribuida vinculada | OK (oficina_id do sinistro, linha 72) |
| **Prestadores vinculados** | **FALTANDO — edge function nao busca/vincula prestadores da tabela sinistro_prestadores** |
| Auto center aprovado registrado | OK (auto_center_id e cotacao_aprovada_id, linhas 75-76) |
| Valores da cotacao aprovada (pecas) substituem estimativas | OK (pecas vem da cotacao.resposta, MO/servicos do orcamento) |
| Veiculo e associado vinculados | OK (linhas 73-74) |
| Status inicial: aguardando_entrada | OK (linha 78) |
| Historico registrado | OK (linhas 128-132) |
| WhatsApp ao associado | OK (linhas 134-153) |

### 2. Mensagem da IA (15 min apos) -- FALTANDO

| Item | Status |
|---|---|
| **15 min apos geracao da OS, IA envia WhatsApp** | **FALTANDO — nao existe agendamento de mensagem com delay de 15min** |
| **Mensagem confirma pagamento + pecas em cotacao + acompanhe** | **FALTANDO** |

O cron-contato-sinistro existente trata de contatos agendados para sinistros (Link 1, coparticipacao), nao de mensagens pos-geracao de OS.

### 3. Painel Regulador — Aba "Veiculos em Oficina" -- OK parcial

| Item | Status |
|---|---|
| Pagina "Veiculos em Oficina" na area do regulador | OK (ReguladorOficina.tsx) |
| Contadores: total, aguard. entrada, aguard. peca, em execucao, concluidos | OK |
| **Contador "em finalizacao"** | **FALTANDO — nao existe no STATUS_MAP nem nos contadores** |

### 4. Lista de Veiculos (Cards)

| Item | Status |
|---|---|
| Placa (destaque), marca/modelo/ano/cor | OK |
| Nome e telefone do associado | OK |
| Numero da OS, oficina, auto center | OK |
| **Prestadores vinculados** | **FALTANDO — query nao busca prestadores, cards nao exibem** |
| Status (badge), data de entrada, tempo em oficina | OK |
| Barra de progresso de etapas com icones | OK |
| Ultima atualizacao com alertas >24h/>48h | OK |

### 5. Filtros e Acoes

| Item | Status |
|---|---|
| Filtros: oficina, status, tempo, busca placa/nome | OK |
| Acao "Registrar Entrada" | OK (muda para em_execucao) |
| **Acao "Registrar Entrada" — notifica associado via WhatsApp** | **FALTANDO — nao envia WhatsApp na entrada** |
| **Acao "Definir/Alterar Oficina"** | **FALTANDO — nao existe modal para alterar oficina de uma OS** |
| Acao "Registrar Atualizacao" | OK (RegistrarAtualizacaoDialog) |
| Acao "Vistoria Presencial" | OK (VistoriaPresencialDialog) |

### 6. Metricas por Oficina

| Item | Status |
|---|---|
| Ranking: nome, qtd veiculos, tempo medio | OK |
| **Nota pontualidade** | **FALTANDO — so exibe qtd e media de dias, sem nota** |

### 7. Fluxo de Status da OS -- 2 BUGS

| Item | Status |
|---|---|
| `aguardando_entrada` no enum DB | OK |
| `entregue` no enum DB | OK |
| **`aguardando_entrada` e `entregue` no tipo TypeScript** | **BUG — `aguardando_entrada` esta no DB enum mas FALTANDO no TS labels; `entregue` esta no DB enum mas FALTANDO no TS type e labels** |
| **Cada mudanca gera notificacao WhatsApp** | **FALTANDO — handleRegistrarEntrada nao envia WhatsApp** |

---

## Correcoes Necessarias (priorizadas)

### Correcao 1 — Adicionar `aguardando_entrada` e `entregue` ao tipo TypeScript e labels

**Arquivo:** `src/types/database.ts`

O enum do DB tem `aguardando_entrada` e `entregue`, mas o tipo TypeScript `StatusOrdemServico` nao inclui `aguardando_entrada` (esta faltando no labels/colors) e `entregue` (esta faltando no tipo, labels e colors).

Adicionar ao tipo:
```text
export type StatusOrdemServico =
  | 'rascunho'
  | 'aguardando_entrada'   // ADICIONAR
  | 'aguardando_orcamento'
  | ...
  | 'entregue';            // ADICIONAR
```

Adicionar aos labels:
```text
aguardando_entrada: 'Aguardando Entrada',
entregue: 'Entregue',
```

Adicionar aos colors:
```text
aguardando_entrada: 'bg-yellow-100 text-yellow-800',
entregue: 'bg-blue-100 text-blue-800',
```

### Correcao 2 — Vincular prestadores na geracao da OS

**Arquivo:** `supabase/functions/gerar-os-cotacao-aprovada/index.ts`

Apos criar a OS, buscar prestadores vinculados ao sinistro (tabela `sinistro_prestadores`) e registra-los na OS. Como a tabela `ordens_servico` nao tem campo para prestadores, a abordagem sera:
1. Buscar prestadores de `sinistro_prestadores` para o sinistro
2. Adicionar a informacao nas observacoes da OS
3. Registrar no historico

### Correcao 3 — Enviar WhatsApp ao associado ao registrar entrada

**Arquivo:** `src/pages/regulador/ReguladorOficina.tsx`

No `handleRegistrarEntrada`, apos atualizar o status, chamar a edge function `whatsapp-send-text` para notificar o associado que o veiculo deu entrada na oficina.

### Correcao 4 — Mensagem da IA 15min apos geracao da OS

**Arquivo:** `supabase/functions/gerar-os-cotacao-aprovada/index.ts`

Apos criar a OS com sucesso, agendar um contato na tabela `sinistro_contatos_agendados` com `agendado_para = now() + 15min`. O cron-contato-sinistro ja roda a cada minuto e processara esse agendamento automaticamente.

Porem, o cron-contato-sinistro atual monta mensagens especificas para o fluxo de Link 1 (auto vistoria, BO, etc), nao para pos-OS. Sera necessario:
1. Adicionar um campo `tipo` ao agendamento (ex: `pos_os_gerada`)
2. No cron, tratar esse tipo com mensagem diferente: "Pagamento confirmado, pecas em cotacao, acompanhe por aqui"

**Abordagem mais simples:** Enviar a mensagem diretamente no edge function com um `setTimeout` simulado via agendamento no banco. Como o cron roda a cada minuto, basta inserir na tabela com `agendado_para = now + 15min` e uma mensagem customizada pre-definida.

O campo `mensagem_enviada` ja pode ser usado como template override. Ajustar o cron para enviar a `mensagem_enviada` quando ja estiver preenchida (skip montagem de mensagem).

### Correcao 5 — Exibir prestadores nos cards do painel

**Arquivo:** `src/hooks/useVeiculosOficina.ts`

Adicionar join com `sinistro_prestadores` via sinistro para buscar os prestadores vinculados. Exibir nos cards com icone.

**Arquivo:** `src/pages/regulador/ReguladorOficina.tsx` — adicionar exibicao dos prestadores nos cards.

### Correcao 6 — Acao "Definir/Alterar Oficina" (modal simples)

**Arquivo:** `src/pages/regulador/ReguladorOficina.tsx`

Adicionar botao "Alterar Oficina" que abre um dialog com lista de oficinas (reutilizando `useOficinasDisponiveis`) e atualiza o `oficina_id` da OS.

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/types/database.ts` — adicionar `aguardando_entrada` e `entregue` ao type/labels/colors |
| Modificar | `supabase/functions/gerar-os-cotacao-aprovada/index.ts` — vincular prestadores + agendar mensagem 15min |
| Modificar | `src/pages/regulador/ReguladorOficina.tsx` — WhatsApp na entrada + botao alterar oficina + exibir prestadores |
| Modificar | `src/hooks/useVeiculosOficina.ts` — buscar prestadores no join |
| Modificar | `supabase/functions/cron-contato-sinistro/index.ts` — tratar mensagem pre-definida (skip template) |

