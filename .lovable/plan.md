
# Gestao de Advogados — Lista Expandida, Formulario e Perfil Individual

## Resumo

Expandir a pagina de advogados existente (`AdvogadosList.tsx`) com 4 KPI cards no topo e colunas extras (pareceres mes, proximo prazo), criar formulario de cadastro/edicao (`AdvogadoForm.tsx`) e perfil individual completo (`AdvogadoDetalhe.tsx`) com KPIs, processos atribuidos, prazos, audiencias e historico de desempenho.

## Nenhuma Migracao Necessaria

A tabela `advogados` ja possui todas as colunas necessarias: tipo, nome, cpf_cnpj, oab, oab_estado, email, telefone, whatsapp, endereco completo, especialidades (array), banco/agencia/conta/pix, tipo_contrato, valor_fixo, percentual_exito, ativo. Os dados de processos, prazos e audiencias ja existem em tabelas separadas.

## Arquivos a Criar

### 1. `src/pages/juridico/AdvogadoForm.tsx` (novo)

Formulario completo de cadastro e edicao de advogado, acessivel por `/juridico/advogados/novo` e `/juridico/advogados/:id/editar`.

Secoes do formulario:

**Dados Pessoais / Escritorio:**
- Nome completo / Razao social (obrigatorio)
- Tipo: Interno ou Terceirizado (mapeando para `interno` e `externo`/`escritorio`)
- CPF ou CNPJ
- OAB: numero + seccional (estado) — dois campos lado a lado
- Telefone, Email, WhatsApp

**Endereco (colapsavel, para escritorios):**
- CEP, logradouro, numero, complemento, bairro, cidade, estado

**Especialidades (multi-select com checkboxes):**
Expandir `ESPECIALIDADES_ADVOGADO` em `juridico.ts` para incluir as novas areas pedidas:
- Seguros e Protecao Veicular (`seguros`)
- Recuperacao de Credito / Cobranca (`cobranca`)

Renderizar como grid de checkboxes (ja existe pattern no sistema).

**Informacoes Contratuais (visivel se tipo = externo ou escritorio):**
- Tipo de contratacao: por_processo, fixo (mensalista), hibrido — mapeia para `tipo_contrato`
- Valor por processo (`valor_fixo` se por_processo)
- Valor mensal (`valor_fixo` se fixo)
- Percentual de exito (`percentual_exito`)

**Conta para Pagamento (visivel se tipo = externo ou escritorio):**
- Banco, agencia, conta, chave PIX, tipo PIX

**Observacoes:** campo Textarea livre.

**Status:** Switch ativo/inativo.

Ao salvar:
- Modo criacao: usa `criarAdvogado` do hook `useAdvogados`
- Modo edicao: usa `atualizarAdvogado` do hook
- Redireciona para lista apos salvar

Usa react-hook-form com zod, seguindo o pattern do `ProcessoForm.tsx`.

### 2. `src/pages/juridico/AdvogadoDetalhe.tsx` (novo)

Pagina de perfil individual acessivel por `/juridico/advogados/:id`.

**Header:** nome, OAB, tipo (badge), status (badge), botao "Editar Cadastro" que leva ao form de edicao. Botao voltar para lista.

**4 KPI Cards:**

1. Processos Ativos — count de `processos` com `advogado_id = id` e `status = 'ativo'`
2. Pareceres este Mes — count de `consultas_juridicas` com `respondido_por = id` (ou vinculadas ao advogado) e `respondido_em` no mes corrente
3. Prazos Pendentes (30d) — count de `processos_prazos` com status `pendente` vinculados aos processos desse advogado e `data_fim` nos proximos 30 dias
4. Audiencias Agendadas (30d) — count de `processos_audiencias` com status `agendada` vinculadas aos processos desse advogado e `data_hora` nos proximos 30 dias

**Secao "Processos Atribuidos":**
Tabela com processos vinculados ao advogado: numero, tipo, status (badge), prioridade (badge), dias aberto (calculado), ultimo andamento. Filtro por status. Link para `/juridico/processos/:id`.

