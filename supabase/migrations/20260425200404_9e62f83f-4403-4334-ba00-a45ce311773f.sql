-- Função genérica de auditoria de DELETE para tabelas críticas
CREATE OR REPLACE FUNCTION public.audit_delete_critico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
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
    SELECT nome INTO v_user_nome FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  END IF;

  -- Snapshot conforme tabela
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
      'ano', OLD.ano,
      'associado_id', OLD.associado_id,
      'status', OLD.status,
      'valor_fipe', OLD.valor_fipe,
      'created_at', OLD.created_at
    );
    v_descricao := format('[AUDITORIA UNIVERSAL] Veículo %s (%s %s %s) excluído', 
      COALESCE(OLD.placa,'-'), COALESCE(OLD.marca,''), COALESCE(OLD.modelo,''), COALESCE(OLD.ano::text,''));
  END IF;

  INSERT INTO public.logs_auditoria (
    usuario_id, usuario_nome, acao, modulo, tabela, registro_id, dados_anteriores, descricao
  ) VALUES (
    v_user_id,
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
$$;

-- Triggers AFTER DELETE
DROP TRIGGER IF EXISTS trigger_audit_contratos_delete ON public.contratos;
CREATE TRIGGER trigger_audit_contratos_delete
AFTER DELETE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.audit_delete_critico();

DROP TRIGGER IF EXISTS trigger_audit_associados_delete ON public.associados;
CREATE TRIGGER trigger_audit_associados_delete
AFTER DELETE ON public.associados
FOR EACH ROW EXECUTE FUNCTION public.audit_delete_critico();

DROP TRIGGER IF EXISTS trigger_audit_veiculos_delete ON public.veiculos;
CREATE TRIGGER trigger_audit_veiculos_delete
AFTER DELETE ON public.veiculos
FOR EACH ROW EXECUTE FUNCTION public.audit_delete_critico();