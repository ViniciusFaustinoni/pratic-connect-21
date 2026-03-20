ALTER TABLE chat_solicitacoes_ia 
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id);