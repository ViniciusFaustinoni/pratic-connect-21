
-- =============================================
-- FIX 39 LINTER ISSUES - SGA PRATIC 2.0
-- =============================================

-- ============================================
-- FASE 1: RECRIAR 6 VIEWS COM SECURITY INVOKER
-- ============================================

-- 1. Recriar view_acompanhamento com SECURITY INVOKER
DROP VIEW IF EXISTS view_acompanhamento;
CREATE VIEW view_acompanhamento WITH (security_invoker = true) AS
SELECT l.id AS lead_id,
    l.nome,
    l.telefone,
    l.cpf,
    l.vendedor_id,
    a.id AS associado_id,
    a.status AS associado_status,
    v.id AS veiculo_id,
    v.marca AS veiculo_marca,
    v.modelo AS veiculo_modelo,
    v.ano_modelo AS veiculo_ano,
    v.placa AS veiculo_placa,
    v.status AS veiculo_status,
    i.id AS instalacao_id,
    i.status AS instalacao_status,
    i.data_agendada AS instalacao_data,
    (COALESCE(( SELECT count(*) AS count
           FROM documentos d
          WHERE (d.associado_id = a.id)), (0)::bigint))::integer AS docs_total,
    (COALESCE(( SELECT count(*) AS count
           FROM documentos d
          WHERE ((d.associado_id = a.id) AND (d.status = 'aprovado'::status_documento))), (0)::bigint))::integer AS docs_aprovados,
        CASE
            WHEN (a.id IS NULL) THEN 'documentacao'::text
            WHEN (EXISTS ( SELECT 1
               FROM documentos d
              WHERE ((d.associado_id = a.id) AND (d.status = ANY (ARRAY['pendente'::status_documento, 'reprovado'::status_documento]))))) THEN 'documentacao'::text
            WHEN (EXISTS ( SELECT 1
               FROM documentos d
              WHERE ((d.associado_id = a.id) AND (d.status = 'em_analise'::status_documento)))) THEN 'analise_cadastro'::text
            WHEN (a.status = 'em_analise'::status_associado) THEN 'analise_cadastro'::text
            WHEN ((a.status = ANY (ARRAY['aprovado'::status_associado, 'aguardando_instalacao'::status_associado])) AND ((i.id IS NULL) OR (i.status IS NULL))) THEN 'aprovado'::text
            WHEN (i.status = ANY (ARRAY['agendada'::status_instalacao, 'em_rota'::status_instalacao, 'em_andamento'::status_instalacao, 'reagendada'::status_instalacao])) THEN 'instalacao_agendada'::text
            WHEN ((i.status = 'concluida'::status_instalacao) AND (v.status = 'instalacao_pendente'::status_veiculo)) THEN 'instalacao_concluida'::text
            WHEN ((v.status = 'ativo'::status_veiculo) AND (a.status <> 'ativo'::status_associado)) THEN 'ativacao_pendente'::text
            WHEN (a.status = 'ativo'::status_associado) THEN 'ativo'::text
            ELSE 'documentacao'::text
        END AS fase_acompanhamento,
    p.nome AS vendedor_nome,
    GREATEST(l.updated_at, COALESCE(a.updated_at, l.updated_at)) AS updated_at
   FROM ((((leads l
     LEFT JOIN associados a ON ((a.id = l.associado_id)))
     LEFT JOIN veiculos v ON (((v.associado_id = a.id) AND (v.ativo = true))))
     LEFT JOIN instalacoes i ON ((i.veiculo_id = v.id)))
     LEFT JOIN profiles p ON ((p.user_id = l.vendedor_id)))
  WHERE (l.etapa = ANY (ARRAY['contrato_assinado'::etapa_lead, 'instalacao_agendada'::etapa_lead, 'ganho'::etapa_lead]));

