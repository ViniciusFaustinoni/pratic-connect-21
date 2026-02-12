-- Insert new document type for Termo de Saída de Veículo
INSERT INTO public.document_types (code, name, description, is_active)
VALUES ('termo_saida_veiculo', 'Termo de Saída de Veículo', 'Termo assinado pelo associado na conclusão da ordem de serviço para liberação do veículo', true)
ON CONFLICT (code) DO NOTHING;