

## Unificar fila de solicitações em Cadastro › Processos

### Diagnóstico do estado atual

Hoje existem **três pontos distintos** que listam solicitações da mesma natureza, com fontes de dados diferentes:

| Onde | Aba/Página | Fonte |
|---|---|---|
| `/cadastro/processos` (Titularidade) | Lê `chat_solicitacoes_ia` tipo=`troca_titularidade` | **legado** (fluxo IA antigo) |
| `/cobranca/troca-titularidade` | Lê `solicitacoes_troca_titularidade` (nova tabela) | **novo fluxo** que acabamos de construir |
| `/monitoramento/aprovacoes` | Lê `solicitacoes_troca_titularidade` (mesma tabela, etapa monit.) | **novo fluxo** |
| `/cadastro/processos` (Substituições) | `substituicoes_veiculo` | atual |
| `/cadastro/processos` (Migrações) | `solicitacoes_migracao` | atual |
| `/cadastro/processos` (Reativação) | `chat_solicitacoes_ia` tipo=`reativacao` | atual |

**Inclusão de veículo**: não tem entidade própria de "solicitação". Hoje vai direto à cotação/contrato via `OutrasEntradasMenu` → `cotacoes` → `contratos.tipo_entrada='inclusao'`. Não há fila de aprovação.

### O que vamos unificar

`/cadastro/processos` passa a ser a **única fila operacional** das solicitações de mudança no contrato/associado. As 4 abas ficam:

```text
┌─ Cadastro › Processos ────────────────────────────────────┐
│                                                            │
│  [Titularidade] [Substituições] [Migrações] [Inclusões]   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Reativação sai (vira aba secundária colapsada ou some — é fluxo distinto de "renovar associado", não de mudança contratual). Substituição/Migração permanecem com as fontes atuais. Titularidade muda de fonte. Inclusões ganham aba nova.

### Mudanças por aba

**1. Aba Titularidade (refatorada por completo)**
- **Trocar fonte**: deixa de ler `chat_solicitacoes_ia`. Passa a usar `useSolicitacoesTroca()` (já existe) sobre a tabela `solicitacoes_troca_titularidade`.
- **Reaproveita** componentes já prontos: cards de listagem com `STATUS_LABEL`, badges de "Termo assinado" e `<ModalDetalhesTroca>` em `modo="cadastro"`.
- **Sub-abas internas**: Aguardando Cadastro · Aguardando Monitoramento · Em Vistoria · Liberadas/Efetivadas · Recusadas.
- **Visibilidade por papel**: Cadastro vê todas, mas só pode agir em `aguardando_cadastro` (já enforced no modal pelo `podeAgir`).

**2. Aba Substituições (mantida)**
- Sem mudança funcional; já lê `substituicoes_veiculo`. Mantém navegação para `/cadastro/substituicoes/:id`.

**3. Aba Migrações (mantida)**
- Sem mudança; reusa `<MigracoesTab>` existente.

**4. Aba Inclusões (NOVA)**
- Lê `cotacoes` filtrando contratos com `tipo_entrada='inclusao'` **OU** cotações abertas a partir do fluxo de inclusão. Como `cotacoes` não tem `tipo_entrada`, filtramos via `contratos.tipo_entrada='inclusao'` join com cotação, mais cotações em `dados_extras->>'tipo_entrada' = 'inclusao'` (o fluxo público novo já marca isso). Agrupa por status (Em cotação · Em contratação · Ativo · Recusada).
- Card mostra: associado, veículo a incluir, FIPE, mensalidade, status. Ação principal = "Abrir cotação" (link público) ou "Ver associado".
- **Sem botão de aprovar/recusar manual** — inclusão é decisão de venda/financeiro, não passa por aprovação dupla. A fila aqui é **apenas visibilidade operacional** para o Cadastro acompanhar o pipeline.

### Páginas que serão **descontinuadas/redirecionadas**

- `/cobranca/troca-titularidade` → **redirect** para `/cadastro/processos?tab=titularidade`. Remover do menu lateral em "Cobrança". Justificativa: Cadastro é o dono operacional da fila; Cobrança não precisa de tela própria (o financeiro já aparece dentro do `<ModalDetalhesTroca>` na aba "Financeiro Antigo").
- `/monitoramento/aprovacoes` → **mantida** (etapa específica da equipe de Monitoramento, com `modo="monitoramento"` no modal). Não duplica — é apenas a visão filtrada `aguardando_monitoramento` + `aguardando_vistoria` para o time de Monit.
- `ReativacoesTab` em ProcessosOperacionais → removida da TabsList (mantém o componente para eventual reaproveitamento, mas não é exposto). Reativação tem fluxo próprio via `ReativacaoWizard` na ficha do associado.

### Card-resumo (topo)

Os 4 contadores no topo (`useProcessosCounts`) passam a refletir as novas fontes:

| Card | Query |
|---|---|
| Titularidade pendente | `solicitacoes_troca_titularidade` status in (`aguardando_cadastro`, `cotacao_em_andamento`) |
| Substituições | `substituicoes_veiculo` status=`aguardando_aprovacao` (igual hoje) |
| Migrações | `solicitacoes_migracao` status=`pendente` (igual hoje) |
| Inclusões em andamento | `cotacoes` com `dados_extras->>tipo_entrada='inclusao'` e status `em_cotacao`/`pendente_assinatura` |

### Modal único de detalhes

- Titularidade → reusa `<ModalDetalhesTroca modo="cadastro">` (não criar outro).
- Substituição → mantém navegação para a página detalhe atual `/cadastro/substituicoes/:id`.
- Migração → reusa o dialog interno do `MigracoesTab` (já existe).
- Inclusão → modal simples só de visualização (associado + veículo + cotação + atalhos).

### Sidebar

- Em **Cadastro**: "Processos" continua sendo o único item para essa fila. Sem itens novos.
- Em **Cobrança**: remover "Troca de Titularidade" (vira redirect).
- Em **Monitoramento**: "Aprovações" continua (etapa Monit.).

### Critérios de aceitação

1. `/cadastro/processos` mostra as 4 abas: Titularidade, Substituições, Migrações, Inclusões.
2. Aba Titularidade lista solicitações da nova tabela `solicitacoes_troca_titularidade` com badge de status correto e abre `<ModalDetalhesTroca modo="cadastro">`.
3. Cadastro consegue aprovar/recusar uma solicitação `aguardando_cadastro` direto da tela (botões já existem no modal).
4. `/cobranca/troca-titularidade` redireciona automaticamente para `/cadastro/processos`.
5. Item "Troca de Titularidade" sumiu do menu Cobrança.
6. Aba Inclusões mostra cotações em andamento marcadas como inclusão, com link para a cotação pública.
7. Contadores do topo refletem as queries novas e atualizam ao aprovar/recusar (invalidação de `processos-counts`).
8. Nenhuma listagem antiga baseada em `chat_solicitacoes_ia` tipo=troca_titularidade aparece mais — fluxo legado fica órfão (não bloqueia, apenas para de ser exibido).

### Fora de escopo

- Migrar dados antigos de `chat_solicitacoes_ia` tipo=`troca_titularidade` para a nova tabela. O fluxo IA antigo continua existindo no banco, apenas não é mais exibido nesta área.
- Criar entidade `solicitacoes_inclusao` separada — inclusão segue sendo gerida pela cotação/contrato.
- Mexer no fluxo de Reativação (continua via `ReativacaoWizard` na ficha do associado).