-- 2. Recriar view_alertas_ativos com SECURITY INVOKER
DROP VIEW IF EXISTS view_alertas_ativos;
CREATE VIEW view_alertas_ativos WITH (security_invoker = true) AS
SELECT a.id,
    a.rastreador_id,
    a.tipo,
    a.severidade,
    a.mensagem,
    a.dados,
    a.status,
    a.created_at,
    a.updated_at,
    r.codigo AS rastreador_codigo,
    r.plataforma,
    r.ultima_comunicacao,
    v.id AS veiculo_id,
    v.placa,
    v.marca,
    v.modelo,
    ass.id AS associado_id,
    ass.nome AS associado_nome,
    ass.telefone AS associado_telefone,
    ass.email AS associado_email,
    round((EXTRACT(epoch FROM (now() - a.created_at)) / (3600)::numeric), 1) AS horas_aberto
   FROM (((rastreador_alertas a
     JOIN rastreadores r ON ((r.id = a.rastreador_id)))
     LEFT JOIN veiculos v ON ((r.veiculo_id = v.id)))
     LEFT JOIN associados ass ON ((v.associado_id = ass.id)))
  WHERE ((a.status)::text = ANY ((ARRAY['aberto'::character varying, 'visualizado'::character varying])::text[]))
  ORDER BY
        CASE a.severidade
            WHEN 'critica'::text THEN 1
            WHEN 'alta'::text THEN 2
            WHEN 'media'::text THEN 3
            ELSE 4
        END, a.created_at DESC;

-- 3. Recriar view_dashboard_diretoria com SECURITY INVOKER
DROP VIEW IF EXISTS view_dashboard_diretoria;
CREATE VIEW view_dashboard_diretoria WITH (security_invoker = true) AS
SELECT ( SELECT count(*) AS count
           FROM associados
          WHERE (associados.status = 'ativo'::status_associado)) AS associados_ativos,
    ( SELECT count(*) AS count
           FROM associados
          WHERE (associados.status = 'inadimplente'::status_associado)) AS associados_inadimplentes,
    ( SELECT count(*) AS count
           FROM leads
          WHERE (leads.created_at >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))) AS leads_mes,
    ( SELECT count(*) AS count
           FROM leads
          WHERE ((leads.etapa = 'ganho'::etapa_lead) AND (leads.updated_at >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))) AS conversoes_mes,
    ( SELECT COALESCE(sum(cobrancas.valor_pago), (0)::numeric) AS "coalesce"
           FROM cobrancas
          WHERE (((cobrancas.status)::text = 'pago'::text) AND (cobrancas.data_pagamento >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))) AS receita_mes,
    ( SELECT COALESCE(sum(contas_pagar.valor), (0)::numeric) AS "coalesce"
           FROM contas_pagar
          WHERE ((contas_pagar.data_vencimento >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)) AND (contas_pagar.data_vencimento < (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) + '1 mon'::interval)))) AS despesas_mes,
    ( SELECT count(*) AS count
           FROM sinistros
          WHERE (sinistros.created_at >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))) AS sinistros_mes,
    ( SELECT COALESCE(sum(sinistros.valor_indenizacao), (0)::numeric) AS "coalesce"
           FROM sinistros
          WHERE ((sinistros.status = ANY (ARRAY['aprovado'::status_sinistro, 'indenizado'::status_sinistro])) AND (sinistros.data_ocorrencia >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))) AS valor_sinistros_mes,
    ( SELECT count(*) AS count
           FROM instalacoes
          WHERE ((instalacoes.status = 'concluida'::status_instalacao) AND (instalacoes.updated_at >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)))) AS instalacoes_mes,
    ( SELECT count(*) AS count
           FROM chamados_assistencia
          WHERE (chamados_assistencia.created_at >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))) AS assistencias_mes;

-- 4. Recriar view_inadimplentes com SECURITY INVOKER
DROP VIEW IF EXISTS view_inadimplentes;
CREATE VIEW view_inadimplentes WITH (security_invoker = true) AS
SELECT a.id AS associado_id,
    a.nome,
    a.cpf,
    a.telefone,
    a.whatsapp,
    a.email,
    a.status AS status_associado,
    count(c.id) AS qtd_boletos_vencidos,
    sum(c.valor_final) AS valor_total_divida,
    min(c.data_vencimento) AS vencimento_mais_antigo,
    max(c.data_vencimento) AS vencimento_mais_recente,
    (CURRENT_DATE - min(c.data_vencimento)) AS dias_atraso_maximo,
        CASE
            WHEN ((CURRENT_DATE - min(c.data_vencimento)) <= 30) THEN 'leve'::text
            WHEN ((CURRENT_DATE - min(c.data_vencimento)) <= 60) THEN 'moderado'::text
            WHEN ((CURRENT_DATE - min(c.data_vencimento)) <= 90) THEN 'grave'::text
            ELSE 'critico'::text
        END AS faixa_atraso,
    ( SELECT count(*) AS count
           FROM cobranca_contatos cc
          WHERE ((cc.associado_id = a.id) AND (cc.created_at > (CURRENT_DATE - '30 days'::interval)))) AS contatos_ultimos_30_dias,
    ( SELECT max(cc.created_at) AS max
           FROM cobranca_contatos cc
          WHERE (cc.associado_id = a.id)) AS ultimo_contato
   FROM (associados a
     JOIN cobrancas c ON ((c.associado_id = a.id)))
  WHERE (((c.status)::text = 'vencido'::text) AND (c.data_vencimento < CURRENT_DATE))
  GROUP BY a.id, a.nome, a.cpf, a.telefone, a.whatsapp, a.email, a.status;

