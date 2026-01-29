
# Plano de Revisao do Modulo Recursos Humanos

## Analise Comparativa: PDF vs Codigo Atual

Apos revisar detalhadamente o documento "PRD COMPLETO - MODULO RH" (50 paginas) e comparar com o codigo existente, identifiquei os gaps e melhorias necessarias para alinhar o modulo com as especificacoes do PDF.

---

## RESUMO EXECUTIVO

### Status Atual por Area

| Area | Conformidade | Gaps Principais |
|------|--------------|-----------------|
| Dashboard | 70% | Falta card "Folha do Mes", grafico custos 6 meses, secao movimentacoes |
| Funcionarios Lista | 80% | Falta coluna matricula, acoes em lote, filtro por cargo/periodo |
| Funcionario Ficha | 75% | Falta aba Ferias completa, historico salarial, resumo caso |
| Admissao (Form) | 70% | Falta wizard em etapas, periodo experiencia, checklist pos-admissao |
| Desligamento | 0% | Modal/fluxo de desligamento NAO implementado |
| Cargos/Deptos | 85% | Falta campo codigo, centro custo, responsavel, faixa salarial |
| Folha Pagamento | 75% | Falta card encargos, totalizadores detalhados, status aprovacao |
| Ponto | 80% | Falta importacao arquivo (AFD), banco de horas, ajuste com anexo |
| Ferias | 85% | Falta previa de valores, fracionamento, verificacao conflitos |
| Beneficios | 70% | Falta resumo mensal, detalhamento VT por linha, dependentes |
| Documentos | 75% | Falta geracao automatica de documentos, alertas vencimento |
| Treinamentos | 0% | Modulo NAO implementado |
| Recrutamento | 0% | Modulo NAO implementado |

---

## FASE 1 - ESSENCIAL (Implementar Primeiro)

### 1.1 Dashboard RH - Melhorias

**Arquivo:** `src/pages/rh/RHDashboard.tsx`

| Item PDF | Status | Acao |
|----------|--------|------|
| Card "Folha do Mes" (valor + status) | Ausente | Adicionar query folha_pagamento |
| Sub-info em cards (CLT/PJ/Estagio) | Ausente | Expandir card funcionarios |
| Grafico Custo Pessoal (6 meses) | Ausente | Adicionar recharts barras |
| Secao "Ultimas Movimentacoes" | Ausente | Query funcionarios_historico |
| Secao "Vencimentos Proximos" | Parcial | Expandir com ASO, CNH, contratos |

**Implementacao:**
- Adicionar card "Folha do Mes" com query somando `total_proventos` do mes atual
- Criar componente `GraficoCustoPessoal` com recharts (6 ultimos meses)
- Adicionar secao "Movimentacoes" listando ultimas 5 entradas do historico
- Expandir cards com sub-informacoes (ex: "CLT: 38 | PJ: 5 | Estagio: 2")

### 1.2 Modal de Desligamento (NOVO)

**Criar:** `src/components/rh/DesligamentoModal.tsx`

Este e um gap critico - nao existe fluxo de desligamento no sistema.

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| Tipo desligamento | Sim | Pedido, Sem justa causa, Com justa causa, Acordo |
| Data desligamento | Sim | Ultimo dia de trabalho |
| Aviso previo | Condicional | Trabalhado, Indenizado, Dispensado |
| Motivo detalhado | Sim | Texto livre |
| Carta demissao | Se pedido | Upload documento |

**Checklist automatico:**
- ASO demissional
- Devolucao equipamentos (crachá, notebook, celular)
- Revogacao acessos
- TRCT gerado
- Pagamento agendado

**Calculo de Rescisao:**
- Saldo de salario
- Ferias vencidas + 1/3
- Ferias proporcionais + 1/3
- 13o proporcional
- Aviso previo indenizado (se aplicavel)
- Multa FGTS 40% (se sem justa causa)

### 1.3 Formulario de Admissao em Wizard

**Arquivo:** `src/pages/rh/FuncionarioForm.tsx`

Transformar formulario atual em wizard de 5 etapas conforme PDF:

| Etapa | Campos |
|-------|--------|
| 1. Dados Pessoais | Nome, CPF, RG, Nascimento, Endereco |
| 2. Contrato | Admissao, Tipo, Experiencia (45/90d), Depto, Cargo, Gestor |
| 3. Remuneracao | Salario, Adicionais, Dados bancarios |
| 4. Beneficios | VT, VR, VA, Plano Saude, Odonto (checkboxes) |
| 5. Confirmacao | Resumo + Opcoes (criar acesso, gerar docs, email boas-vindas) |

**Acoes pos-admissao automaticas:**
- Gerar matricula sequencial (F001, F002...)
- Criar usuario no sistema (opcional)
- Gerar documentos: Contrato, Ficha Registro, Termo Confidencialidade
- Notificar gestor imediato

