## Objetivo

Criar a aba **"Análises"** dentro de **Relacionamento** para receber, de forma unificada e auditável, todo caso em que um associado assinou um **termo de cancelamento** (troca de titularidade, cancelamento voluntário, substituição, ou qualquer termo de cancelamento futuro), permitindo que a operadora trate financeiramente o associado que está saindo sem bloquear nenhum fluxo existente.

## Regras de negócio confirmadas

1. **Não-bloqueante**: a análise é paralela. Troca, cancelamento voluntário e substituição seguem seus fluxos atuais inalterados — nada espera a resolução do caso.
2. **Cancelamento é por veículo, não por pessoa**. Cascata existente (`trg_cascata_cancelamento_associado` e fluxos atuais) já cuida disso — não vamos tocar.
3. **Reavaliação de status do associado** quando perde o último veículo ativo → `cancelado`. Mesma regra que já existe via cascata DB. Confirmado: nenhuma alteração de cascata necessária.
4. **Sem SGA**: a tela usa só dados internos.
5. **Estrutura preparada para novos tipos** via enum.

## Onde os termos vivem hoje (fontes do gatilho)

Auditei o `autentique-webhook` — todo termo de cancelamento assinado já é persistido em 3 lugares canônicos:

| Tipo | Tabela | Coluna de "assinado em" |
|---|---|---|
| Troca de titularidade | `solicitacoes_troca_titularidade` | `termo_cancelamento_assinado_em` |
| Substituição de veículo | `substituicoes_veiculo` | `termo_cancelamento_assinado_em` |
| Cancelamento voluntário | `contratos` | `autentique_cancelamento_assinado_em` |

Vamos plugar **triggers AFTER UPDATE** nessas 3 colunas. Caminho único, idempotente, sem mexer nos webhooks.

## Mudanças

### 1. Migração: tabela `analises_relacionamento`

```text
analises_relacionamento
├── id uuid PK
├── tipo enum (troca_titularidade | cancelamento_voluntario | substituicao | outro)
├── status enum (pendente | em_andamento | resolvido)
├── associado_id uuid FK associados
├── veiculo_id uuid FK veiculos (nullable — caso o veículo já tenha sumido)
├── contrato_id uuid FK contratos (nullable)
├── origem_tabela text  ('solicitacoes_troca_titularidade'|'substituicoes_veiculo'|'contratos')
├── origem_id uuid       (id do registro origem — unique junto com origem_tabela)
├── termo_url text        (snapshot do PDF Autentique no momento do gatilho)
├── termo_assinado_em timestamptz
├── assumido_por uuid (profile), assumido_em timestamptz
├── resolvido_por uuid (profile), resolvido_em timestamptz
├── justificativa text
├── documento_comprobatorio_url text
├── metadata jsonb (placa, cpf, nome — snapshot p/ filtros rápidos)
├── created_at, updated_at
└── UNIQUE (origem_tabela, origem_id)   ← idempotência absoluta
```

**GRANT**: SELECT/INSERT/UPDATE para `authenticated` (RLS abaixo restringe), ALL para `service_role`. Sem `anon`.

**RLS** (sem mexer em auth):
- SELECT: usuários com role relacionamento/cobranca/diretor/coordenador_monitoramento (via `has_role`/policy existente)
- INSERT: bloqueado para usuário comum (só via trigger/service_role)
- UPDATE: mesmas roles do SELECT, e só quem está autenticado pode marcar resolvido (auditado em `resolvido_por`)

### 2. Triggers de criação automática

Três triggers AFTER UPDATE OF nas 3 tabelas-fonte, todos chamando `fn_criar_analise_relacionamento_cancelamento()`:
- `trg_analise_relacionamento_troca` em `solicitacoes_troca_titularidade` quando `termo_cancelamento_assinado_em` passa de NULL → NOT NULL
- `trg_analise_relacionamento_substituicao` em `substituicoes_veiculo` mesma condição
- `trg_analise_relacionamento_cancelamento_voluntario` em `contratos` quando `autentique_cancelamento_assinado_em` passa de NULL → NOT NULL

A função faz `INSERT … ON CONFLICT (origem_tabela, origem_id) DO NOTHING` — totalmente idempotente. Resolve `associado_id`, `veiculo_id`, `contrato_id` e o snapshot do `metadata` na hora.

**Backfill**: a migration faz um INSERT inicial cobrindo todos os registros já assinados nas 3 fontes (mesma idempotência), para que casos existentes apareçam imediatamente.

### 3. Storage bucket `relacionamento-anexos` (privado)

