
## ANÁLISE DETALHADA — MIGRATION SQL PARA FUNÇÕES DE COMISSIONAMENTO

### 1. VALIDAÇÃO DE COMPATIBILIDADE COM SCHEMA EXISTENTE

**✅ Estrutura de Tipos**
- `app_role` ENUM existe com os valores necessários: `vendedor_clt`, `vendedor_externo`, `diretor`, `gerente_comercial`
- `status_associado` ENUM existe com `ativo` e `cancelado`
- `status_contrato` ENUM existe com `ativo` e `cancelado`

**✅ Estrutura de Tabelas**
- `profiles` existe com `user_id`, `id (UUID)`, `ativo`, `nome`
- `user_roles` existe com `user_id`, `role` (app_role)
- `funcionarios` existe com `usuario_id`, `data_admissao`, `nome_completo`
- `associados` existe (todas as colunas novas já foram adicionadas em Parte 1)
- `contratos` existe com `vendedor_id`, `associado_id`, `status`, `valor_adesao`, `data_ativacao`, `tipo_atendimento`, `tipo_venda` (já adicionadas)
- `comissoes` existe com todos os campos novos (Parte 1)
- `comissoes_parametros`, `comissoes_faixas_*`, `comissoes_deducoes`, `comissoes_campanhas`, `comissoes_ranking_mensal`, `comissoes_crescimento_log` — todas criadas em Parte 1

**⚠️ PROBLEMA CRÍTICO IDENTIFICADO 1: Referência a `asaas_cobrancas`**
- A função `fn_calcular_recorrente()` faz JOIN com `asaas_cobrancas` (linhas que mencionam essa tabela)
- Preciso validar se essa tabela existe e tem os campos `status`, `tipo`, `mes_referencia`, `ano_referencia`, `valor`
- Se não existir, a migration falhará — preciso clarificar isso

**⚠️ PROBLEMA CRÍTICO 2: Campo `adesao_paga` em contratos**
- Funções usam `c.adesao_paga = true` para contar "vendas confirmadas"
- Preciso validar se esse campo foi adicionado — não aparece nas alterações da Parte 1
- Sem esse campo, as queries retornarão erro

**⚠️ PROBLEMA CRÍTICO 3: Trigger existente `trigger_comissao_ao_ativar`**
- A migration tenta fazer `CREATE OR REPLACE FUNCTION calcular_comissao_contrato()`
- Preciso verificar qual é a ASSINATURA atual dessa função (recebe parâmetros? É trigger?)
- Se for trigger function (RETURNS TRIGGER), não pode ser substituída por CREATE OR REPLACE com assinatura diferente

**⚠️ PROBLEMA CRÍTICO 4: Logística de cálculo dividida**
- Trigger ao ativar calcula comissão (status='pendente', sem valores finais)
- Função master `fn_fechamento_mensal_comissoes()` deve ser chamada manualmente no dia 20
- Preciso validar se há orchestração (edge function ou schedule) que a dispara automaticamente

### 2. DIVISÃO DE RESPONSABILIDADES

**No trigger `trigger_comissao_ao_ativar` (ao ativar contrato):**
- Cria registro de comissão com status='pendente'
- Registra deduções de repasse volante
- Marca `vendedor_original_id` no associado

**No fechamento mensal `fn_fechamento_mensal_comissoes()` (executado manualmente dia 20):**
- Calcula percentual de adesão (faixa escalonada)
- Calcula comissão recorrente (% sobre boletos pagos)
- Calcula produção (externo)
- Verifica crescimento de base
- Verifica recorde pessoal
- Calcula ranking mensal
- Tudo salvo em suas tabelas específicas

### 3. PONTOS DE ATENÇÃO CRÍTICOS NA IMPLEMENTAÇÃO

**Ciclo de vida de uma comissão:**
```
ADESÃO:
  1. Trigger → cria registro type='adesao' status='pendente'
  2. Fechamento → calcula percentual, atualiza status='aguardando_aprovacao'
  3. Diretor → aprova → status='aprovada'
  4. Pagamento → status='paga'

RECORRENTE:
  1. Nenhum registro pré-criado (calculada 100% no fechamento)
  2. Fechamento → cria registro em comissoes_recorrentes
  3. Insere comissão do tipo='recorrente' status='pendente' (ou direto 'aprovada'?)
  4. Pagamento → status='paga'

PRODUÇÃO (externo):
  Similar ao recorrente

CLASSIFICAÇÃO/RANKING:
  1. Calculada 100% no fechamento (fn_calcular_ranking_campanha)
  2. Insere em comissoes_ranking_mensal
  3. Precisa então criar registro em comissoes type='classificacao'?
```