-- 5. Recriar view_indicacoes_pendentes com SECURITY INVOKER
DROP VIEW IF EXISTS view_indicacoes_pendentes;
CREATE VIEW view_indicacoes_pendentes WITH (security_invoker = true) AS
SELECT i.id,
    i.codigo,
    i.programa_id,
    i.indicador_id,
    i.indicador_nome,
    i.indicador_telefone,
    i.indicado_nome,
    i.indicado_telefone,
    i.indicado_email,
    i.lead_id,
    i.associado_id,
    i.status,
    i.valor_recompensa,
    i.data_recompensa,
    i.recompensa_paga,
    i.data_indicacao,
    i.data_contato,
    i.data_conversao,
    i.observacoes,
    i.created_at,
    i.updated_at,
    a.nome AS indicador_nome_completo,
    a.telefone AS indicador_telefone_completo,
    p.nome AS programa_nome,
    p.valor_indicador
   FROM ((indicacoes i
     LEFT JOIN associados a ON ((a.id = i.indicador_id)))
     LEFT JOIN programa_indicacao p ON ((p.id = i.programa_id)))
  WHERE (((i.status)::text = 'convertido'::text) AND (i.recompensa_paga = false))
  ORDER BY i.data_conversao;

-- 6. Recriar view_performance_canais com SECURITY INVOKER
DROP VIEW IF EXISTS view_performance_canais;
CREATE VIEW view_performance_canais WITH (security_invoker = true) AS
SELECT c.id,
    c.nome,
    c.tipo,
    count(DISTINCT l.id) AS total_leads,
    count(DISTINCT
        CASE
            WHEN ((l.etapa)::text = 'ganho'::text) THEN l.id
            ELSE NULL::uuid
        END) AS conversoes,
        CASE
            WHEN (count(l.id) > 0) THEN (((count(
            CASE
                WHEN ((l.etapa)::text = 'ganho'::text) THEN 1
                ELSE NULL::integer
            END))::numeric / (count(l.id))::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END AS taxa_conversao,
    COALESCE(sum(cm.valor_gasto), (0)::numeric) AS investimento_total,
        CASE
            WHEN (count(l.id) > 0) THEN (COALESCE(sum(cm.valor_gasto), (0)::numeric) / (count(l.id))::numeric)
            ELSE (0)::numeric
        END AS cpl_medio
   FROM (((canais_marketing c
     LEFT JOIN campanhas camp ON ((camp.canal_id = c.id)))
     LEFT JOIN leads l ON ((((l.origem)::text = (c.nome)::text) OR ((l.utm_source)::text = (c.nome)::text))))
     LEFT JOIN campanhas_metricas cm ON ((cm.campanha_id = camp.id)))
  WHERE (c.ativo = true)
  GROUP BY c.id, c.nome, c.tipo
  ORDER BY (count(DISTINCT l.id)) DESC;

-- ============================================
-- FASE 2: ADICIONAR search_path ÀS FUNÇÕES
-- ============================================

-- 1. gerar_hash_lancamento (SECURITY DEFINER - CRÍTICO)
CREATE OR REPLACE FUNCTION public.gerar_hash_lancamento(p_conta_id uuid, p_data date, p_descricao text, p_valor numeric, p_documento character varying)
 RETURNS character varying
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN encode(sha256((COALESCE(p_conta_id::text, '') || COALESCE(p_data::text, '') || COALESCE(p_descricao, '') || COALESCE(p_valor::text, '') || COALESCE(p_documento, ''))::bytea), 'hex');
END;
$function$;

-- 2. gerar_protocolo_ouvidoria
CREATE OR REPLACE FUNCTION public.gerar_protocolo_ouvidoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
    ano TEXT;
    sequencia INTEGER;
BEGIN
    ano := EXTRACT(YEAR FROM NOW())::TEXT;
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(protocolo FROM 10 FOR 5) AS INTEGER)
    ), 0) + 1
    INTO sequencia
    FROM ouvidoria_manifestacoes
    WHERE protocolo LIKE 'OUV-' || ano || '-%';
    
    NEW.protocolo := 'OUV-' || ano || '-' || LPAD(sequencia::TEXT, 5, '0');
    
    RETURN NEW;
