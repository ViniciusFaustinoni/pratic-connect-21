-- Atualizar policy config_base_public_read para incluir chaves de pricing
DROP POLICY IF EXISTS "config_base_public_read" ON public.configuracoes;

CREATE POLICY "config_base_public_read" ON public.configuracoes
FOR SELECT
TO anon, authenticated
USING (
  chave IN (
    'base_cep', 'base_logradouro', 'base_numero', 'base_bairro',
    'base_cidade', 'base_uf', 'base_complemento',
    'base_horario_inicio', 'base_horario_fim', 'base_capacidade_horario',
    'taxa_fallback_carro', 'adicional_app'
  )
);