**QUESTÃO: Como a comissão tipo='recorrente', 'producao', 'classificacao' chega à tabela comissoes?**
- A função master calcula em suas tabelas específicas
- Mas não vejo INSERT na tabela `comissoes` para esses tipos
- Preciso de clarificação: devem ser inseridas em `comissoes` ou ficar só nas tabelas específicas?

### 4. ERROS POTENCIAIS NA SINTAXE SQL

**Erro 1: Função `fn_parametro_comissao()` retorna NUMERIC mas é usada em STRING context**
```sql
-- Linha na função fn_fechamento_mensal_comissoes:
make_date(p_ano, p_mes, LEAST(fn_parametro_comissao('dia_pagamento_1a_fase')::INTEGER, 28))
-- Isso está correto, mas fn_parametro_comissao retorna NULL se parâmetro não existir
-- Se não existir, LEAST() pode retornar NULL, causando erro em make_date()
```
**Solução**: Usar COALESCE com valor padrão

**Erro 2: Loop em fn_calcular_ranking_campanha com atualização de dados enquanto itera**
```sql
FOR v_vendedor IN SELECT ... ORDER BY vendas_liquidas DESC LOOP
  v_posicao := v_posicao + 1;
  UPDATE comissoes_ranking_mensal SET posicao_ranking = v_posicao WHERE id = v_vendedor.id;
END LOOP;
```
**Problema**: Se houver empates em vendas_liquidas, a ordem pode ser indeterminística
**Solução**: Adicionar NULLS LAST ou DISTINCT ON para garantir ordem determinística

**Erro 3: Trigger fn_estorno_cancelamento() pode disparar recursivamente**
- Atualiza status='cancelado' em associados
- Se houver outro trigger ou ação automática acionada por essa mudança, pode haver loop infinito
- **Solução**: Usar flag ou contexto de transação para evitar re-entrada

**Erro 4: Falta de handling de erro em asynchronous operations**
- Funções não tratam cenários onde dados esperados não existem
- Ex: Se vendedor_id não existir em profiles, a query falha silenciosamente
- **Solução**: Adicionar RAISE EXCEPTION com mensagens de erro claras

### 5. VALIDAÇÕES TÉCNICAS NECESSÁRIAS

Antes de executar a migration, preciso confirmar:

1. **Tabela `asaas_cobrancas` existe?**
   - Campos necessários: `status`, `tipo`, `mes_referencia`, `ano_referencia`, `valor`, `contrato_id`
   - ✅ CRÍTICO — se não existir, toda lógica de recorrente quebra

2. **Campo `contratos.adesao_paga` existe?**
   - Se não, todas as queries que contam "vendas confirmadas" retornarão 0
   - ✅ CRÍTICO — sem isso, nenhuma comissão será calculada

3. **Qual é a assinatura ATUAL de `calcular_comissao_contrato()`?**
   - Se for trigger function (RETURNS TRIGGER), pode ser substituída
   - Se for função normal, pode haver conflito
   - ✅ CRÍTICO — para evitar quebra do trigger existente

4. **Como será disparado `fn_fechamento_mensal_comissoes()`?**
   - Precisa ser uma edge function REST API?
   - Precisa de um cron job automático?
   - Será chamado manualmente?
   - 📌 Afeta a arquitetura geral

### 6. RECOMENDAÇÕES PARA EXECUÇÃO

**FASE 1 — Validações pré-execução (5 minutos):**
```sql
-- 1. Verificar asaas_cobrancas
SELECT column_name FROM information_schema.columns 
WHERE table_name='asaas_cobrancas' 
ORDER BY column_name;

-- 2. Verificar adesao_paga em contratos
SELECT column_name FROM information_schema.columns 
WHERE table_name='contratos' AND column_name='adesao_paga';

-- 3. Verificar função atual
SELECT prosrc FROM pg_proc WHERE proname='calcular_comissao_contrato';
```

