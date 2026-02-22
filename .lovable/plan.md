
# S01 — Infraestrutura Completa para o Fluxo de Sindicancia

## Resumo

Criar toda a base de dados, permissoes, rotas e telas web para o perfil "sindicante" — um prestador externo que investiga sinistros suspeitos. O sindicante tera acesso web desktop (nao mobile), usando o `AppLayout` padrao do sistema, restrito a rotas `/sindicante/*`.

---

## 1. Banco de Dados (Migration SQL)

### 1.1 Adicionar `sindicante` ao enum `app_role`

```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sindicante';
```

### 1.2 Criar tabela `empresas_sindicancia` (cadastro das empresas)

| Coluna | Tipo | Descricao |
|---|---|---|
| id | UUID PK | Identificador |
| razao_social | TEXT NOT NULL | Razao social |
| nome_fantasia | TEXT | Nome fantasia |
| cnpj | VARCHAR(18) UNIQUE NOT NULL | CNPJ formatado |
| responsavel_nome | TEXT NOT NULL | Nome do responsavel tecnico |
| responsavel_cpf | VARCHAR(14) | CPF do responsavel |
| responsavel_telefone | VARCHAR(20) | Telefone |
| responsavel_email | TEXT | Email |
| especialidades | TEXT[] | Array: fraude_veicular, roubo_furto, incendio, colisao_suspeita, geral |
| regioes_atuacao | TEXT[] | Array: rj_capital, rj_baixada, rj_interior, sp_capital, sp_interior, mg, outros |
| valor_por_sindicancia | NUMERIC(10,2) | Valor cobrado |
| observacoes | TEXT | Texto livre |
| ativo | BOOLEAN DEFAULT true | Status |
| profile_id | UUID REFERENCES profiles(id) | Vinculo com usuario do sistema (login) |
| created_at, updated_at | TIMESTAMPTZ | Timestamps |

RLS: Funcionarios internos (diretor, analista_eventos) podem CRUD. Sindicante pode ler apenas sua propria empresa.

### 1.3 Criar tabela `sindicancias` (caso de investigacao)

| Coluna | Tipo | Descricao |
|---|---|---|
| id | UUID PK | Identificador |
| numero | TEXT UNIQUE NOT NULL | Formato SIND-YYYYMMDD-XXX |
| sinistro_id | UUID FK sinistros(id) | Evento investigado |
| empresa_sindicancia_id | UUID FK empresas_sindicancia(id) | Empresa atribuida |
| sindicante_profile_id | UUID FK profiles(id) | Sindicante pessoa |
| motivo | TEXT NOT NULL | Motivo livre |
| motivos_padronizados | TEXT[] | Checkboxes marcados |
| descricao | TEXT | Descricao detalhada |
| status | TEXT NOT NULL DEFAULT 'aguardando_atribuicao' | Status do caso |
| data_abertura | TIMESTAMPTZ DEFAULT NOW() | Abertura |
| data_atribuicao | TIMESTAMPTZ | Quando atribuido |
| data_limite | TIMESTAMPTZ | 30 dias apos abertura (automatico) |
| data_laudo | TIMESTAMPTZ | Quando laudo emitido |
| data_encerramento | TIMESTAMPTZ | Quando encerrado |
| laudo_conclusao | TEXT | regular, irregular_comprovada, irregular_suspeita, inconclusivo |
| laudo_resumo | TEXT | Resumo executivo |
| laudo_irregularidades | TEXT | Detalhamento |
| laudo_recomendacao | TEXT | aprovar, negar, encaminhar_juridico, encaminhar_diretoria, solicitar_pericia |
| laudo_arquivo_url | TEXT | PDF do laudo |
| decisao_analista | TEXT | O que o analista decidiu |
| decisao_observacao | TEXT | Obs do analista |
| decisao_por | UUID FK profiles(id) | Quem decidiu |
| decisao_em | TIMESTAMPTZ | Quando |
| aberto_por | UUID FK profiles(id) | Analista que abriu |
| created_at, updated_at | TIMESTAMPTZ | Timestamps |

**Trigger para numeracao automatica**: funcao que gera SIND-YYYYMMDD-XXX no INSERT.

**Trigger para data_limite**: calcula automaticamente data_abertura + 30 dias.

