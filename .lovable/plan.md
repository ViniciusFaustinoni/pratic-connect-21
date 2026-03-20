

# Plano: Nova Aba "Instalação e Rotas" em Regras de Venda

## Estado Atual

- **Tab Navigation**: `TabNavigation.tsx` tem 6 abas (índice 0-5). A aba 6 será "Instalação e Rotas".
- **Valores hardcoded encontrados**:
  - `RotaModal.tsx` L138: `inicioMinutos = 8 * 60 + 30` (08:30 fixo)
  - `RotaModal.tsx` L139: `minutosDecorridos = idx * 90` (90 min fixo por tarefa)
  - `InstalacaoFilters.tsx` L89-98: regiões hardcoded (SP Centro, Zona Sul, etc.)
  - Não encontrei limite de 6 instalações por dia explícito no código, mas será criado como config
  - Custo fora do horário (R$ 50) não está no código atual — será criado
  - Prazos de instalação por estado não existem

## Implementação

### 1. Migration: inserir configs na tabela `configuracoes`

Inserir as seguintes chaves com valores padrão:
- `instalacao_max_por_dia` → `6`
- `instalacao_horario_inicio` → `08:30`
- `instalacao_tempo_medio_minutos` → `90`
- `instalacao_custo_fora_horario` → `50`
- `instalacao_prazos_por_estado` → JSON: `[{"estado":"RJ","prazo_horas":48},{"estado":"SP","prazo_horas":72}]`
- `instalacao_regioes_rotas` → JSON: `[{"value":"sp_centro","label":"São Paulo - Centro","ativa":true},{"value":"sp_zona_sul","label":"São Paulo - Zona Sul","ativa":true},{"value":"sp_zona_norte","label":"São Paulo - Zona Norte","ativa":true},{"value":"sp_zona_oeste","label":"São Paulo - Zona Oeste","ativa":true},{"value":"campinas","label":"Campinas","ativa":true},{"value":"abc","label":"ABC Paulista","ativa":true},{"value":"interior","label":"Interior","ativa":true},{"value":"litoral","label":"Litoral","ativa":true}]`

### 2. Nova aba na `TabNavigation.tsx`

Adicionar `{ label: 'Instalação e Rotas', icon: MapPin }` (índice 6).

### 3. Novo componente: `InstalacaoRotasConfig.tsx`

Componente com 4 blocos em Cards, seguindo o padrão visual do `RegrasVendaContent`:

**Bloco 1 — Capacidade dos Instaladores**
- Campo numérico: "Máx. instalações por dia" (default 6)
- Campo time: "Horário de início das rotas" (default 08:30)
- Campo numérico: "Tempo médio por instalação (min)" (default 90)
- Botão "Salvar" por bloco

**Bloco 2 — Prazos por Estado**
- Tabela editável: Estado + Prazo (horas úteis)
- Botão "Adicionar estado"
- Pré-configurado: RJ (48h) e SP (72h)
- Botão "Salvar"

**Bloco 3 — Custo Fora do Horário**
- Campo monetário: "Valor do repasse (R$)" (default 50)
- Botão "Salvar"

**Bloco 4 — Regiões de Atendimento**
- Lista com nome e toggle ativo/inativo
- Botão adicionar nova região (value + label)
- Botão "Salvar"

Cada bloco ao salvar grava na `configuracoes` via upsert e registra log de auditoria (insert em tabela `configuracoes_log` ou campo `updated_at` + `updated_by`).

### 4. Registrar na `GestaoComercial.tsx`

Adicionar `{activeTab === 6 && <InstalacaoRotasConfig />}`.

### 5. Log de auditoria

Usar a coluna `updated_at` já existente em `configuracoes`. Para registrar "quem", adicionar migration com coluna `updated_by uuid` na tabela `configuracoes` (se não existir). Exibir "Última alteração" abaixo de cada bloco.

## Arquivos afetados

- Migration SQL (INSERT configs + ADD COLUMN `updated_by`)
- `src/components/gestao-comercial/TabNavigation.tsx` — nova aba
- `src/components/gestao-comercial/InstalacaoRotasConfig.tsx` — novo componente
- `src/pages/diretoria/GestaoComercial.tsx` — renderizar aba 6

## O que NÃO será alterado

- Nenhuma tela de Monitoramento será modificada
- As 6 abas existentes permanecem intactas

