
# Plano de Revisao Completa: Recursos Humanos e Marketing

## Diagnostico Geral

### Status do Banco de Dados
| Tabela | Registros |
|--------|-----------|
| funcionarios | 0 |
| departamentos | 0 |
| cargos | 0 |
| ferias | 0 |
| folha_pagamento | 0 |
| ponto_registros | 0 |
| campanhas | 0 |
| canais_marketing | 0 |
| indicacoes | 0 |
| utms | 0 |

### Conclusao Principal
**NAO HA DADOS MOCK** - Todas as paginas de ambos os modulos estao corretamente conectadas ao Supabase com queries reais. Os dados vem do banco de dados (atualmente vazio).

---

# AREA 1: RECURSOS HUMANOS

## O que esta funcionando corretamente
- **Dashboard**: KPIs reais (funcionarios ativos, ferias, afastados, admissoes)
- **FuncionariosList**: CRUD completo, filtros, visualizacao lista/cards
- **FuncionarioDetalhe**: Visualizacao e edicao de funcionarios
- **FeriasGestao**: Solicitacao, aprovacao/rejeicao, calendario, relatorios
- **ControlePonto**: Visualizacao e edicao de registros, aprovacao
- **FolhaPagamento**: Calculo automatico de INSS/IRRF, visualizacao de holerite
- **Organograma**: Hierarquia em arvore e lista por departamento

## Problemas Identificados

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 1 | Botao "Registrar Ponto" sem onClick | ControlePonto.tsx | Nao e possivel criar novos registros manualmente |
| 2 | Botao "Novo Beneficio" desabilitado | Beneficios.tsx | Nao e possivel cadastrar beneficios |
| 3 | Botoes Edit/View em Beneficios desabilitados | Beneficios.tsx | Nao e possivel gerenciar beneficios existentes |
| 4 | Botao "Novo Departamento" desabilitado | DepartamentosCargos.tsx | Nao e possivel criar departamentos |
| 5 | Botao "Novo Cargo" desabilitado | DepartamentosCargos.tsx | Nao e possivel criar cargos |
| 6 | Botoes Edit/Delete em Dept/Cargos desabilitados | DepartamentosCargos.tsx | Nao e possivel gerenciar existentes |
| 7 | Botao "Exportar" em FolhaPagamento desabilitado | FolhaPagamento.tsx | Nao e possivel exportar folha |
| 8 | Botao "Exportar" em Organograma desabilitado | Organograma.tsx | Nao e possivel exportar organograma |

---

## Correcoes Necessarias - RH

### 1. ControlePonto - Criar RegistrarPontoModal

**Novo arquivo**: `src/components/rh/RegistrarPontoModal.tsx`

Modal para registrar novo ponto com campos:
- Funcionario (combobox)
- Data
- Entrada 1 / Saida 1 / Entrada 2 / Saida 2
- Tipo do dia (normal, feriado, folga, etc)
- Justificativa

**Alterar**: `src/pages/rh/ControlePonto.tsx`
- Adicionar state e onClick no botao "Registrar Ponto"
- Importar e renderizar modal

### 2. Beneficios - Criar BeneficioFormModal

**Novo arquivo**: `src/components/rh/BeneficioFormModal.tsx`

Modal para criar/editar beneficio com campos:
- Nome
- Tipo (select: vale_transporte, vale_refeicao, plano_saude, etc)
- Fornecedor
- Valor Empresa
- Valor Funcionario
- Ativo

**Alterar**: `src/pages/rh/Beneficios.tsx`
- Remover `disabled` dos botoes
- Adicionar states para modal
- Conectar botoes aos handlers
- Adicionar mutations para criar/atualizar/visualizar

### 3. DepartamentosCargos - Criar Modais

**Novo arquivo**: `src/components/rh/DepartamentoFormModal.tsx`
- Nome, Descricao, Ativo

**Novo arquivo**: `src/components/rh/CargoFormModal.tsx`
- Nome, Departamento (select), Nivel, CBO, Salario Base, Ativo

**Alterar**: `src/pages/rh/DepartamentosCargos.tsx`
- Remover `disabled` de todos os botoes
- Adicionar states e handlers
- Adicionar mutations

### 4. FolhaPagamento - Implementar Exportacao

**Alterar**: `src/pages/rh/FolhaPagamento.tsx`
- Criar funcao `handleExportarFolha`
- Usar jsPDF para gerar PDF com dados da folha
- Incluir opcao CSV

### 5. Organograma - Implementar Exportacao

**Alterar**: `src/pages/rh/Organograma.tsx`
- Criar funcao `handleExportarOrganograma`
- Exportar lista de funcionarios em CSV/PDF

