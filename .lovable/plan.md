
# Plano de Migração: Preparação do Banco para Fluxo de Retirada de Rastreadores

## 1. SITUAÇÃO ATUAL

### Estrutura Existente
- **Tabela `servicos`**: Já tem o tipo `vistoria_retirada` definido no enum `tipo_servico` desde a migração de 2025-02-06
- **Tabela `rastreadores`**: Status atual inclui 8 valores (`estoque`, `reservado`, `instalado`, `manutencao`, `reagendar_manutencao`, `retorno_base`, `triagem`, `em_analise_plataforma`, `em_garantia`, `baixado`)
- **Enum `tipo_servico`**: Já contém os 7 tipos de serviço, incluindo `vistoria_retirada`

### O que Está Faltando
Nenhuma coluna específica para retirada foi adicionada à tabela `servicos`. Atualmente, o sistema usa apenas os campos genéricos (`observacoes`, `checklist_data`, `video_360_url`, etc.) para dados de retirada.

---

## 2. MUDANÇAS NO BANCO DE DADOS

### 2.1 Adicionar Colunas à Tabela `servicos`

Será executada 1 migração SQL que adicionará 21 colunas específicas para o fluxo de retirada:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `motivo_retirada` | VARCHAR(50) | Motivo da retirada (cancelamento_voluntario, inadimplencia, exclusao_diretoria, substituicao_veiculo, busca_apreensao) |
| `sub_tipo_retirada` | VARCHAR(30) | Tipo (somente_retirada, retirada_com_nova_instalacao) |
| `tem_debitos_pendentes` | BOOLEAN | Se o associado tem débitos |
| `debitos_conferidos_por` | UUID FK → auth.users | Quem conferiu os débitos |
| `debitos_conferidos_em` | TIMESTAMPTZ | Quando foi feita a conferência |
| `multa_aplicada` | BOOLEAN | Se há multa de não devolução |
| `multa_valor` | DECIMAL(10,2) | Valor da multa (R$400,00) |
| `multa_motivo` | VARCHAR(100) | Motivo da multa |
| `multa_cobrada_em` | TIMESTAMPTZ | Quando foi cobrada |
| `multa_forma_cobranca` | VARCHAR(20) | Como será cobrada (automatica_asaas, manual_financeiro) |
| `multa_asaas_id` | VARCHAR(100) | ID da cobrança no Asaas (quando automática) |
| `localizacao_rastreador` | JSONB | Localização final do rastreador para coleta |
| `checklist_retirada` | JSONB | Itens verificados na retirada |
| `integridade_aparelho` | VARCHAR(30) | Estado físico (integro, danificado, violado, molhado) |
| `chip_presente` | BOOLEAN | Se o chip SIM estava presente |
| `fios_isolados` | BOOLEAN | Se os fios foram isolados corretamente |
| `acabamento_recolocado` | BOOLEAN | Se o acabamento do painel foi recolocado |
| `video_360_url` | VARCHAR(500) | Vídeo 360° do rastreador retirado |
| `assinatura_devolucao_url` | VARCHAR(500) | Assinatura do cliente confirmando devolução |
| `plataforma_desativada` | BOOLEAN | Se foi desativado em Rede Veículos/SoftTruck |
| `chip_cancelado` | BOOLEAN | Se o chip foi cancelado na operadora |
| `solicitado_por_modulo` | VARCHAR(30) | Origem da solicitação (cadastro, monitoramento, financeiro, diretoria) |
| `cancelamento_bloqueado_ate_devolucao` | BOOLEAN | Flag para bloquear cancelamento até devolução |
| `novo_veiculo_id` | UUID FK → veiculos | Para retirada com nova instalação |

**Defaults**: Todos nullable ou false, seguindo a convenção do projeto.

---

### 2.2 Adicionar Status `retirada_pendente` ao Enum `status_rastreador`

Adicionar novo valor ao enum `status_rastreador` na tabela `rastreadores`:

```
'retirada_pendente' // Rastreador instalado mas com ordem de retirada aberta
```

Isso permite rastrear rastreadores que têm uma retirada solicitada mas ainda não executada.

**Status atuais após mudança** (11 valores):
1. `estoque` - Em estoque
2. `reservado` - Separado para instalação
3. `instalado` - No veículo
4. **`retirada_pendente`** ← NOVO
5. `manutencao` - Em manutenção (campo)
6. `reagendar_manutencao` - Aguardando reagendamento
7. `retorno_base` - Voltou para base
8. `triagem` - Em triagem
9. `em_analise_plataforma` - Na plataforma externa
10. `em_garantia` - Em garantia
11. `baixado` - Descartado (terminal)

