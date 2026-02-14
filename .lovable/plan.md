
# Revisao: Modulo de Fornecedores (Oficinas, Auto Centers, Prestadores)

## Resultado da Revisao

O sistema esta **~40% conforme** com os requisitos. A estrutura basica de Oficinas e Auto Centers existe, mas faltam campos fundamentais e o terceiro tipo (Prestadores de Oficina) nao existe.

---

## O QUE ESTA CONFORME

| Requisito | Status | Onde |
|---|---|---|
| Cadastro de Oficinas (dados basicos) | OK | `oficinas` table + `OficinaFormDialog.tsx` |
| Cadastro de Auto Centers (dados basicos) | OK | `auto_centers` table + `AutoCenterFormDialog.tsx` |
| Menu lateral com Oficinas e Auto Centers | OK | `AppSidebar.tsx` linhas 231-233 |
| Listagem de oficinas com filtros | OK | `Oficinas.tsx` |
| Listagem de auto centers com filtros | OK | `AutoCenters.tsx` |
| Drawer de detalhes para ambos | OK | `OficinaDetailDrawer.tsx`, `AutoCenterDetailDrawer.tsx` |

---

## PROBLEMAS IDENTIFICADOS

### 1. CRITICO: Campo `marcas_atendidas` NAO EXISTE em nenhuma tabela

Nenhuma das tabelas (`oficinas`, `auto_centers`) possui o campo `marcas_atendidas`. Este campo e fundamental para o fluxo de eventos — sem ele, o sistema nao consegue filtrar fornecedores pela marca do veiculo sinistrado.

**Tabela `oficinas`:** tem `especialidades` (array) mas nao `marcas_atendidas`.
**Tabela `auto_centers`:** nao tem nem `especialidades` nem `marcas_atendidas`.

### 2. CRITICO: Tabela de Prestadores (de oficina/evento) NAO EXISTE

Existe uma tabela `prestadores_assistencia` que e para o modulo de Assistencia 24h (guincho, socorro, etc.) — isso e algo completamente diferente dos Prestadores de servicos especializados para eventos (vidros, eletrica, polimento). A tabela para esse novo tipo de prestador nao foi criada.

### 3. MEDIO: Auto Centers tem estrutura simplificada demais

A tabela `auto_centers` tem campos basicos (nome, endereco, contato simples) mas falta:
- `cnpj`, `razao_social`, `nome_fantasia` (estrutura empresarial)
- `whatsapp` (obrigatorio — a IA envia cotacoes por WhatsApp)
- `especialidades` (array)
- `marcas_atendidas` (array)
- Dados bancarios (`banco`, `agencia`, `conta`, `pix_chave`, `pix_tipo`)

### 4. MEDIO: Formularios nao tem selecao de Marcas e Especialidades

- `OficinaFormDialog.tsx` submete `especialidades: []` hard-coded (linha 124) — nao ha UI para selecionar especialidades
- `AutoCenterFormDialog.tsx` nao tem campos de especialidades nem marcas
- Nenhum formulario tem selecao multipla com checkboxes para marcas

### 5. MENOR: Submenu "Prestadores" no menu nao existe

O sidebar tem "Oficinas" e "Auto Centers" mas nao tem submenu para Prestadores de evento. O "Prestadores" que aparece no sidebar e do modulo Assistencia 24h (rota `/assistencia/prestadores`).

### 6. MENOR: Listagens nao mostram badges de marcas/especialidades

Nem `Oficinas.tsx` nem `AutoCenters.tsx` exibem badges de marcas atendidas (campo inexistente) e oficinas exibem especialidades de forma limitada.

---

## PLANO DE CORRECAO

### Etapa 1 — Schema do banco de dados

**1a. Adicionar `marcas_atendidas` a `oficinas`:**
```text
ALTER TABLE oficinas ADD COLUMN marcas_atendidas text[] DEFAULT '{}';
```

