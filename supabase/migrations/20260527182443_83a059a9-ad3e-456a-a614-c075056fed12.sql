-- Estender a policy de "vendedor ve titular antigo de suas trocas":
-- a anterior so cobria trocas com cotacao vinculada (c.vendedor_id = auth.uid()),
-- mas trocas iniciadas pela consultora ficam com cotacao_id NULL ate ela selecionar o plano.
-- Resultado pratico (caso JEICIELI / troca 7d52b6bc-…): o painel mostrava
-- "Sem e-mail" e "—" como origem porque o JOIN com associados retornava vazio.
-- Agora tambem liberamos a leitura quando o usuario logado e o `criado_por` da troca
-- (criado_por guarda profiles.id).

DROP POLICY IF EXISTS "Vendedor pode ver titular antigo de suas trocas" ON public.associados;

CREATE POLICY "Vendedor pode ver titular antigo de suas trocas"
ON public.associados
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.solicitacoes_troca_titularidade s
    LEFT JOIN public.cotacoes c ON c.id = s.cotacao_id
    WHERE s.associado_antigo_id = associados.id
      AND (
        c.vendedor_id = auth.uid()
        OR s.criado_por IN (
          SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
        )
      )
  )
);