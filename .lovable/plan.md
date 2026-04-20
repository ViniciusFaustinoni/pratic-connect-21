

## Acertar status de Instalações em Serviços de Campo

### Diagnóstico

**Estado atual do enum no banco** (`status_instalacao`):
`agendada, em_rota, em_andamento, concluida, reagendada, cancelada, em_analise, nao_compareceu`

**Problemas identificados:**

1. **Tipos desalinhados** — o front usa duas definições diferentes:
   - `src/types/database.ts` → 7 status (sem `nao_compareceu`)
   - `src/types/monitoramento.ts` → 6 status (sem `em_analise` nem `nao_compareceu`)
   - O banco tem **8 status**. Resultado: `nao_compareceu` (11 registros, hoje a maior fatia) aparece sem label e sem cor na tabela e some do filtro.

2. **Faltam fases intermediárias importantes** — entre "Agendada" e "Em Rota" há um vazio:
   - Quando atribuída a um instalador interno mas ainda não saiu da base → continua `agendada`
   - Quando atribuída a um prestador externo (link gerado, aguardando aceite) → continua `agendada`
   - Quando o instalador chegou no local mas ainda não iniciou → continua `em_rota`
   - "Em Análise" hoje é genérico, não diz se é análise pré-instalação ou pós-execução (laudo)

3. **Status "fantasmas"** sem flow claro:
   - `nao_compareceu`: existe no banco e é setado, mas o front ignora — analista vê linha em branco
   - `em_analise`: usado tanto antes (cadastro) quanto depois (laudo) — confunde

4. **Sem distinção de origem** — uma instalação atribuída a prestador externo aparece exatamente igual a uma interna na rota.

### Solução

#### 1. Padronizar e expandir o enum (fases claras)

Novo conjunto de status com fases bem definidas:

```text
PRÉ-EXECUÇÃO
├─ agendada               → criada, sem instalador atribuído
├─ atribuida              → instalador interno designado, ainda na base
└─ aguardando_prestador   → link de prestador externo gerado, aguardando aceite

EM CAMPO
├─ em_rota                → instalador a caminho do local
├─ no_local               → chegou, ainda não iniciou serviço
└─ em_andamento           → instalação em execução

PÓS-EXECUÇÃO
├─ em_analise             → laudo enviado, aguardando análise do monitoramento
└─ concluida              → aprovada e finalizada

EXCEÇÕES
├─ nao_compareceu         → cliente faltou (já existe, hoje invisível)
├─ reagendada             → remarcada para nova data
└─ cancelada              → cancelada definitivamente
```

#### 2. Migration

- Adicionar valores ao enum: `atribuida`, `aguardando_prestador`, `no_local`
- Trigger leve para auto-transicionar `agendada` → `atribuida` quando `instalador_id` é setado, e `agendada`/`atribuida` → `aguardando_prestador` quando `vistoriador_prestador_id` é setado.
- (Edge functions de início de rota / chegada / start serviço já existentes serão ajustadas para gravar `em_rota`, `no_local`, `em_andamento` — sem quebrar fluxos atuais.)

#### 3. Unificar tipos no front

- **Eleger `src/types/database.ts` como fonte única** para `StatusInstalacao` (tipo + labels + cores).
- Remover o tipo duplicado em `src/types/monitoramento.ts` e reexportar de `database.ts`.
- Atualizar todos os 7 arquivos que importam status para a fonte única.

#### 4. Labels e cores definitivas

| Status | Label | Cor |
|---|---|---|
| agendada | Agendada | azul claro |
| atribuida | Atribuída | índigo |
| aguardando_prestador | Aguardando Prestador | âmbar |
| em_rota | Em Rota | roxo |
| no_local | No Local | ciano |
| em_andamento | Em Andamento | laranja |
| em_analise | Aguardando Análise | amarelo |
| concluida | Concluída | verde |
| nao_compareceu | Não Compareceu | vermelho escuro |
| reagendada | Reagendada | laranja claro |
| cancelada | Cancelada | vermelho |

#### 5. Métricas e filtros (Instalacoes.tsx)

- Cards do topo passam a 6 indicadores agrupados por fase:
  - **Pré-Execução** (agendada + atribuida + aguardando_prestador)
  - **Em Campo** (em_rota + no_local + em_andamento)
  - **Aguardando Análise** (em_analise)
  - **Concluídas Hoje**
  - **Não Compareceu**
  - **Reagendadas**
- Filtros de status reorganizados em 3 grupos (Pré-Execução / Em Campo / Pós-Execução & Exceções) com checkbox por status.
- Adicionar filtro novo "Origem" (interno / prestador) baseado em `vistoriador_prestador_id IS NOT NULL`.

#### 6. Atualizar `useInstalacoesMetricas`

Recalcular as contagens para refletir os novos agrupamentos por fase (sem regressão em consumidores antigos: manter `agendadas`, `emRota`, `concluidasHoje`, `reagendadas` somando tudo da fase correspondente).

### Arquivos tocados

- `supabase/migrations/...` — adicionar 3 valores ao enum + trigger de auto-transição.
- `src/types/database.ts` — expandir tipo, labels, cores.
- `src/types/monitoramento.ts` — remover duplicata, reexportar.
- `src/hooks/useInstalacoes.ts` — atualizar agrupamento de métricas.
- `src/pages/monitoramento/Instalacoes.tsx` — novos cards por fase + badge de origem.
- `src/components/instalacoes/InstalacaoFilters.tsx` — filtros agrupados + filtro de origem.
- `src/components/rotas/InstalacaoMiniCard.tsx` — mapa de cores/labels atualizado (já tem `nao_compareceu`, validar consistência).
- Edge functions de fluxo (`iniciar-rota`, `chegar-local`, `iniciar-instalacao`, `gerar-link-prestador`) — gravar o status correto da fase.

### Validação

1. Migration aplicada → enum tem 11 valores.
2. Lista atual de instalações: as 11 com `nao_compareceu` aparecem com badge "Não Compareceu" vermelho (hoje aparecem em branco).
3. Atribuir instalação a instalador interno → status passa a "Atribuída" automaticamente.
4. Gerar link de prestador → status passa a "Aguardando Prestador".
5. Cards de métricas mostram os 6 grupos por fase com totais coerentes.
6. Filtro por fase funciona; filtro por origem (interno/prestador) funciona.
7. Telas que já consumiam `agendada`/`em_rota`/`concluida` continuam exibindo corretamente (sem regressão).

