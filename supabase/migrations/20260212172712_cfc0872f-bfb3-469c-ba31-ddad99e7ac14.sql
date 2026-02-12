-- Adicionar coluna dados_novo_titular na tabela chat_solicitacoes_ia
ALTER TABLE public.chat_solicitacoes_ia 
ADD COLUMN IF NOT EXISTS dados_novo_titular jsonb;

-- Inserir novo document_type: termo_cancelamento
INSERT INTO public.document_types (code, name, description, is_active, sort_order, required_variables)
VALUES (
  'termo_cancelamento',
  'Termo de Cancelamento',
  'Termo gerado para cancelamento de filiação ou troca de titularidade',
  true,
  40,
  '["associado.nome", "associado.cpf", "veiculo.placa", "veiculo.marca", "veiculo.modelo", "contrato.numero", "cancelamento.motivo", "cancelamento.data", "sistema.data_atual"]'::jsonb
)
ON CONFLICT (code) DO NOTHING;