---

## FASE 2 - IMPORTANTE

### 2.1 Modulo Treinamentos (NOVO)

**Criar:** `src/pages/rh/Treinamentos.tsx`

Modulo completamente novo conforme PDF.

**Estrutura:**
- Lista de treinamentos com KPIs (ativos, participantes, horas/func)
- CRUD de treinamentos
- Inscricao de participantes
- Controle de presenca e notas

**Campos do treinamento:**
| Campo | Descricao |
|-------|-----------|
| Nome | Titulo do treinamento |
| Tipo | Obrigatorio, Capacitacao, Desenvolvimento |
| Modalidade | Presencial, Online, Hibrido |
| Data/Hora | Inicio e fim |
| Carga horaria | Total de horas |
| Instrutor | Interno ou externo |
| Participantes | Lista de funcionarios |
| Status | Planejado, Programado, Em andamento, Concluido |

**Tabelas necessarias:**
```sql
CREATE TABLE treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- obrigatorio, capacitacao, desenvolvimento
  modalidade VARCHAR(50) NOT NULL, -- presencial, online, hibrido
  data_inicio DATE,
  data_fim DATE,
  carga_horaria INTEGER,
  instrutor_nome VARCHAR(255),
  instrutor_tipo VARCHAR(50), -- interno, externo
  local TEXT,
  link_online TEXT,
  conteudo TEXT,
  status VARCHAR(50) DEFAULT 'planejado',
  valor_investimento DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE treinamentos_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id UUID REFERENCES treinamentos(id),
  funcionario_id UUID REFERENCES funcionarios(id),
  status VARCHAR(50) DEFAULT 'inscrito', -- inscrito, presente, ausente, aprovado, reprovado
  nota DECIMAL(5,2),
  certificado_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 Modulo Recrutamento (NOVO)

**Criar:** `src/pages/rh/Recrutamento.tsx`

Kanban de vagas conforme PDF.

**Colunas do Kanban:**
1. Triagem
2. Entrevista RH
3. Entrevista Gestor
4. Proposta
5. Contratado

**Campos da vaga:**
| Campo | Descricao |
|-------|-----------|
| Titulo | Nome da vaga |
| Departamento | Qual area |
| Cargo | Cargo pretendido |
| Quantidade | Numero de vagas |
| Tipo | CLT, PJ, Estagio |
| Faixa salarial | Min e Max |
| Requisitos | Formacao, experiencia |
| Atividades | Descricao das funcoes |
| Status | Aberta, Em andamento, Encerrada |

**Tabelas necessarias:**
```sql
CREATE TABLE vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(255) NOT NULL,
  departamento_id UUID REFERENCES departamentos(id),
  cargo_id UUID REFERENCES cargos(id),
  quantidade INTEGER DEFAULT 1,
  tipo_contrato VARCHAR(50),
  salario_min DECIMAL(12,2),
  salario_max DECIMAL(12,2),
  requisitos TEXT,
  atividades TEXT,
  status VARCHAR(50) DEFAULT 'aberta',
  urgencia VARCHAR(50) DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga_id UUID REFERENCES vagas(id),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(20),
  curriculo_url TEXT,
  etapa VARCHAR(50) DEFAULT 'triagem',
  avaliacao_rh TEXT,
  avaliacao_gestor TEXT,
  status VARCHAR(50) DEFAULT 'ativo',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 Beneficios - Resumo Mensal

**Arquivo:** `src/pages/rh/Beneficios.tsx`

Adicionar conforme PDF:
- Card resumo mensal (Total beneficios, Custo per capita, % sobre folha)
- Detalhamento VT por funcionario com linhas e valores
- Gerenciamento de dependentes para plano saude

---

## FASE 3 - MELHORIAS

### 3.1 Lista de Funcionarios

**Arquivo:** `src/pages/rh/FuncionariosList.tsx`

| Item PDF | Acao |
|----------|------|
| Coluna Matricula | Adicionar apos foto |
| Filtro por Cargo | Adicionar dropdown |
| Filtro por Periodo Admissao | Adicionar date range |
| Acoes em Lote | Checkbox + barra acoes (Exportar, Comunicado) |
| Cards resumo (Passivos R$) | Adicionar valores monetarios |

### 3.2 Ficha do Funcionario

**Arquivo:** `src/pages/rh/FuncionarioDetalhe.tsx`

| Item PDF | Acao |
|----------|------|
| Aba Ferias completa | Periodo aquisitivo, saldo, historico, proximas |
| Historico salarial | Listar mudancas de salario com motivo |
| Ultimo holerite | Link para visualizar/baixar |
| Nome social | Adicionar campo |
| Email corporativo | Adicionar campo |

