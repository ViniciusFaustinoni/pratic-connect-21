-- Colunas para registro de imprevistos e reagendamento
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS imprevisto_registrado_em timestamptz;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS imprevisto_motivo text;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS imprevisto_duplo_check boolean DEFAULT false;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS imprevisto_duplo_check_em timestamptz;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS reagendamento_token uuid DEFAULT gen_random_uuid();
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS reagendamento_enviado_em timestamptz;

-- RLS para acesso público ao reagendamento por token
CREATE POLICY "Acesso público reagendamento por token"
ON servicos FOR SELECT TO anon
USING (reagendamento_token IS NOT NULL);

-- Permitir que anon faça update limitado para reagendamento
CREATE POLICY "Anon pode atualizar status reagendamento"
ON servicos FOR UPDATE TO anon
USING (reagendamento_token IS NOT NULL)
WITH CHECK (reagendamento_token IS NOT NULL);

-- Permitir que anon insira novo serviço via reagendamento
CREATE POLICY "Anon pode inserir servico via reagendamento"
ON servicos FOR INSERT TO anon
WITH CHECK (true);