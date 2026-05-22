
DO $$
DECLARE
  v_contrato_id uuid := '34d9cf53-c1c9-43c5-aeba-3faff7c8dcf0';
  v_admin_id uuid := '37beadcf-284b-4a2c-88a0-6efa8cae60d9';
BEGIN
  UPDATE public.contratos
     SET cadastro_aprovado = true,
         aprovado_por = v_admin_id,
         aprovado_em = now(),
         updated_at = now()
   WHERE id = v_contrato_id
     AND cadastro_aprovado = false;

  INSERT INTO public.logs_auditoria (usuario_id, usuario_nome, acao, tabela, registro_id, descricao, dados_novos)
  VALUES (
    v_admin_id,
    'admin@teste.com',
    'aprovar',
    'contratos',
    v_contrato_id,
    'Aprovação manual de Cadastro para destravar conclusão de instalação (RKD2A94 — Ricardo). Monitoramento atribuiu técnico antes do Cadastro aprovar.',
    jsonb_build_object(
      'cadastro_aprovado', true,
      'cotacao', 'COT-20260501-083648764-873',
      'instalacao_id', '7c4877dc-8e9a-40bc-a0d8-ecdcda9d7e1f'
    )
  );
END $$;
