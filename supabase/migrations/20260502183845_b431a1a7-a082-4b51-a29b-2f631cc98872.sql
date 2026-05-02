-- Permitir que o fluxo público de cotação (cliente anon, com token) crie agendamento na base.
-- Os dados são inseridos a partir da página /cotacao/<token_publico> via publicSupabase (chave anon).
-- A policy valida que o cotacao_id informado corresponde a uma cotação com token público gerado.

CREATE POLICY "Anon cria agendamentos_base via cotacao com token"
ON public.agendamentos_base
FOR INSERT
TO anon, authenticated
WITH CHECK (
  cotacao_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.cotacoes c
    WHERE c.id = agendamentos_base.cotacao_id
      AND c.token_publico IS NOT NULL
  )
);

-- Espelha permissão de SELECT do anon para a mesma origem (token de cotação),
-- garantindo que após o INSERT o cliente consiga ler/listar o próprio agendamento.
CREATE POLICY "Anon ve agendamentos_base via cotacao token"
ON public.agendamentos_base
FOR SELECT
TO anon, authenticated
USING (
  cotacao_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.cotacoes c
    WHERE c.id = agendamentos_base.cotacao_id
      AND c.token_publico IS NOT NULL
  )
);