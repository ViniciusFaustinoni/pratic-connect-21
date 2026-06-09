-- Rehidrata novo_titular_dados em solicitações de troca onde o snapshot legado
-- diverge do associado real já vinculado (caso ALINE→ALINE com novo titular
-- correto em novo_associado_id). Idempotente.
UPDATE solicitacoes_troca_titularidade s
SET novo_titular_dados = jsonb_strip_nulls(jsonb_build_object(
      'nome', a.nome,
      'cpf', regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'),
      'email', a.email,
      'telefone', a.telefone
    )),
    updated_at = now()
FROM associados a
WHERE s.novo_associado_id = a.id
  AND s.efetivada_em IS NULL
  AND (
    coalesce(s.novo_titular_dados->>'nome','') <> coalesce(a.nome,'')
    OR regexp_replace(coalesce(s.novo_titular_dados->>'cpf',''), '\D','','g')
       <> regexp_replace(coalesce(a.cpf,''), '\D','','g')
  );