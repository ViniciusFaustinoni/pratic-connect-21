-- Permitir leitura pública das configurações da base (endereço e horários)
-- Apenas para usuários anônimos (role: anon) e apenas para chaves específicas

CREATE POLICY "config_base_public_read" 
ON public.configuracoes 
FOR SELECT 
TO anon
USING (
  chave IN (
    'base_cep', 
    'base_logradouro', 
    'base_numero',
    'base_bairro', 
    'base_cidade', 
    'base_uf', 
    'base_complemento',
    'base_horario_inicio', 
    'base_horario_fim', 
    'base_capacidade_horario'
  )
);