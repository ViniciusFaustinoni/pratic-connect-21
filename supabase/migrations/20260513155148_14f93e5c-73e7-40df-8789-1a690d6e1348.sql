CREATE OR REPLACE FUNCTION public.update_associado_endereco(
  _associado_id uuid,
  _cep text DEFAULT NULL,
  _logradouro text DEFAULT NULL,
  _numero text DEFAULT NULL,
  _complemento text DEFAULT NULL,
  _bairro text DEFAULT NULL,
  _cidade text DEFAULT NULL,
  _uf text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Mesma porta de entrada usada por update_associado_contatos:
  -- qualquer funcionário interno pode editar (regras finas no client por papel).
  IF NOT is_funcionario(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar endereço';
  END IF;

  UPDATE associados
  SET cep         = COALESCE(NULLIF(btrim(_cep), ''), cep),
      logradouro  = COALESCE(NULLIF(btrim(_logradouro), ''), logradouro),
      numero      = COALESCE(NULLIF(btrim(_numero), ''), numero),
      complemento = CASE WHEN _complemento IS NULL THEN complemento ELSE NULLIF(btrim(_complemento), '') END,
      bairro      = COALESCE(NULLIF(btrim(_bairro), ''), bairro),
      cidade      = COALESCE(NULLIF(btrim(_cidade), ''), cidade),
      uf          = COALESCE(NULLIF(upper(btrim(_uf)), ''), uf),
      updated_at  = now()
  WHERE id = _associado_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associado não encontrado';
  END IF;
END;
$function$;
