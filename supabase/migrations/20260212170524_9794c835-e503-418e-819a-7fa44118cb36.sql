
-- Adicionar colunas na tabela sinistros para Autentique
ALTER TABLE public.sinistros 
ADD COLUMN IF NOT EXISTS autentique_documento_id text,
ADD COLUMN IF NOT EXISTS autentique_url text;

-- Inserir novo document_type para Termo de Entrada de Evento
INSERT INTO public.document_types (code, name, description, required_variables, sort_order, is_active)
VALUES (
  'termo_entrada_evento',
  'Termo de Entrada de Evento',
  'Termo gerado quando um sinistro/evento é aprovado, para assinatura do associado via Autentique',
  '["evento.protocolo","evento.tipo","evento.data_ocorrencia","evento.parecer","evento.valor_aprovado","associado.nome","associado.cpf","veiculo.placa","veiculo.marca","veiculo.modelo"]',
  30,
  true
)
ON CONFLICT (code) DO NOTHING;