**1b. Reestruturar `auto_centers` para ter campos completos:**
```text
ALTER TABLE auto_centers
  ADD COLUMN razao_social varchar,
  ADD COLUMN nome_fantasia varchar,
  ADD COLUMN cnpj varchar,
  ADD COLUMN whatsapp varchar,
  ADD COLUMN telefone varchar,
  ADD COLUMN email varchar,
  ADD COLUMN logradouro varchar,
  ADD COLUMN numero varchar,
  ADD COLUMN complemento varchar,
  ADD COLUMN bairro varchar,
  ADD COLUMN banco varchar,
  ADD COLUMN agencia varchar,
  ADD COLUMN conta varchar,
  ADD COLUMN pix_chave varchar,
  ADD COLUMN pix_tipo varchar,
  ADD COLUMN especialidades text[] DEFAULT '{}',
  ADD COLUMN marcas_atendidas text[] DEFAULT '{}',
  ADD COLUMN status varchar DEFAULT 'ativo';
```

**1c. Criar tabela `prestadores_evento`:**
Nova tabela com a mesma estrutura das oficinas: razao_social, nome_fantasia, cnpj, contato, endereco, dados bancarios, especialidades, marcas_atendidas, status.

### Etapa 2 — Componente reutilizavel de selecao de Marcas e Especialidades

Criar dois componentes compartilhados:
- `MarcasAtendidas.tsx` — checkboxes com busca + checkbox especial "GLOBAL" que desabilita os demais
- `EspecialidadesSelect.tsx` — checkboxes com a lista completa de 16 especialidades

Esses componentes serao usados nos 3 formularios (oficinas, auto centers, prestadores).

### Etapa 3 — Atualizar formularios existentes

- `OficinaFormDialog.tsx` — adicionar selecao de Marcas Atendidas e usar o array de especialidades real em vez do `[]` hard-coded
- `AutoCenterFormDialog.tsx` — expandir com todos os campos (razao_social, cnpj, whatsapp obrigatorio, dados bancarios, marcas, especialidades)

### Etapa 4 — Criar pagina e componentes de Prestadores de Evento

- `src/pages/oficinas/Prestadores.tsx` — listagem com filtros por marca e especialidade
- `src/components/oficinas/PrestadorFormDialog.tsx` — formulario reutilizando a mesma estrutura
- `src/components/oficinas/PrestadorDetailDrawer.tsx` — drawer de detalhes

### Etapa 5 — Atualizar navegacao

- Adicionar submenu "Prestadores" no sidebar abaixo de "Auto Centers" (rota `/oficinas/prestadores`)
- Adicionar rota no router
- Atualizar breadcrumbs

### Etapa 6 — Atualizar listagens com badges

- Em `Oficinas.tsx`, `AutoCenters.tsx` e `Prestadores.tsx`: exibir badges de marcas atendidas e especialidades nos cards
- Adicionar filtros por marca e por especialidade nas listagens

### Etapa 7 — Hooks de dados

- Atualizar `useOficinas.ts` para suportar filtro por marca
- Atualizar `useAutoCenters.ts` com novos campos e filtro por marca/especialidade
- Criar `usePrestadoresEvento.ts` (hooks CRUD para a nova tabela)

---

## Arquivos a serem criados/modificados

| Acao | Arquivo |
|---|---|
| Migration SQL | Nova migracao para `marcas_atendidas`, `auto_centers` expandido, `prestadores_evento` |
| Criar | `src/components/oficinas/MarcasAtendidasSelect.tsx` |
| Criar | `src/components/oficinas/EspecialidadesSelect.tsx` |
| Criar | `src/pages/oficinas/Prestadores.tsx` |
| Criar | `src/components/oficinas/PrestadorFormDialog.tsx` |
| Criar | `src/components/oficinas/PrestadorDetailDrawer.tsx` |
| Criar | `src/hooks/usePrestadoresEvento.ts` |
| Modificar | `src/components/oficinas/OficinaFormDialog.tsx` (adicionar marcas + especialidades) |
| Modificar | `src/components/oficinas/AutoCenterFormDialog.tsx` (expandir campos) |
| Modificar | `src/hooks/useOficinas.ts` (filtro por marca) |
| Modificar | `src/hooks/useAutoCenters.ts` (novos campos, filtros) |
| Modificar | `src/pages/oficinas/Oficinas.tsx` (badges, filtro marca) |
| Modificar | `src/pages/oficinas/AutoCenters.tsx` (badges, filtro marca) |
| Modificar | `src/components/layout/AppSidebar.tsx` (submenu Prestadores) |
| Modificar | Router (nova rota `/oficinas/prestadores`) |
