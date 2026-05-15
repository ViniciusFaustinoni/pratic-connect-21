CREATE OR REPLACE FUNCTION public.audit_delete_critico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_user_nome text;
  v_dados jsonb;
  v_descricao text;
BEGIN
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NOT NULL THEN
    SELECT id, COALESCE(nome, email)
      INTO v_profile_id, v_user_nome
      FROM public.profiles
     WHERE user_id = v_user_id
     LIMIT 1;
  END IF;

  IF TG_TABLE_NAME = 'contratos' THEN
    v_dados := jsonb_build_object(
      'numero', OLD.numero,
      'associado_id', OLD.associado_id,
      'veiculo_id', OLD.veiculo_id,
      'cotacao_id', OLD.cotacao_id,
      'plano_id', OLD.plano_id,
      'status', OLD.status,
      'autentique_status', OLD.autentique_status,
      'created_at', OLD.created_at
    );
    v_descricao := format('[AUDITORIA UNIVERSAL] Contrato %s excluído', COALESCE(OLD.numero, OLD.id::text));

  ELSIF TG_TABLE_NAME = 'associados' THEN
    v_dados := jsonb_build_object(
      'nome', OLD.nome,
      'cpf', OLD.cpf,
      'email', OLD.email,
      'telefone', OLD.telefone,
      'status', OLD.status,
      'created_at', OLD.created_at
    );
    v_descricao := format('[AUDITORIA UNIVERSAL] Associado %s (CPF %s) excluído', OLD.nome, COALESCE(OLD.cpf, '-'));

  ELSIF TG_TABLE_NAME = 'veiculos' THEN
    v_dados := jsonb_build_object(
      'placa', OLD.placa,
      'marca', OLD.marca,
      'modelo', OLD.modelo,
      'ano_fabricacao', OLD.ano_fabricacao,
      'ano_modelo', OLD.ano_modelo,
      'associado_id', OLD.associado_id,
      'status', OLD.status,
      'valor_fipe', OLD.valor_fipe,
      'created_at', OLD.created_at
    );
    v_descricao := format('[AUDITORIA UNIVERSAL] Veículo %s (%s %s %s/%s) excluído',
      COALESCE(OLD.placa,'-'),
      COALESCE(OLD.marca,''),
      COALESCE(OLD.modelo,''),
      COALESCE(OLD.ano_fabricacao::text,''),
      COALESCE(OLD.ano_modelo::text,''));
  END IF;

  INSERT INTO public.logs_auditoria (
    usuario_id, usuario_nome, acao, modulo, tabela, registro_id, dados_anteriores, descricao
  ) VALUES (
    v_profile_id,
    COALESCE(v_user_nome, '[SISTEMA/SQL DIRETO]'),
    'excluir',
    TG_TABLE_NAME,
    TG_TABLE_NAME,
    OLD.id,
    v_dados,
    v_descricao
  );

  RETURN OLD;
END;
$function$;