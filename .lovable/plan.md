

# Resultado da Validação: Comissionamento por Plano

## Status por item

| Item | Teste | Status | Detalhe |
|------|-------|--------|---------|
| 3.1 | Acesso à configuração | **OK** | Página existe em `/configuracoes/comissionamento-plano`, busca planos ativos e níveis de grades |
| 3.2 | Valor fixo | **OK** | UI permite selecionar "Valor fixo (R$)", informar valor e parcelas, salva na tabela `comissao_plano_nivel` |
| 3.3 | Percentual | **OK** | UI permite selecionar "Percentual (%)", informar valor e parcelas |
| 3.4 | Múltiplos níveis | **OK** | Cada nível da grade aparece como linha separada, salvos em registros independentes |
| 3.5 | Zero parcelas | **OK** | Campo aceita 0; badge "níveis configurados" só conta registros com `ativo=true AND parcelas>0` |
| 3.6 | Nível inativo | **OK** | Toggle `Switch` seta `ativo=false`, salvo no banco |
| 3.7 | Não retroativo | **NÃO IMPLEMENTADO** | Nenhum backend consome `comissao_plano_nivel` |
| 3.8 | Geração automática | **NÃO IMPLEMENTADO** | Nenhum backend consome `comissao_plano_nivel` |
| 3.9 | Limite de parcelas | **NÃO IMPLEMENTADO** | Nenhum backend consome `comissao_plano_nivel` |
| 3.10 | Cálculo percentual | **NÃO IMPLEMENTADO** | Nenhum backend consome `comissao_plano_nivel` |

## Problema raiz: 3.7 a 3.10

A tabela `comissao_plano_nivel` existe e a UI de configuração funciona, mas **nenhum backend lê essa tabela para gerar comissões**. Especificamente:

- `fn_calcular_recorrente` (DB function) usa `comissoes_faixas_recorrente` — tabela antiga, não `comissao_plano_nivel`
- `criar-instalacao-pos-pagamento` (Edge Function) usa valores da tabela `configuracoes` — sistema legado
- `asaas-webhook` / `gerar-faturas-mensais` — não referenciam `comissao_plano_nivel`

A configuração "por plano e por nível" é salva, mas nunca consumida na geração real.

## Plano de implementação (3.7-3.10)

### 1. Criar DB Function `fn_gerar_comissao_plano_nivel`

Nova função PL/pgSQL que:
- Recebe `p_contrato_id`, `p_cobranca_id`, `p_valor_pago`, `p_mes_referencia`
- Busca o `plano_id` do contrato
- Consulta `comissao_plano_nivel` para esse plano (somente `ativo=true`)
- Busca o vendedor do contrato e sua hierarquia de grade (`grades_comissao_niveis`)
- Para cada nível configurado:
  - Conta quantas comissões já foram geradas para esse contrato+nível
  - Se `count < parcelas`, gera nova comissão com o valor snapshot (fixo ou % do valor pago)
  - Se `count >= parcelas`, não gera (limite de parcelas - item 3.9)
- Valores são gravados como snapshot na tabela `comissoes` — não retroativo por design (item 3.7)

### 2. Integrar no fluxo de pagamento de mensalidade

No `asaas-webhook` (ou `gerar-faturas-mensais`), após confirmar pagamento de uma mensalidade:
- Chamar `fn_gerar_comissao_plano_nivel` passando os dados da cobrança
- Isso garante geração automática (item 3.8) e cálculo correto (item 3.10)

### 3. Tabela de comissões geradas

Verificar se a tabela `comissoes` (ou `comissoes_recorrentes`) comporta os campos necessários:
- `contrato_id`, `cobranca_id`, `nivel_nome`, `plano_id`, `parcela_numero`, `parcela_total`
- Se não, criar migration para adicionar colunas ou criar tabela dedicada `comissoes_plano_geradas`

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Nova function `fn_gerar_comissao_plano_nivel` + possível tabela `comissoes_plano_geradas` |
| `supabase/functions/asaas-webhook/index.ts` | Chamar a function após pagamento confirmado de mensalidade |
| Nenhuma alteração no frontend | A UI de configuração já está funcional |

