-- Vendedor responsável pela troca de titularidade precisa enxergar o
-- titular antigo (nome, cpf, email, telefone) mesmo que esse associado
-- não esteja na sua carteira. Sem isso, OutrosProcessosPanel mostra
-- "—" como origem e "Sem e-mail" porque o JOIN com associados retorna
-- vazio sob a policy default de vendedor não-gestor.
CREATE POLICY "Vendedor pode ver titular antigo de suas trocas"
ON public.associados
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.solicitacoes_troca_titularidade s
    JOIN public.cotacoes c ON c.id = s.cotacao_id
    WHERE s.associado_antigo_id = associados.id
      AND c.vendedor_id = auth.uid()
  )
);