### 3.3 Cargos e Departamentos

**Arquivo:** `src/pages/rh/DepartamentosCargos.tsx`

**Departamentos - campos novos:**
- Codigo (ADM, OPE, COM)
- Responsavel (funcionario gestor)
- Centro de custo

**Cargos - campos novos:**
- Faixa salarial (min e max)
- Requisitos (formacao, experiencia)
- Descricao de atividades

### 3.4 Folha de Pagamento

**Arquivo:** `src/pages/rh/FolhaPagamento.tsx`

| Item PDF | Acao |
|----------|------|
| Card Encargos | Adicionar (INSS patronal + FGTS) |
| Totalizadores detalhados | Por rubrica (salarios, HE, VT, etc) |
| Status aprovacao | Rascunho > Calculado > Conferido > Aprovado > Pago |
| Botao Aprovar Folha | Para diretoria |
| Enviar holerites por email | Botao com confirmacao |

### 3.5 Controle de Ponto

**Arquivo:** `src/pages/rh/ControlePonto.tsx`

| Item PDF | Acao |
|----------|------|
| Importacao de arquivo | AFD, TXT, CSV, Excel |
| Banco de horas | Saldo acumulado |
| Ajuste com anexo | Upload de comprovante |
| Espelho detalhado | Colunas entrada/saida |

### 3.6 Gestao de Ferias

**Arquivo:** `src/pages/rh/FeriasGestao.tsx`

| Item PDF | Acao |
|----------|------|
| Previa de valores | Calcular ferias + 1/3, abono, descontos |
| Fracionamento | Permitir dividir em 2 ou 3 periodos |
| Verificacao conflitos | Alertar se outros do setor em ferias |
| Status completo | Solicitada > Aprovada > Em Gozo > Concluida |

---

## COMPONENTES A CRIAR

| Componente | Descricao |
|------------|-----------|
| `DesligamentoModal.tsx` | Modal completo de desligamento |
| `AdmissaoWizard.tsx` | Wizard de admissao em 5 etapas |
| `GraficoCustoPessoal.tsx` | Grafico barras 6 meses |
| `MovimentacoesTimeline.tsx` | Timeline ultimas movimentacoes |
| `TreinamentoCard.tsx` | Card de treinamento |
| `TreinamentoFormModal.tsx` | Modal CRUD treinamento |
| `VagaKanban.tsx` | Kanban de recrutamento |
| `VagaFormModal.tsx` | Modal CRUD vaga |
| `CandidatoCard.tsx` | Card de candidato no kanban |
| `CalculoRescisaoModal.tsx` | Previa de calculo rescisao |
| `PreviaFeriasCard.tsx` | Calculo valores ferias |

---

## ARQUIVOS A MODIFICAR

| Arquivo | Modificacoes |
|---------|-------------|
| `src/pages/rh/RHDashboard.tsx` | Cards expandidos, graficos, movimentacoes |
| `src/pages/rh/FuncionariosList.tsx` | Matricula, filtros, acoes lote |
| `src/pages/rh/FuncionarioDetalhe.tsx` | Aba ferias, historico salarial |
| `src/pages/rh/FuncionarioForm.tsx` | Transformar em wizard |
| `src/pages/rh/FolhaPagamento.tsx` | Encargos, totalizadores, aprovacao |
| `src/pages/rh/FeriasGestao.tsx` | Previa valores, fracionamento |
| `src/pages/rh/Beneficios.tsx` | Resumo mensal, dependentes |
| `src/pages/rh/ControlePonto.tsx` | Importacao, banco horas |
| `src/pages/rh/DepartamentosCargos.tsx` | Campos novos |

---

## ARQUIVOS A CRIAR

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/rh/Treinamentos.tsx` | Pagina lista treinamentos |
| `src/pages/rh/TreinamentoDetalhe.tsx` | Detalhes e participantes |
| `src/pages/rh/Recrutamento.tsx` | Kanban de vagas |
| `src/pages/rh/VagaDetalhe.tsx` | Detalhes vaga e candidatos |
| `src/components/rh/DesligamentoModal.tsx` | Modal desligamento |
| `src/components/rh/CalculoRescisaoCard.tsx` | Preview rescisao |
| `src/components/rh/TreinamentoFormModal.tsx` | CRUD treinamento |
| `src/components/rh/VagaFormModal.tsx` | CRUD vaga |

---

## DETALHES TECNICOS

### Novas Tabelas Supabase

```sql
-- Treinamentos
CREATE TABLE treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  modalidade VARCHAR(50) NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  carga_horaria INTEGER,
  instrutor_nome VARCHAR(255),
  instrutor_tipo VARCHAR(50),
  local TEXT,
  link_online TEXT,
  conteudo TEXT,
  status VARCHAR(50) DEFAULT 'planejado',
  valor_investimento DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE treinamentos_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id UUID REFERENCES treinamentos(id) ON DELETE CASCADE,
  funcionario_id UUID REFERENCES funcionarios(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'inscrito',
  nota DECIMAL(5,2),
  certificado_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(treinamento_id, funcionario_id)
);