---

# AREA 2: MARKETING

## O que esta funcionando corretamente
- **Dashboard**: KPIs reais (leads, conversoes, taxa, investimento, CPL, indicacoes)
- **Campanhas**: CRUD completo, filtros, ativar/pausar
- **Canais**: CRUD completo, ativar/desativar, performance
- **Indicacoes**: CRUD completo, recompensar, ranking
- **UTMs**: Gerador funcional, copiar, salvar
- **Modais**: CampanhaFormDialog, CanalFormDialog, IndicacaoFormDialog - todos funcionais

## Problemas Identificados

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 1 | Botao "Configurar Programa" navega para rota inexistente | Indicacoes.tsx | Erro 404 |
| 2 | Falta verificar CampanhaDetalhe | CampanhaDetalhe.tsx | Possivel botoes quebrados |
| 3 | Falta verificar RelatoriosMarketing | RelatoriosMarketing.tsx | Possivel botoes quebrados |

---

## Correcoes Necessarias - Marketing

### 1. Indicacoes - Configurar Programa

**Opcao A**: Criar rota `/marketing/programa` com pagina de configuracao
**Opcao B (recomendada)**: Criar modal `ConfigurarProgramaModal` e trocar navegacao por abertura de modal

**Novo arquivo**: `src/components/marketing/ConfigurarProgramaModal.tsx`
- Nome do programa
- Valor da recompensa ao indicador
- Condicao de pagamento (select)
- Prazo de validade
- Limite de indicacoes/mes

**Alterar**: `src/pages/marketing/Indicacoes.tsx`
- Importar ConfigurarProgramaModal
- Trocar `navigate('/marketing/programa')` por `setShowConfigModal(true)`

### 2. Verificar e Corrigir CampanhaDetalhe

Verificar se todos os botoes estao conectados:
- Editar campanha
- Pausar/Ativar
- Registrar metricas
- Upload de materiais

### 3. Verificar RelatoriosMarketing

Verificar funcionalidades de exportacao e filtros.

---

## Resumo das Alteracoes

### Recursos Humanos (7 arquivos)

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/components/rh/RegistrarPontoModal.tsx` | **Novo** | Modal para registrar ponto |
| `src/components/rh/BeneficioFormModal.tsx` | **Novo** | Modal para CRUD de beneficios |
| `src/components/rh/DepartamentoFormModal.tsx` | **Novo** | Modal para CRUD de departamentos |
| `src/components/rh/CargoFormModal.tsx` | **Novo** | Modal para CRUD de cargos |
| `src/pages/rh/ControlePonto.tsx` | Modificar | Conectar botao ao modal |
| `src/pages/rh/Beneficios.tsx` | Modificar | Habilitar e conectar botoes |
| `src/pages/rh/DepartamentosCargos.tsx` | Modificar | Habilitar e conectar botoes |
| `src/pages/rh/FolhaPagamento.tsx` | Modificar | Implementar exportacao |
| `src/pages/rh/Organograma.tsx` | Modificar | Implementar exportacao |

### Marketing (3 arquivos)

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/components/marketing/ConfigurarProgramaModal.tsx` | **Novo** | Modal para configurar programa de indicacoes |
| `src/pages/marketing/Indicacoes.tsx` | Modificar | Trocar navegacao por modal |
| `src/pages/marketing/CampanhaDetalhe.tsx` | Verificar | Garantir botoes funcionais |

---

## Integracoes Existentes (NAO MEXER)

### RH:
- Funcionarios vinculados a Departamentos e Cargos
- Ferias vinculadas a Funcionarios
- Folha vinculada a Funcionarios
- Ponto vinculado a Funcionarios
- Beneficios vinculados a Funcionarios (funcionarios_beneficios)

### Marketing:
- Campanhas vinculadas a Canais
- Indicacoes vinculadas a Associados e Leads
- UTMs vinculadas a Campanhas
- Metricas vinculadas a Campanhas

**Nao e necessario alterar outras areas do sistema.**

---

## Verificacao Pos-Implementacao

### RH:
1. Criar departamento de teste
2. Criar cargo de teste
3. Criar funcionario de teste
4. Registrar ponto para funcionario
5. Solicitar e aprovar ferias
6. Calcular folha de pagamento
7. Cadastrar beneficio
8. Exportar folha em PDF

### Marketing:
1. Criar canal de marketing
2. Criar campanha vinculada ao canal
3. Registrar indicacao
4. Converter indicacao e pagar recompensa
5. Gerar UTM vinculada a campanha
6. Configurar programa de indicacoes
