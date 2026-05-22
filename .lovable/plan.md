## Verificação do Dashboard de Comissões (mai/2026)

### TL;DR
O que a tela mostra (R$ 0,00 a pagar · R$ 0,00 pago · 85 pendentes · 0 vitalícias · "Nenhum vendedor") **bate matematicamente com a tabela `comissoes`**. Ou seja, **não há bug no front-end**. O problema real está em **como as comissões são geradas**: todos os 85 lançamentos foram inseridos com `valor_comissao = 0`, e não existe nenhuma comissão recorrente em maio (apesar de 83 contratos novos com `valor_mensal > 0`).

### O que conferi

| Item exibido | Origem | Veredito |
|---|---|---|
| `R$ 0,00 a pagar · 85 lançamentos` | soma `valor_total` onde status ∈ (pendente,aprovada) | ✅ correto — DB tem 85 pendentes, todos `valor_total=0` |
| `R$ 0,00 pago · 0 lançamentos` | soma onde `pago_em IS NOT NULL` | ✅ correto — zero registros pagos no mês |
| `Pendente de aprovação: 85` | conta `status='pendente'` | ✅ correto |
| `Comissões vitalícias: 0` | `parcela_numero > 12` ou `tipo_comissao ILIKE %vitalicia%` | ✅ correto — os 85 são `tipo_comissao='adesao'` |
| Top 5 vendedores vazio | soma R$ por vendedor; `valor=0` para todos | ✅ correto — todas as somas dão 0 |

### Diagnóstico do dado real (o que está realmente errado)

1. **Comissões de adesão com valor zero (85 registros, maio/2026).**
   `valor_base ∈ [0..150]`, `percentual_aplicado=0`, `valor_comissao=0`, `tipo_calculo=null`, `role_destinatario=null`, `calculo_snapshot=null`. Sinal claro de que `fn_gerar_comissao_plano_nivel` (ou variação) foi chamada sem grade resolvida.

2. **Cobertura de grades insuficiente.**
   - Vendedores que originaram comissão no mês: **21**
   - Linhas em `usuario_grade_comissao`: **5** (apenas 5 usuários têm grade)
   → ver memória `mem://logic/commissions/grade-do-vendedor-prevalece`: sem grade do **originador**, toda a cadeia (vendedor/supervisor/gerente/agência) deveria falhar a geração — em vez disso está gerando registro `0`, o que polui o dashboard e esconde o problema.

3. **Comissão recorrente nunca gerada.**
   - `SELECT COUNT(*) FROM comissoes WHERE tipo_comissao='recorrente'` → **0** em toda a base.
   - 83 contratos novos em maio com `valor_mensal > 0`, 0 `cobrancas` quitadas no mês.
   → `fn_calcular_recorrente` / `fn_gerar_comissoes_por_pagamento` nunca dispararam. Compatível com "0 boletos pagos", mas significa que a tela só vai sair de R$ 0,00 quando começarmos a marcar cobranças como pagas.

4. **KPIs cruzam com o filtro de Status (UX confuso, não bug):** ao escolher Status=Paga no filtro, "Pendente de aprovação" zera (pois `items` já vem filtrado). Decisão de produto — não vou mexer sem confirmação.

### O que proponho fazer

#### A) Saneamento dos dados (migração)
- Mapear os 85 lançamentos pendentes com `valor_comissao=0`:
  - Recalcular via `fn_gerar_comissao_plano_nivel` para os contratos que **têm vendedor com grade** atribuída.
  - Marcar como `cancelada` (com `observacoes='vendedor_sem_grade_atribuida'`) os que continuam zerados, em vez de mantê-los como "pendentes fantasma" entupindo o KPI.
- Backfill opcional de `usuario_grade_comissao` para os 16 vendedores ativos sem grade (precisa de decisão de negócio: qual grade default?).

#### B) Guard contra "comissão zero" futura
- Adicionar guarda em `fn_gerar_comissao_plano_nivel`/`fn_calcular_recorrente`: se `percentual_aplicado=0` E `tipo_calculo<>'valor_fixo'`, **não inserir** linha; gravar em `logs_auditoria` com `acao='comissao_nao_gerada_sem_grade'` para visibilidade no painel.

#### C) Pequenas melhorias na tela (não bloqueantes)
- Mostrar o aviso "X vendedor(es) sem grade de comissão atribuída — comissões podem não estar sendo geradas" como banner no topo (lê `usuario_grade_comissao` faltante para vendedores ativos).
- Avaliar se KPIs devem ignorar o filtro de Status (mostrar sempre todos os totais do período e usar o Status só para o modal de detalhe).

### Pergunta pra você
Antes de eu rodar A/B/C, preciso confirmar 3 coisas:

1. **Backfill dos 85 lançamentos**: posso recalcular o que dá pra recalcular e cancelar (`status='cancelada'`) o resto, com log de auditoria? Ou prefere manter como está e só corrigir daqui pra frente?
2. **Guard "não inserir comissão zero"**: ok bloquear inserção quando não há grade resolvida?
3. **Banner UX no Dashboard**: ok adicionar o aviso de vendedores sem grade?

Sem o seu OK, este plano é só diagnóstico — nada será modificado.