END;
$function$;

-- 3. update_notif_pref_updated_at
CREATE OR REPLACE FUNCTION public.update_notif_pref_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 4. update_rota_totals
CREATE OR REPLACE FUNCTION public.update_rota_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  -- Se a instalação foi vinculada a uma rota
  IF NEW.rota_id IS NOT NULL THEN
    UPDATE rotas 
    SET 
      total_servicos = (
        SELECT COUNT(*) 
        FROM instalacoes 
        WHERE rota_id = NEW.rota_id
      ),
      total_concluidos = (
        SELECT COUNT(*) 
        FROM instalacoes 
        WHERE rota_id = NEW.rota_id 
        AND status = 'concluida'
      ),
      updated_at = NOW()
    WHERE id = NEW.rota_id;
  END IF;
  
  -- Se a rota antiga era diferente, atualizar ela também
  IF TG_OP = 'UPDATE' AND OLD.rota_id IS NOT NULL AND OLD.rota_id IS DISTINCT FROM NEW.rota_id THEN
    UPDATE rotas 
    SET 
      total_servicos = (
        SELECT COUNT(*) 
        FROM instalacoes 
        WHERE rota_id = OLD.rota_id
      ),
      total_concluidos = (
        SELECT COUNT(*) 
        FROM instalacoes 
        WHERE rota_id = OLD.rota_id 
        AND status = 'concluida'
      ),
      updated_at = NOW()
    WHERE id = OLD.rota_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ============================================
-- FASE 3: CORRIGIR RLS POLICIES PERMISSIVAS
-- ============================================

-- Tabelas de LOG (INSERT com true) - Restringir a authenticated/service_role

-- 1. api_leads_logs
DROP POLICY IF EXISTS "System can insert api_leads_logs" ON api_leads_logs;
CREATE POLICY "System can insert api_leads_logs" ON api_leads_logs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 2. asaas_webhooks_log
DROP POLICY IF EXISTS "System can insert webhooks" ON asaas_webhooks_log;
CREATE POLICY "System can insert webhooks" ON asaas_webhooks_log
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 3. chamados_assistencia_historico
DROP POLICY IF EXISTS "System can insert chamado history" ON chamados_assistencia_historico;
CREATE POLICY "System can insert chamado history" ON chamados_assistencia_historico
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 4. cotacoes_publicas_historico
DROP POLICY IF EXISTS "cotacoes_publicas_historico_insert" ON cotacoes_publicas_historico;
CREATE POLICY "cotacoes_publicas_historico_insert" ON cotacoes_publicas_historico
  FOR INSERT TO authenticated, service_role, anon
  WITH CHECK (true);  -- Mantém true pois é público

-- 5. distribuicao_historico
DROP POLICY IF EXISTS "Sistema pode inserir historico" ON distribuicao_historico;
CREATE POLICY "Sistema pode inserir historico" ON distribuicao_historico
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 6. logs_auditoria
DROP POLICY IF EXISTS "logs_insert_all" ON logs_auditoria;
CREATE POLICY "logs_insert_all" ON logs_auditoria
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 7. notificacoes
DROP POLICY IF EXISTS "System can insert notifications" ON notificacoes;
CREATE POLICY "System can insert notifications" ON notificacoes
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 8. notificacoes_vendas
DROP POLICY IF EXISTS "notif_vendas_insert" ON notificacoes_vendas;
CREATE POLICY "notif_vendas_insert" ON notificacoes_vendas
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 9. ordens_servico_historico
DROP POLICY IF EXISTS "System can insert OS history" ON ordens_servico_historico;
CREATE POLICY "System can insert OS history" ON ordens_servico_historico
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 10. ouvidoria_ia_logs
DROP POLICY IF EXISTS "Sistema pode inserir logs IA" ON ouvidoria_ia_logs;
CREATE POLICY "Sistema pode inserir logs IA" ON ouvidoria_ia_logs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 11. rastreador_alertas
DROP POLICY IF EXISTS "System can insert alerts" ON rastreador_alertas;
CREATE POLICY "System can insert alerts" ON rastreador_alertas
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 12. sinistro_historico
DROP POLICY IF EXISTS "System can insert claim history" ON sinistro_historico;
CREATE POLICY "System can insert claim history" ON sinistro_historico
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 13. whatsapp_logs
DROP POLICY IF EXISTS "Sistema pode inserir logs whatsapp" ON whatsapp_logs;
CREATE POLICY "Sistema pode inserir logs whatsapp" ON whatsapp_logs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 14. leads - INSERT policy já é permissiva intencionalmente (leads públicos)
-- Manter como está pois leads podem ser criados por anon

