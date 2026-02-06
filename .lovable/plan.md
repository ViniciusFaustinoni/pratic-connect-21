
## PLANO: EXECUTAR MIGRATIONS SQL PARA COMISSIONAMENTO

### SITUAÇÃO ATUAL VALIDADA

✅ **Tabelas existentes:**
- `comissoes` (18 campos)
- `comissoes_config` (existente)
- `comissoes_pagamentos` (existente)
- `associados` (39 campos)
- `contratos` (70+ campos)
- `funcionarios` (60+ campos)
- `profiles` (10 campos) — usada como referência para FK
- `user_roles` (com role enum) — usada para RLS

✅ **Triggers existentes:**
- Nenhum trigger listado no information_schema (possível que estejam em outras schemas ou schemas de sistema)

---

### ESTRUTURA DAS MIGRATIONS

A implementação será dividida em **3 migrations SQL** executadas sequencialmente:

#### **MIGRATION 1: Adicionar Campos em Tabelas Existentes**

Vai adicionar:
- **Em `associados`**: 5 novos campos (vendedor_original_id, motivo_cancelamento, data_cancelamento, data_primeiro_boleto_pago, qtd_boletos_pagos)
- **Em `comissoes`**: 12 novos campos (tipo_comissao, cobranca_id, campanha_id, associado_id, valor_bruto, valor_deducoes, deducoes_detalhes, recalculada, recalculada_em, recalculada_motivo, contestada, contestada_em, contestacao_motivo, contestacao_resposta)
- **Em `contratos`**: 3 novos campos (tipo_atendimento, tipo_venda, origem_troca_titularidade_id)
- **Em `funcionarios`**: 3 novos campos (recorde_vendas_mensal, mes_recorde, ano_recorde)
- **Índices**: 5 índices novos para performance

**Risco:** Baixo. Usa `IF NOT EXISTS` e `ADD COLUMN IF NOT EXISTS`.

---

#### **MIGRATION 2: Criar Tabelas de Configuração de Faixas**

Vai criar 5 tabelas principais com dados padrão:

1. **`comissoes_faixas_adesao`** → 11 registros (faixas por quantidade de vendas)
2. **`comissoes_faixas_recorrente`** → 10 registros (faixas por base ativa)
3. **`comissoes_faixas_producao`** → 3 registros (faixas por produção externa)
4. **`comissoes_faixas_crescimento`** → 15 registros (marcos de crescimento)
5. **`comissoes_faixas_classificacao`** → 27 registros (ranking mensal)

**Risco:** Muito baixo. Usa `IF NOT EXISTS` para criar tabelas.

---

#### **MIGRATION 3: Criar Tabelas Auxiliares + RLS**

Vai criar 7 tabelas auxiliares:

1. **`comissoes_campanhas`** — período de apuração
2. **`comissoes_ranking_mensal`** — resultado de ranking
3. **`comissoes_recorrentes`** — comissões sobre mensalidades
4. **`comissoes_crescimento_log`** — marcos atingidos
5. **`comissoes_deducoes`** — registro detalhado de deduções
6. **`comissoes_parametros`** → 10 parâmetros configuráveis
7. **`comissoes_auditoria`** — auditoria de todas as alterações

E vai:
- Habilitar RLS em todas as 12 novas tabelas
- Criar 13 RLS policies (leitura para todos autenticados, escrita para diretor/gerente)
- Criar índices para performance

**Risco:** Baixo. Policies usam `EXISTS` com `user_roles`, não RLS recursiva.

---

### VALIDAÇÕES PRÉ-EXECUÇÃO

Antes de executar:
- ✅ Confirmar que `profiles` tem campo `id` UUID (SIM)
- ✅ Confirmar que `user_roles` tem coluna `role` (SIM)
- ✅ Confirmar que `associados`, `comissoes`, `contratos`, `funcionarios` existem (SIM)
- ✅ Nenhuma tabela nova já existe (confirmado)

### FLUXO DE EXECUÇÃO

```
1. MIGRATION 1 (Campos)
   ↓ [Aguarda conclusão]
2. MIGRATION 2 (Faixas + Parametros)
   ↓ [Aguarda conclusão]
3. MIGRATION 3 (Auxiliares + RLS)
   ↓ [Conclusão]
4. VALIDAÇÃO (Confirmação de sucesso)
```

### CHECKLIST DE VALIDAÇÃO PÓS-EXECUÇÃO

Após cada migration, será validado:
- ✅ Tabelas criadas com sucesso
- ✅ Dados padrão inseridos (contagem correta)
- ✅ Índices criados
- ✅ RLS ativado
- ✅ Nenhum erro no console
- ✅ Triggers existentes NÃO alterados

### PRÓXIMOS PASSOS (Parte 3)

Após aprovação e execução, a próxima etapa será:
- Modificar triggers existentes para registrar em `comissoes_auditoria`
- Criar edge function `calcular-comissoes-recorrentes` para boletos pagos
- Criar edge function `gerar-ranking-mensal` para apuração
- Atualizar TypeScript types conforme novas tabelas

