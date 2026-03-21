
-- Add columns to planos for AI agent
ALTER TABLE planos ADD COLUMN IF NOT EXISTS disponivel_agente BOOLEAN DEFAULT false;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS agente_descricao TEXT;

-- Create agente_ia_config table
CREATE TABLE IF NOT EXISTS agente_ia_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE agente_ia_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read agente_ia_config"
  ON agente_ia_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Diretor can manage agente_ia_config"
  ON agente_ia_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- Insert default config values
INSERT INTO agente_ia_config (chave, valor) VALUES
  ('nome_agente', 'Pratic'),
  ('apresentacao_inicial', 'Olá! Sou a Pratic, consultora virtual da Praticcar. Estou aqui para te ajudar a encontrar a melhor proteção para o seu veículo. Posso começar fazendo uma cotação gratuita para você. Qual é o modelo e ano do seu carro?'),
  ('instrucoes_comportamento', 'Seja cordial e profissional. Use linguagem simples e direta. Em caso de dúvidas sobre sinistros, encaminhe para atendimento humano.'),
  ('responder_fora_horario', 'true'),
  ('horario_comercial', '{"dias":["seg","ter","qua","qui","sex"],"inicio":"08:00","fim":"18:00"}'),
  ('mensagem_fora_horario', 'Olá! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Deixe sua mensagem que retornaremos assim que possível!'),
  ('dados_cotacao_opcionais', '{"cpf":false,"uso_veiculo":true,"cor_veiculo":false}'),
  ('mensagem_link_cotacao', 'Sua cotação está pronta! 🎉 Acesse o link abaixo para visualizar os detalhes e confirmar sua proteção:\n[LINK]\nQualquer dúvida, é só me chamar!'),
  ('followup_ativo', 'true'),
  ('followup_config', '[{"horas":2,"mensagem":"Oi! Vi que você recebeu a cotação mas ainda não confirmou. Posso te ajudar com alguma dúvida?"},{"horas":24,"mensagem":"Olá novamente! Sua cotação ainda está válida. Quer que eu explique melhor algum dos planos?"},{"horas":48,"mensagem":"Última mensagem! Sua cotação está prestes a expirar. Se precisar, estou aqui para ajudar. 😊"}]')
ON CONFLICT (chave) DO NOTHING;

-- Create agente_ia_contatos table
CREATE TABLE IF NOT EXISTS agente_ia_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  nome TEXT,
  status TEXT DEFAULT 'em_conversa',
  ultima_interacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(telefone)
);

ALTER TABLE agente_ia_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor can read agente_ia_contatos"
  ON agente_ia_contatos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Diretor can manage agente_ia_contatos"
  ON agente_ia_contatos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- Trigger for updated_at on agente_ia_config
CREATE OR REPLACE TRIGGER set_agente_ia_config_updated_at
  BEFORE UPDATE ON agente_ia_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