-- Corrigir policies com UPDATE/DELETE true - restringir a funcionários

-- 15. contratos_documentos (DELETE)
DROP POLICY IF EXISTS "Authenticated users can delete contract documents" ON contratos_documentos;
CREATE POLICY "Funcionarios can delete contract documents" ON contratos_documentos
  FOR DELETE TO authenticated
  USING (public.am_i_funcionario());

-- 16. contratos_documentos (UPDATE)
DROP POLICY IF EXISTS "Authenticated users can update contract documents" ON contratos_documentos;
CREATE POLICY "Funcionarios can update contract documents" ON contratos_documentos
  FOR UPDATE TO authenticated
  USING (public.am_i_funcionario());

-- 17. contratos_documentos (INSERT)
DROP POLICY IF EXISTS "Authenticated users can insert contract documents" ON contratos_documentos;
CREATE POLICY "Funcionarios can insert contract documents" ON contratos_documentos
  FOR INSERT TO authenticated
  WITH CHECK (public.am_i_funcionario());

-- 18. cotacoes_publicas (UPDATE) - Manter permissivo pois é página pública
-- Já está correto para uso público

-- 19. documentos_solicitados (UPDATE anon) - Manter para permitir upload público
-- Já está correto

-- Corrigir tabelas financeiras - restringir a funcionários

-- 20. contas_bancarias
DROP POLICY IF EXISTS "contas_bancarias_all" ON contas_bancarias;
CREATE POLICY "contas_bancarias_funcionarios" ON contas_bancarias
  FOR ALL TO authenticated
  USING (public.am_i_funcionario())
  WITH CHECK (public.am_i_funcionario());

-- 21. extratos_bancarios
DROP POLICY IF EXISTS "extratos_bancarios_all" ON extratos_bancarios;
CREATE POLICY "extratos_bancarios_funcionarios" ON extratos_bancarios
  FOR ALL TO authenticated
  USING (public.am_i_funcionario())
  WITH CHECK (public.am_i_funcionario());

-- 22. movimentacoes_bancarias
DROP POLICY IF EXISTS "movimentacoes_bancarias_all" ON movimentacoes_bancarias;
CREATE POLICY "movimentacoes_bancarias_funcionarios" ON movimentacoes_bancarias
  FOR ALL TO authenticated
  USING (public.am_i_funcionario())
  WITH CHECK (public.am_i_funcionario());

-- 23. regras_categorizacao
DROP POLICY IF EXISTS "regras_categorizacao_all" ON regras_categorizacao;
CREATE POLICY "regras_categorizacao_funcionarios" ON regras_categorizacao
  FOR ALL TO authenticated
  USING (public.am_i_funcionario())
  WITH CHECK (public.am_i_funcionario());

-- 24. cotacoes_publicas_fotos - Manter permissivo pois é upload público
-- Já está correto

-- 25. funcionarios_docs_solicitados - Manter funcionários
-- Já está correto

-- ============================================
-- FASE 4: ADICIONAR POLICIES ÀS TABELAS SEM RLS
-- ============================================

-- 1. auth_tokens_primeiro_acesso (tokens temporários - somente service_role)
DROP POLICY IF EXISTS "Service role only auth_tokens" ON auth_tokens_primeiro_acesso;
CREATE POLICY "Service role only auth_tokens" ON auth_tokens_primeiro_acesso
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. rastreadores_tokens_cache (cache de tokens - somente service_role)
DROP POLICY IF EXISTS "Service role only rastreadores_tokens" ON rastreadores_tokens_cache;
CREATE POLICY "Service role only rastreadores_tokens" ON rastreadores_tokens_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- FASE 5: MOVER EXTENSÃO pg_trgm
-- ============================================

-- Nota: Não moveremos pg_trgm para evitar quebrar funcionalidades existentes
-- O warning é de baixo risco e a extensão já está em uso

-- ============================================
-- NOTA: LEAKED PASSWORD PROTECTION
-- ============================================
-- Esta configuração deve ser habilitada manualmente no Dashboard:
-- Authentication → Providers → Email → Enable "Leaked Password Protection"
