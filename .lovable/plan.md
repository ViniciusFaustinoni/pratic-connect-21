

# Validação: Extrato do Vendedor — Resultados

## Resumo

| Item | Teste | Status | Detalhe |
|------|-------|--------|---------|
| 4.1 | Menu visível | **OK** | "Conta Corrente" aparece no footer do sidebar para `isVendedorOnly`, `isPerfilLimitado`, `supervisor_externo` e `agencia` (linha 911 de AppSidebar.tsx). Rota `/perfil/conta-corrente` registrada em App.tsx (linha 547). |
| 4.2 | Cards de resumo | **OK** | 4 cards implementados: A Receber Este Mês, Já Recebido Este Mês, Total a Receber, Total Histórico Recebido. Hook `useContaCorrenteVendedor` calcula via 4 queries na `cc_vendedor_lancamentos` (linhas 118-181). |
| 4.3 | Extrato de adesão | **OK** | `getTipoLabel()` retorna "Adesão" quando `categoria === 'adesao'`. Associado nome vem via join. Status exibido via Badge. |
| 4.4 | Extrato de mensalidade | **OK** | `getTipoLabel()` retorna "Mensalidade (Xª parcela)" quando `categoria === 'recorrente'` e `parcela_numero` existe. |
| 4.5 | Status Pago | **OK** | STATUS_CONFIG inclui `pago: { label: 'Pago', ... }`. Coluna "Pagamento" exibe `data_pagamento` formatada. O hook `registrarPagamento` atualiza `status='pago'` e `data_pagamento`. |
| 4.6 | Status Estornado | **OK** | STATUS_CONFIG mapeia `cancelado` para label "Estornado". Quando `status === 'cancelado'`, exibe `observacao_pagamento` como motivo em texto vermelho abaixo do badge (linhas 348-351). |
| 4.7 | Filtro por período | **OK** | Campos "Data início" e "Data fim" aplicam `gte`/`lte` na query (linhas 96-97 do hook). |
| 4.8 | Filtro por status | **OK** | Select de status com opções: Pendente, A pagar, Pago, Estornado. Aplica `.eq('status', status)` (linha 99). |
| 4.9 | Busca por associado | **OK** | Campo de busca aplica `.ilike('descricao', '%busca%')` (linha 101). Busca na descrição do lançamento (que contém o nome do associado). |
| 4.10 | Exportar extrato | **OK** | Botões PDF e CSV implementados. PDF usa jsPDF+autoTable com filtros ativos e resumo. CSV gera arquivo com separador `;`. Ambos respeitam filtros ativos. |
| 4.11 | Isolamento total | **OK** | RLS policy `cc_vendedor_own_select` restringe SELECT a `vendedor_id = get_profile_id_for_auth(auth.uid())`. Admin/diretor tem policy separada `cc_admin_all`. |
| 4.12 | Notificação de pagamento | **NÃO IMPLEMENTADO** | Quando o Financeiro registra pagamento via `registrarPagamento` (update status para 'pago'), **nenhuma notificação é criada** na `notificacoes_vendas`. O realtime listener existe, mas ninguém insere a notificação no momento do pagamento. |

## Item pendente: 4.12 — Notificação de pagamento

### Problema
O mutation `registrarPagamento` (useContaCorrenteVendedor.ts, linha 361) faz apenas um `UPDATE` no lançamento para `status='pago'`. Não há trigger no banco nem código no frontend que insira uma notificação na tabela `notificacoes_vendas` ao dar baixa.

### Solução proposta

**Opção A — Trigger no banco** (recomendada):
Criar um trigger `AFTER UPDATE` na tabela `cc_vendedor_lancamentos` que, quando `status` muda para `'pago'`, insere automaticamente uma notificação na `notificacoes_vendas`:

```sql
CREATE FUNCTION fn_notificar_pagamento_vendedor()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status != 'pago' AND NEW.tipo = 'credito' THEN
    INSERT INTO notificacoes_vendas (usuario_id, tipo, titulo, mensagem, dados_extras)
    VALUES (
      NEW.vendedor_id,
      'pagamento_comissao',
      'Pagamento recebido!',
      FORMAT('Comissão de R$ %s foi paga em %s', 
        TO_CHAR(NEW.valor_liquido, 'FM999G999D00'), 
        TO_CHAR(NEW.data_pagamento::date, 'DD/MM/YYYY')),
      jsonb_build_object('lancamento_id', NEW.id, 'valor', NEW.valor_liquido)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notificar_pagamento
AFTER UPDATE ON cc_vendedor_lancamentos
FOR EACH ROW EXECUTE FUNCTION fn_notificar_pagamento_vendedor();
```

O vendedor receberia a notificação em tempo real via o `useNotificacoesVendasRealtime()` já existente.

### Arquivos afetados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Trigger `trg_notificar_pagamento` + function `fn_notificar_pagamento_vendedor` |

Nenhuma alteração no frontend — o listener realtime já captura INSERTs na `notificacoes_vendas`.