RLS: Sindicante ve apenas onde `sindicante_profile_id` = seu profile id. Funcionarios veem tudo.

### 1.4 Criar tabela `sindicancia_diligencias`

| Coluna | Tipo | Descricao |
|---|---|---|
| id | UUID PK | Identificador |
| sindicancia_id | UUID FK sindicancias(id) | Caso vinculado |
| tipo | TEXT NOT NULL | visita_local, entrevista_associado, etc. |
| data_diligencia | DATE NOT NULL | Quando realizada |
| descricao | TEXT NOT NULL | O que foi feito |
| resultado | TEXT | O que encontrou |
| local | TEXT | Local da diligencia |
| registrado_por | UUID FK profiles(id) | Quem registrou |
| created_at | TIMESTAMPTZ | Timestamp |

RLS: Sindicante so le/insere em sindicancias atribuidas a ele. **Nao pode DELETE** (auditoria). Funcionarios podem ler tudo.

### 1.5 Criar tabela `sindicancia_solicitacoes`

| Coluna | Tipo | Descricao |
|---|---|---|
| id | UUID PK | Identificador |
| sindicancia_id | UUID FK sindicancias(id) | Caso |
| tipo | TEXT NOT NULL | informacao, documento, acesso |
| descricao | TEXT NOT NULL | O que precisa |
| status | TEXT DEFAULT 'pendente' | pendente, respondida, cancelada |
| resposta | TEXT | Texto da resposta |
| resposta_anexo_url | TEXT | Anexo |
| solicitado_por | UUID FK profiles(id) | Sindicante |
| respondido_por | UUID FK profiles(id) | Analista |
| solicitado_em | TIMESTAMPTZ DEFAULT NOW() | |
| respondido_em | TIMESTAMPTZ | |

RLS: Sindicante le/insere nas suas. Funcionarios podem ler e responder.

### 1.6 Atualizar `sindicancia_evidencias`

A tabela ja existe, mas precisa de ajuste:
- Adicionar coluna `sindicancia_id UUID REFERENCES sindicancias(id)` (vinculo com o caso especifico)
- Adicionar coluna `diligencia_id UUID REFERENCES sindicancia_diligencias(id)` (vinculo opcional com diligencia)
- Atualizar RLS: sindicante so acessa evidencias de sindicancias atribuidas a ele