**Secao "Prazos":**
Lista de prazos dos processos do advogado, ordenados por data_fim asc. Badge de urgencia por cor (mesma logica do dashboard: verde > 15d, amarelo 7-15d, laranja 3-7d, vermelho < 3d, preto/vermelho se vencido). Link para processo.

**Secao "Audiencias":**
Proximas audiencias agendadas. Data/hora, tipo (badge), processo vinculado, local ou "Virtual". Destaque se hoje.

**Secao "Historico de Desempenho" (ultimos 6 meses):**
Grafico de barras com recharts mostrando processos recebidos vs finalizados por mes. Cards com:
- Tempo medio de resolucao (media de dias entre `created_at` e `data_encerramento` dos processos encerrados)
- Total finalizados no periodo

Queries: todas usam `useQuery` com queryKeys distintas, filtrando por `advogado_id`.

## Arquivos a Modificar

### 3. `src/pages/juridico/AdvogadosList.tsx`

**Adicionar 4 KPI cards no topo (antes dos filtros):**

1. "Total Ativos" — count de advogados ativos
2. "Internos" — count de advogados com tipo = 'interno'
3. "Terceirizados" — count com tipo = 'externo' ou 'escritorio'
4. "Carga Media" — media de processos ativos por advogado (total processos ativos / total advogados ativos)

Usar dados ja disponiveis de `advogados` e `contagemProcessos`.

**Expandir card de advogado** com:
- Pareceres no mes (query extra)
- Proximo prazo (query extra, com badge de urgencia se < 3 dias)

**Adicionar filtro por especialidade** — Select com opcoes de `ESPECIALIDADES_ADVOGADO`. Filtra no frontend (array includes).

**Alerta ao inativar** — nao implementado agora (nao ha toggle inline), mas o form de edicao mostrara alerta se desativar advogado com processos ativos.

### 4. `src/types/juridico.ts`

Expandir `ESPECIALIDADES_ADVOGADO` com:
```text
'seguros',
'cobranca',
```

Expandir `ESPECIALIDADE_LABELS` com:
```text
seguros: 'Seguros e Proteção Veicular',
cobranca: 'Recuperação de Crédito / Cobrança',
```

### 5. `src/App.tsx`

Adicionar 3 novas rotas:
```text
/juridico/advogados/novo -> AdvogadoForm
/juridico/advogados/:id -> AdvogadoDetalhe
/juridico/advogados/:id/editar -> AdvogadoForm
```

Importar os novos componentes.

### 6. `src/hooks/useAdvogados.ts`

Expandir `criarAdvogado` e `atualizarAdvogado` para aceitar todos os campos novos no tipo (endereco, banco, etc). Os campos ja existem na tabela — apenas o tipo TypeScript precisa ser expandido.

## Detalhes Tecnicos

- O hook `useAdvogados` ja faz CRUD basico. Apenas expandimos os tipos aceitos nas mutations.
- O hook `useAdvogado(id)` ja existe e busca um advogado por id — usado no detalhe e no form de edicao.
- Queries de processos, prazos e audiencias no perfil do advogado: filtrar `processos` por `advogado_id`, depois usar os IDs dos processos para buscar prazos e audiencias relacionados.
- O historico de desempenho usa `processos` filtrados por `advogado_id` com `created_at` nos ultimos 6 meses, agrupados por mes no frontend.
- Nenhuma dependencia nova necessaria — usa recharts, date-fns, react-hook-form, zod ja instalados.

## Ordem de Implementacao

1. Atualizar `src/types/juridico.ts` — adicionar especialidades novas
2. Atualizar `src/hooks/useAdvogados.ts` — expandir tipos das mutations
3. Criar `src/pages/juridico/AdvogadoForm.tsx` — formulario completo
4. Criar `src/pages/juridico/AdvogadoDetalhe.tsx` — perfil com KPIs, processos, prazos, audiencias, desempenho
5. Expandir `src/pages/juridico/AdvogadosList.tsx` — 4 KPI cards, filtro especialidade, dados extras nos cards
6. Atualizar `src/App.tsx` — novas rotas