---

### 2.3 Verificação: Enum `tipo_servico`

✅ **Já existe**: O valor `vistoria_retirada` já está registrado no enum desde a migração de 2025-02-06.
Não há ação necessária.

---

## 3. ATUALIZAÇÃO DOS TIPOS TYPESCRIPT

Após executar a migração SQL, os tipos em `src/integrations/supabase/types.ts` serão **regenerados automaticamente** pelo Supabase.

Porém, para melhor documentação no código frontend, você pode adicionar tipos customizados em um arquivo novo ou existente:

```typescript
// src/types/retirada.ts (NOVO)
export type MotivoRetirada = 
  | 'cancelamento_voluntario'
  | 'inadimplencia'
  | 'exclusao_diretoria'
  | 'substituicao_veiculo'
  | 'busca_apreensao';

export type SubTipoRetirada = 
  | 'somente_retirada'
  | 'retirada_com_nova_instalacao';

export type IntegridadeAparelho = 
  | 'integro'
  | 'danificado'
  | 'violado'
  | 'molhado';

export type FormaCobrancaMulta = 
  | 'automatica_asaas'
  | 'manual_financeiro';

export type ModuloOrigem = 
  | 'cadastro'
  | 'monitoramento'
  | 'financeiro'
  | 'diretoria';
```

---

## 4. SEQUÊNCIA DE EXECUÇÃO

1. ✅ **Criar migração SQL** com todas as 21 colunas + 1 status novo
2. ✅ **Executar migração** (você faz via Supabase Dashboard)
3. ✅ **Regenerar types** (Supabase faz automaticamente)
4. ⚠️ **Adicionar tipos TypeScript customizados** (opcional mas recomendado)
5. ⚠️ **Revisar permissões RLS** (não será alterado nesta migração)

---

## 5. IMPACTO E VALIDAÇÕES

### ✅ O que É Seguro
- Nenhuma coluna existente é alterada
- Nenhuma coluna é deletada
- Todas as colunas novas são nullable ou têm valores default (false)
- Nenhuma RLS policy existente será quebrada
- Tabelas relacionadas (rastreadores, veiculos, associados) continuam intactas

### ⚠️ Considerações
- `debitos_conferidos_por` referencia `auth.users` - apenas para leitura via RLS
- `novo_veiculo_id` permite retirada + nova instalação no mesmo fluxo
- `cancelamento_bloqueado_ate_devolucao` deve ser verificado na lógica de cancelamento no módulo de Cadastro

---

## 6. PRÓXIMOS PASSOS (Após Aprovação)

Depois que a migração for executada, você terá que:

1. **Adicionar campos nos formulários e modais** que já existem:
   - `EnviarRetiradaModal.tsx` (agendamento)
   - `ExecutarRetirada.tsx` (execução pelo técnico)

2. **Criar lógica de cobrança automática** de multa via Asaas (integration)

3. **Adicionar validações** no hook `useCriarRetirada.ts` para verificar débitos e multas

4. **Atualizar permissões** se necessário nas RLS policies para campos sensíveis como `multa_*`

---

## 7. DETALHES TÉCNICOS DA MIGRAÇÃO

```sql
-- Cria comentários explicativos para documentação
COMMENT ON COLUMN servicos.motivo_retirada IS 
  'cancelamento_voluntario, inadimplencia, exclusao_diretoria, substituicao_veiculo, busca_apreensao';

COMMENT ON COLUMN servicos.sub_tipo_retirada IS 
  'somente_retirada, retirada_com_nova_instalacao';

COMMENT ON COLUMN servicos.multa_forma_cobranca IS 
  'automatica_asaas para integração com cobrança, manual_financeiro para conferência posterior';

-- Adiciona status novo ao rastreadores
ALTER TYPE status_rastreador ADD VALUE 'retirada_pendente';
```

---

## 📋 Checklist Final

- [ ] Migração SQL validada e pronta
- [ ] Todas as 21 colunas + 1 status novo cadastrados
- [ ] Types TypeScript regenerados automaticamente
- [ ] Tipos customizados adicionados (opcional)
- [ ] RLS policies revisadas (compatíveis com as mudanças)
- [ ] Sem dados perdidos ou alterações em colunas existentes
- [ ] Documentação de campos (comentários SQL) adicionada