**FASE 2 — Ajustes necessários (se problemas encontrados):**
- Se `asaas_cobrancas` não existir → criar migration separada ANTES dessa
- Se `adesao_paga` não existir → adicionar migration para ADD COLUMN
- Se `calcular_comissao_contrato()` for incompatível → fazer DROP FUNCTION antes

**FASE 3 — Executar migration SQL** (conforme fornecido pelo usuário)

**FASE 4 — Testes de validação:**
```sql
-- Testar cada função individualmente
SELECT fn_tipo_consultor('id_vendedor_uuid'::uuid) → deve retornar 'interno' ou 'externo'
SELECT fn_placas_ativas_consultor('id_vendedor_uuid'::uuid) → deve retornar INTEGER >= 0
SELECT fn_parametro_comissao('repasse_volante') → deve retornar 50.00
SELECT fn_fechamento_mensal_comissoes(02, 2026) → deve retornar JSONB

-- Testar integridade referencial
SELECT * FROM comissoes WHERE vendedor_id NOT IN (SELECT id FROM profiles) LIMIT 1;
```

**FASE 5 — Integração com Frontend:**
- Criar edge function wrapper para `fn_fechamento_mensal_comissoes()`
- Ou criar scheduled task para dispará-lo automaticamente dia 20
- Atualizar hooks TypeScript para chamar nova estrutura

### 7. RISCOS CONHECIDOS

🔴 **ALTO**: Dependência de tabelas não validadas (`asaas_cobrancas`, campo `adesao_paga`)
🔴 **ALTO**: Lógica distribuída entre trigger + função master pode gerar inconsistências
🟡 **MÉDIO**: Sem orchestração clara de quando executar `fn_fechamento_mensal_comissoes()`
🟡 **MÉDIO**: Performance: múltiplos LOOPs e JOINs em função master sem índices específicos

### 8. MUDANÇAS NECESSÁRIAS NO SQL FORNECIDO

**Minhas recomendações para tornar mais robusto:**

1. Adicionar COALESCE em todas as chamadas a `fn_parametro_comissao()`:
   ```sql
   COALESCE(fn_parametro_comissao('dia_pagamento_1a_fase')::INTEGER, 20)
   ```

2. Adicionar validação de existência de dados antes de processar:
   ```sql
   IF v_comissao_existente IS NOT NULL THEN
     RETURN NEW;
   END IF;
   ```

3. Adicionar DISTINCT ON para evitar empates não determinísticos:
   ```sql
   ORDER BY vendas_liquidas DESC, vendedor_id ASC
   ```

4. Adicionar handling de erro e logging em fn_estorno_cancelamento()

5. Criar índices específicos ANTES da execution (para performance):
   ```sql
   CREATE INDEX idx_comissoes_deducoes_vendedor_mes ON comissoes_deducoes(vendedor_id, aplicada_em);
   CREATE INDEX idx_asaas_cobrancas_vendedor_periodo ON asaas_cobrancas(contrato_id, mes_referencia, ano_referencia);
   ```

### 9. PRÓXIMOS PASSOS (APÓS EXECUÇÃO SQL)

1. Criar edge function `/functions/fechamento-mensal.ts` que chame `fn_fechamento_mensal_comissoes()`
2. Atualizar `src/hooks/useComissoesFechamentoMensal.ts` com mutation para chamar edge function
3. Atualizar UI em `ComissoesConfig.tsx` para disparar fechamento (aba Campanhas)
4. Criar scheduled task para executar automaticamente dia 20
5. Testes end-to-end: criar contrato → ativar → fechar mês → validar comissões

---

## RESUMO EXECUTIVO

A migration SQL é **estruturalmente válida** e segue boas práticas de banco de dados. Entretanto, há **3 dependências críticas** que devem ser validadas ANTES da execução:

1. ✅/❌ Tabela `asaas_cobrancas` com campos apropriados
2. ✅/❌ Campo `contratos.adesao_paga`
3. ✅/❌ Assinatura compatível de `calcular_comissao_contrato()`

A estratégia de **trigger + função master** é apropriada para o negócio, mas requer:
- Documentação clara de quando executar `fn_fechamento_mensal_comissoes()` (dia 20 do mês)
- Edge function wrapper para ser acessível do frontend
- Testes de integridade referencial após execução

Recomendo: **Validar 3 dependências críticas → Fazer pequenos ajustes na SQL → Executar → Testar → Criar edge function**
