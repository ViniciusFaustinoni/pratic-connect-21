
-- =============================================
-- FIX REMAINING 2 VIEWS - SECURITY INVOKER
-- =============================================

-- 1. Recriar view_associado_financeiro com SECURITY INVOKER
DROP VIEW IF EXISTS view_associado_financeiro;
CREATE VIEW view_associado_financeiro WITH (security_invoker = true) AS
SELECT a.id AS associado_id,
    a.nome,
    a.cpf,
    a.status AS associado_status,
    count(c.id) AS total_cobrancas,
    count(c.id) FILTER (WHERE ((c.status)::text = 'PENDING'::text)) AS cobrancas_pendentes,
    count(c.id) FILTER (WHERE ((c.status)::text = 'OVERDUE'::text)) AS cobrancas_vencidas,
    count(c.id) FILTER (WHERE ((c.status)::text = ANY ((ARRAY['RECEIVED'::character varying, 'CONFIRMED'::character varying])::text[]))) AS cobrancas_pagas,
    COALESCE(sum(c.valor) FILTER (WHERE ((c.status)::text = 'PENDING'::text)), (0)::numeric) AS valor_pendente,
    COALESCE(sum(c.valor) FILTER (WHERE ((c.status)::text = 'OVERDUE'::text)), (0)::numeric) AS valor_vencido,
    COALESCE(sum(c.valor) FILTER (WHERE ((c.status)::text = ANY ((ARRAY['RECEIVED'::character varying, 'CONFIRMED'::character varying])::text[]))), (0)::numeric) AS valor_pago,
    min(c.data_vencimento) FILTER (WHERE ((c.status)::text = 'PENDING'::text)) AS proximo_vencimento,
    max((CURRENT_DATE - c.data_vencimento)) FILTER (WHERE ((c.status)::text = 'OVERDUE'::text)) AS dias_maior_atraso
   FROM (associados a
     LEFT JOIN asaas_cobrancas c ON ((c.associado_id = a.id)))
  GROUP BY a.id, a.nome, a.cpf, a.status;

-- 2. Recriar view_movimentacoes_diarias com SECURITY INVOKER
DROP VIEW IF EXISTS view_movimentacoes_diarias;
CREATE VIEW view_movimentacoes_diarias WITH (security_invoker = true) AS
SELECT conta_bancaria_id,
    data_lancamento,
    count(*) AS qtd_lancamentos,
    sum(
        CASE
            WHEN ((tipo)::text = 'credito'::text) THEN valor
            ELSE (0)::numeric
        END) AS total_creditos,
    sum(
        CASE
            WHEN ((tipo)::text = 'debito'::text) THEN abs(valor)
            ELSE (0)::numeric
        END) AS total_debitos,
    sum(
        CASE
            WHEN ((tipo)::text = 'credito'::text) THEN valor
            ELSE (- abs(valor))
        END) AS saldo_dia,
    count(
        CASE
            WHEN conciliado THEN 1
            ELSE NULL::integer
        END) AS qtd_conciliados
   FROM movimentacoes_bancarias
  GROUP BY conta_bancaria_id, data_lancamento
  ORDER BY data_lancamento DESC;
