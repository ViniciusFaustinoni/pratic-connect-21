CREATE OR REPLACE FUNCTION public.update_associado_contatos(
  _associado_id uuid,
  _telefone text,
  _telefone_secundario text DEFAULT NULL,
  _email text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_funcionario(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar contatos';
  END IF;

  UPDATE associados
  SET telefone = _telefone,
      telefone_secundario = _telefone_secundario,
      email = _email,
      updated_at = now()
  WHERE id = _associado_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associado não encontrado';
  END IF;
END;
$$;