### 1.7 Criar bucket de storage `sindicancia-evidencias`

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('sindicancia-evidencias', 'sindicancia-evidencias', false);
```

RLS: Sindicante pode inserir/ler em paths de suas sindicancias. Funcionarios leem tudo.

### 1.8 Funcao `get_my_profile_id()` — ja existe

Sera usada nas politicas RLS para comparar `sindicante_profile_id`.

---

## 2. Tipos TypeScript

### `src/types/auth.ts`
- Adicionar `'sindicante'` ao union `PerfilAcesso`
- Adicionar `sindicante: 'Sindicante'` ao `PERFIL_ACESSO_LABELS`

### `src/types/sindicancia.ts` (novo arquivo)
- Interfaces: `EmpresaSindicancia`, `Sindicancia`, `SindicanciaDiligencia`, `SindicanciaSolicitacao`
- Enums/constantes: `STATUS_SINDICANCIA_LABELS`, `TIPO_DILIGENCIA_LABELS`, `ESPECIALIDADES_LABELS`, `REGIOES_LABELS`, `CONCLUSAO_LAUDO_LABELS`, `RECOMENDACAO_LABELS`

---

## 3. Permissoes e Guards

### `src/hooks/usePermissions.ts`
- Adicionar `isSindicante = hasRoleByName('sindicante')`
- Adicionar `isSindicanteOnly` (sem diretor/gerencia/dev/admin)
- Incluir `isSindicanteOnly` no `isPerfilLimitado`

### `src/hooks/useRouteGuard.ts`
- Adicionar guard: sindicante so acessa `/sindicante/*`, `/perfil`, `/definir-senha`

### `src/pages/auth/AuthCallback.tsx`
- Adicionar redirect para sindicante: `navigate('/sindicante', { replace: true })`

---

## 4. Layout e Rotas

### `src/components/sindicante/SindicanteGuard.tsx` (novo)
- Verifica role `sindicante`, redireciona para `/auth` se nao autorizado

### Rotas em `src/App.tsx`

```text
/sindicante              -> SindicanteDashboard (guard + AppLayout)
/sindicante/caso/:id     -> SindicanteCasoDetalhe
/sindicante/perfil       -> Pagina de perfil
```

Todas as rotas usam `AppLayout` (web desktop, nao mobile).

---

## 5. Paginas do Sindicante

### `src/pages/sindicante/SindicanteDashboard.tsx` (novo)
- Cards: Casos Ativos, Prazo Mais Proximo, Laudos Pendentes, Solicitacoes Pendentes
- Lista de sindicancias atribuidas com filtro por status
- Badge de alerta quando prazo < 7 dias ou vencido

### `src/pages/sindicante/SindicanteCasoDetalhe.tsx` (novo)
Visualizacao completa do caso com tabs:
- **Dados do Evento** (somente leitura): tipo, data, local, relato, fotos auto vistoria, video, B.O., fotos vistoria regulador + parecer, GPS, mapa, dados do veiculo, dados basicos do associado (nome, CPF, telefone)
- **Diligencias**: lista + botao "+ Registrar Diligencia"
- **Evidencias**: galeria de fotos/docs
- **Laudo**: formulario para emitir laudo final (quando status = em_andamento)
- **Solicitacoes**: lista + botao "Solicitar Informacao"

### `src/components/sindicante/RegistrarDiligenciaModal.tsx` (novo)
- Campos: data, tipo (select), descricao, resultado, local, upload de evidencias
- Insere em `sindicancia_diligencias` + `sindicancia_evidencias`

### `src/components/sindicante/EmitirLaudoModal.tsx` (novo)
- Conclusao (select), resumo executivo (textarea min 200 chars), irregularidades, recomendacao, upload PDF
- Ao salvar: atualiza sindicancia status para `laudo_emitido`, atualiza sinistro status para `aguardando_analise`

### `src/components/sindicante/SolicitarInfoModal.tsx` (novo)
- Tipo (select), descricao
- Insere em `sindicancia_solicitacoes`

---

## 6. Tela Administrativa (para diretor/analista)

### `src/pages/configuracoes/EmpresasSindicancia.tsx` (novo)
- CRUD de empresas de sindicancia
- Tabela com: nome, CNPJ, especialidades, regioes, status, valor
- Modal de criacao/edicao
- Vinculo com usuario (select de profiles com role sindicante)

---

## 7. Sequencia de Implementacao

1. Migration SQL (tabelas, enum, triggers, RLS, storage)
2. Tipos TypeScript (`src/types/sindicancia.ts` + update `auth.ts`)
3. Permissoes (`usePermissions.ts`, `useRouteGuard.ts`)
4. Guard + Rotas (`SindicanteGuard.tsx`, `App.tsx`)
5. Dashboard do sindicante
6. Detalhe do caso + modais (diligencia, laudo, solicitacao)
7. Tela administrativa de empresas

## Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| `src/types/sindicancia.ts` | Tipos e constantes |
| `src/components/sindicante/SindicanteGuard.tsx` | Guard de acesso |
| `src/pages/sindicante/SindicanteDashboard.tsx` | Dashboard web |
| `src/pages/sindicante/SindicanteCasoDetalhe.tsx` | Detalhe do caso |
| `src/components/sindicante/RegistrarDiligenciaModal.tsx` | Modal diligencia |
| `src/components/sindicante/EmitirLaudoModal.tsx` | Modal laudo |
| `src/components/sindicante/SolicitarInfoModal.tsx` | Modal solicitacao |
| `src/pages/configuracoes/EmpresasSindicancia.tsx` | CRUD empresas |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| Migration SQL | Enum, 4 tabelas, triggers, RLS, storage |
| `src/types/auth.ts` | Adicionar `sindicante` ao PerfilAcesso e labels |
| `src/hooks/usePermissions.ts` | `isSindicante`, `isSindicanteOnly` |
| `src/hooks/useRouteGuard.ts` | Guard `/sindicante/*` |
| `src/pages/auth/AuthCallback.tsx` | Redirect sindicante |
| `src/App.tsx` | Rotas `/sindicante/*` e rota admin empresas |