-- Recrutamento
CREATE TABLE vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20),
  titulo VARCHAR(255) NOT NULL,
  departamento_id UUID REFERENCES departamentos(id),
  cargo_id UUID REFERENCES cargos(id),
  quantidade INTEGER DEFAULT 1,
  tipo_contrato VARCHAR(50),
  salario_min DECIMAL(12,2),
  salario_max DECIMAL(12,2),
  requisitos TEXT,
  atividades TEXT,
  beneficios TEXT,
  status VARCHAR(50) DEFAULT 'aberta',
  urgencia VARCHAR(50) DEFAULT 'normal',
  publicado_em TIMESTAMP,
  encerrado_em TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga_id UUID REFERENCES vagas(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(20),
  curriculo_url TEXT,
  linkedin_url TEXT,
  etapa VARCHAR(50) DEFAULT 'triagem',
  avaliacao_rh TEXT,
  nota_rh INTEGER,
  avaliacao_gestor TEXT,
  nota_gestor INTEGER,
  status VARCHAR(50) DEFAULT 'ativo',
  motivo_recusa TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Calculo de Rescisao (Funcao)

```typescript
function calcularRescisao(
  tipoDesligamento: 'pedido' | 'sem_justa_causa' | 'justa_causa' | 'acordo',
  salario: number,
  diasTrabalhados: number,
  mesesFerias: number,
  feriasVencidas: number,
  meses13: number,
  saldoFgts: number
) {
  const saldoSalario = (salario / 30) * diasTrabalhados;
  const feriasProporcionais = (salario / 12) * mesesFerias * 1.333;
  const feriasVencidasValor = feriasVencidas * salario * 1.333;
  const decimoTerceiro = (salario / 12) * meses13;
  
  let avisoIndenizado = 0;
  let multaFgts = 0;
  
  if (tipoDesligamento === 'sem_justa_causa') {
    avisoIndenizado = salario;
    multaFgts = saldoFgts * 0.40;
  } else if (tipoDesligamento === 'acordo') {
    avisoIndenizado = salario * 0.5;
    multaFgts = saldoFgts * 0.20;
  }
  
  const totalBruto = saldoSalario + feriasProporcionais + feriasVencidasValor + decimoTerceiro + avisoIndenizado;
  const inss = calcularINSS(totalBruto);
  const irrf = calcularIRRF(totalBruto - inss);
  
  return {
    saldoSalario,
    feriasProporcionais,
    feriasVencidasValor,
    decimoTerceiro,
    avisoIndenizado,
    totalBruto,
    inss,
    irrf,
    totalLiquido: totalBruto - inss - irrf,
    multaFgts,
    totalFgts: saldoFgts + multaFgts
  };
}
```

---

## PRIORIDADES DE IMPLEMENTACAO

### Fase 1 - Essencial (Esta sessao)
1. Dashboard: Cards expandidos + grafico custos + movimentacoes
2. Desligamento: Modal completo com calculo rescisao
3. Admissao: Transformar form em wizard 5 etapas

### Fase 2 - Modulos Novos
1. Treinamentos: Tabelas + CRUD + lista + participantes
2. Recrutamento: Tabelas + Kanban + vagas + candidatos

### Fase 3 - Melhorias
1. Funcionarios: Lista e Ficha expandidas
2. Folha: Encargos e aprovacao
3. Ferias: Previa valores e fracionamento
4. Beneficios: Resumo mensal
5. Ponto: Importacao e banco horas

---

## INTEGRACAO ENTRE MODULOS

### RH -> FINANCEIRO
| Evento RH | Acao Financeiro |
|-----------|-----------------|
| Folha aprovada | Criar contas a pagar (salarios, INSS, FGTS) |
| Rescisao calculada | Criar conta a pagar especifica |
| Ferias aprovadas | Criar conta a pagar (2 dias antes) |
| Beneficios do mes | Criar contas a pagar por fornecedor |

### RH -> JURIDICO
| Evento RH | Acao Juridico |
|-----------|---------------|
| Desligamento sem justa causa | Alerta possivel reclamatoria |
| Desligamento justa causa | Revisao documentacao |
| Acidente de trabalho | Acompanhamento CAT |

### RH -> USUARIOS (Estrutura Base)
| Evento RH | Acao Sistema |
|-----------|--------------|
| Admissao com acesso | Criar usuario + definir perfil |
| Desligamento | Inativar usuario + revogar acessos |
