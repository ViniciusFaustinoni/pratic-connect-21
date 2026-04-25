-- Função de auditoria universal para DELETE em cotacoes
CREATE OR REPLACE FUNCTION public.audit_cotacao_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_nome text;
BEGIN
  -- Tenta capturar usuário autenticado (pode ser NULL se vier de SQL direto/cron)
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NOT NULL THEN
    SELECT nome INTO v_user_nome FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  END IF;

  INSERT INTO public.logs_auditoria (
    usuario_id,
    usuario_nome,
    acao,
    modulo,
    tabela,
    registro_id,
    dados_anteriores,
    descricao
  ) VALUES (
    v_user_id,
    COALESCE(v_user_nome, '[SISTEMA/SQL DIRETO]'),
    'excluir',
    'cotacoes',
    'cotacoes',
    OLD.id,
    jsonb_build_object(
      'numero', OLD.numero,
      'nome_solicitante', OLD.nome_solicitante,
      'cliente_cpf', OLD.cliente_cpf,
      'veiculo_placa', OLD.veiculo_placa,
      'veiculo_marca', OLD.veiculo_marca,
      'veiculo_modelo', OLD.veiculo_modelo,
      'veiculo_ano', OLD.veiculo_ano,
      'valor_fipe', OLD.valor_fipe,
      'valor_total_mensal', OLD.valor_total_mensal,
      'status', OLD.status,
      'status_contratacao', OLD.status_contratacao,
      'token_publico', OLD.token_publico,
      'created_at', OLD.created_at
    ),
    format('[AUDITORIA UNIVERSAL] Cotação %s (%s %s %s) excluída', 
           OLD.numero, 
           COALESCE(OLD.veiculo_marca, ''), 
           COALESCE(OLD.veiculo_modelo, ''), 
           COALESCE(OLD.veiculo_ano::text, ''))
  );

  RETURN OLD;
END;
$$;

-- Gatilho AFTER DELETE para garantir que rode mesmo quando outros BEFORE DELETE existem
DROP TRIGGER IF EXISTS trigger_audit_cotacao_delete ON public.cotacoes;
CREATE TRIGGER trigger_audit_cotacao_delete
AFTER DELETE ON public.cotacoes
FOR EACH ROW
EXECUTE FUNCTION public.audit_cotacao_delete();