Para `documento_comprobatorio_url`. RLS: somente roles autorizadas no upload/leitura. Tipos aceitos: imagens, PDFs, áudios.

### 4. Frontend — novo módulo

**Sidebar** (`AppSidebar.tsx`): adicionar item em "Relacionamento":
```ts
{ title: 'Análises', url: '/relacionamento/analises', icon: ClipboardCheck }
```

**Rota**: `/relacionamento/analises` → nova page `src/pages/relacionamento/AnalisesRelacionamento.tsx`

**Hook**: `src/hooks/useAnalisesRelacionamento.ts`
- `useAnalisesRelacionamento({ status?, tipo?, busca? })` — lista
- `useAssumirAnalise(id)` — UPDATE status='em_andamento' + assumido_por/em
- `useResolverAnalise(id, { justificativa, documentoUrl })` — UPDATE status='resolvido' + resolvido_por/em + insere `associados_historico` com `tipo='analise_relacionamento_resolvida'`

**Tela `AnalisesRelacionamento.tsx`**:
- Header com filtros: status (Pendente/Em Andamento/Resolvido/Todos), tipo (badge), busca por nome/CPF/placa
- Tabela: badge tipo, status, associado, CPF, placa, data assinatura, ações
- Linha clicável → abre `AnaliseRelacionamentoDrawer`

**Drawer `AnaliseRelacionamentoDrawer.tsx`** (novo):
- Cabeçalho: badge tipo + status + nome/CPF/placa
- Botão "Ver termo assinado" → abre `termo_url` em nova aba
- Botões de atalho para visualizações já existentes:
  - "Ficha do Associado" → `AssociadoFichaCompletaDialog` (já existe)
  - "Detalhe do Veículo" → rota existente
  - "Financeiro do Associado" → reusa `FinanceiroTab` / `useResumoFinanceiroAssociado`
  - "Documentos" → `useDocumentosPorAssociado`
- Histórico do associado embutido (`HistoricoAssociadoTab` existente)
- Bloco de ação:
  - Se pendente: botão "Assumir" → status='em_andamento'
  - Se em_andamento ou pendente: bloco "Resolver" com upload (1 arquivo, max 20MB) + textarea justificativa obrigatória (min 10 chars) → "Marcar Resolvido"
  - Se resolvido: mostra anexo, justificativa, quem/quando, em modo somente leitura
- **Sem nenhuma chamada SGA**.

### 5. Histórico do associado

`useResolverAnalise` insere em `associados_historico`:
```
tipo: 'analise_relacionamento_resolvida'
descricao: 'Análise de Relacionamento resolvida: <tipo> (placa <X>)'
metadata: { analise_id, tipo, justificativa, documento_url }
```
Assim a referência aparece automaticamente em qualquer tela que já lê `associados_historico` (ficha do associado, drawer de serviço, etc.) — sem precisar tocar nelas.

## O que NÃO muda (defensivo)

- `efetivar-troca-titularidade`, `cancelar-veiculo`, `cancelar-associado`, `efetivar-substituicao`: intactos
- `autentique-webhook`: intacto (só lemos o lado-efeito que ele já produz)
- Cascata DB de cancelamento (`trg_cascata_cancelamento_associado`, religadores): intacta
- Fluxo de troca/substituição/cancelamento voluntário: continua não-bloqueante em relação a esta nova fila
- Nenhuma trava ou validação atual é alterada

## Critério de aceite

1. Assinar termo de cancelamento (qualquer dos 3 fluxos) → linha aparece em `/relacionamento/analises` com badge correto, em ≤ alguns segundos (insert via trigger).
2. Veículo + cotações/contratos/coberturas/rastreador continuam cancelando pelo fluxo existente, sem nova trava.
3. Associado vira `cancelado` só se perdeu o último veículo ativo (cascata atual já cobre).
4. Drawer mostra associado, CPF, placa, badge, termo assinado, status, e links/embed para tudo que já existe — sem SGA.
5. Operadora consegue Assumir → Resolver com anexo + justificativa.
6. Caso resolvido permanece listado, filtrável por status, com anexo + justificativa em modo leitura.
7. `associados_historico` ganha registro automático ao resolver.
8. Adicionar novo tipo no futuro = expandir enum + criar trigger em nova tabela-fonte. Nada na UI muda além de mapear label/cor do badge.

## Memória a atualizar pós-build

Nova entrada Core:
> Todo termo de cancelamento assinado (troca, substituição, voluntário) materializa um caso em `analises_relacionamento` via triggers AFTER UPDATE — fila não-bloqueante na aba Relacionamento › Análises. Idempotência por UNIQUE (origem_tabela, origem_id).
