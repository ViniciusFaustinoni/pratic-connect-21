-- LIMPEZA LEGADO TROCA TITULARIDADE — Anderson (KPJ4994), solicitação única.
DO $$
DECLARE
  v_sol_id uuid := '69498d3e-63ba-42d7-8b14-93ccebeae47a';
  v_cot_a  uuid := 'f3229bbe-d57d-46e1-906d-9182decc59f3';
  v_cot_b  uuid := '87947f87-2c9e-4393-af59-ef94b9a783dd';
  v_num_a  text := 'COT-20260525-162758561-177';
  v_motivo text;
  v_check_status_sol text; v_check_cot_id_sol uuid;
  v_check_origem_a boolean; v_check_status_a text;
  v_check_status_b text; v_check_motivo_b text;
BEGIN
  -- 1) Repointar solicitação para cotação A
  UPDATE public.solicitacoes_troca_titularidade
     SET cotacao_id = v_cot_a, updated_at = now()
   WHERE id = v_sol_id AND cotacao_id = v_cot_b;

  -- 2) Corrigir flag origem_troca_titularidade da cotação A
  UPDATE public.cotacoes
     SET origem_troca_titularidade = true, updated_at = now()
   WHERE id = v_cot_a AND COALESCE(origem_troca_titularidade, false) = false;

  -- 3) Cancelar cotação B com motivo rastreável
  v_motivo := 'Cotação duplicada por clique duplo no fluxo de troca de titularidade. '
           || 'Solicitação ' || v_sol_id::text || '. '
           || 'Cotação válida: ' || v_num_a || ' (id ' || v_cot_a::text || '). '
           || 'Cancelada via correção manual em '
           || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI:SS')
           || ' BRT (migration limpeza legado pré-Camada 3 UNIQUE index).';

  UPDATE public.cotacoes
     SET status = 'cancelada', motivo_cancelamento = v_motivo, updated_at = now()
   WHERE id = v_cot_b AND status <> 'cancelada';

  -- 4) Auditoria — acao 'editar' (valor canônico do CHECK p/ UPDATE); 'cancelar' p/ cotação B
  INSERT INTO public.logs_auditoria (acao, tabela, registro_id, descricao, usuario_id)
  VALUES
    ('editar', 'solicitacoes_troca_titularidade', v_sol_id,
     '[LIMPEZA_LEGADO_TROCA_TITULARIDADE] Solicitação repointada da cotação B (' || v_cot_b::text
       || ', COT-20260525-162853543-609, duplicata vazia por clique duplo) para a cotação A ('
       || v_cot_a::text || ', ' || v_num_a || ', contrato assinado e pagamento_ok). '
       || 'Promoção manual cotacao_em_andamento -> aguardando_cadastro '
       || '(trigger fn_troca_promove_cadastro_via_cotacao não dispararia: status_contratacao da cotação A não muda).',
     NULL),
    ('editar', 'cotacoes', v_cot_a,
     '[LIMPEZA_LEGADO_TROCA_TITULARIDADE] origem_troca_titularidade corrigido false -> true. '
       || 'Cotação A vinculada à solicitação ' || v_sol_id::text || '. '
       || 'Flag estava errada porque a cotação nasceu fora do fluxo canônico de troca; '
       || 'sem isso, relatórios/filtros que checam essa flag ignorariam o Anderson silenciosamente.',
     NULL),
    ('cancelar', 'cotacoes', v_cot_b,
     '[LIMPEZA_LEGADO_TROCA_TITULARIDADE] Cotação cancelada por ser duplicata da cotação A ('
       || v_cot_a::text || ', ' || v_num_a || '). '
       || 'Originada por clique duplo no botão Realizar Cotação antes das Camadas 1+2 de prevenção subirem. '
       || 'Solicitação envolvida: ' || v_sol_id::text || '.',
     NULL);

  -- 5) Promoção manual aguardando_cadastro (status exato esperado pelo edge aprovar-troca-cadastro)
  UPDATE public.solicitacoes_troca_titularidade
     SET status = 'aguardando_cadastro', updated_at = now()
   WHERE id = v_sol_id AND status = 'cotacao_em_andamento';

  -- 6) Verificação final
  SELECT status, cotacao_id INTO v_check_status_sol, v_check_cot_id_sol
    FROM public.solicitacoes_troca_titularidade WHERE id = v_sol_id;
  SELECT origem_troca_titularidade, status INTO v_check_origem_a, v_check_status_a
    FROM public.cotacoes WHERE id = v_cot_a;
  SELECT status, motivo_cancelamento INTO v_check_status_b, v_check_motivo_b
    FROM public.cotacoes WHERE id = v_cot_b;

  IF v_check_status_sol <> 'aguardando_cadastro' THEN
    RAISE EXCEPTION '[LIMPEZA_LEGADO_TROCA] FALHA: solicitação em status %', v_check_status_sol; END IF;
  IF v_check_cot_id_sol <> v_cot_a THEN
    RAISE EXCEPTION '[LIMPEZA_LEGADO_TROCA] FALHA: solicitação aponta para %', v_check_cot_id_sol; END IF;
  IF v_check_origem_a IS DISTINCT FROM true THEN
    RAISE EXCEPTION '[LIMPEZA_LEGADO_TROCA] FALHA: cotação A origem_troca=%', v_check_origem_a; END IF;
  IF v_check_status_a <> 'aceita' THEN
    RAISE EXCEPTION '[LIMPEZA_LEGADO_TROCA] FALHA: cotação A virou %', v_check_status_a; END IF;
  IF v_check_status_b <> 'cancelada' THEN
    RAISE EXCEPTION '[LIMPEZA_LEGADO_TROCA] FALHA: cotação B em %', v_check_status_b; END IF;
  IF v_check_motivo_b IS NULL OR (v_check_motivo_b NOT LIKE '%LIMPEZA_LEGADO_TROCA%' AND v_check_motivo_b NOT LIKE '%duplicada%') THEN
    RAISE EXCEPTION '[LIMPEZA_LEGADO_TROCA] FALHA: motivo de cancelamento da cotação B sem rastreabilidade'; END IF;

  RAISE NOTICE '[LIMPEZA_LEGADO_TROCA] OK — todas as operações aplicadas e verificadas.';
END $$;