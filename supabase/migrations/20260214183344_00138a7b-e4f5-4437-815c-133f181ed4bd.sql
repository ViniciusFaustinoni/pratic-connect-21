
ALTER TABLE sinistros 
  ADD COLUMN IF NOT EXISTS bombeiros_acionados BOOLEAN,
  ADD COLUMN IF NOT EXISTS analise_interna BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS analise_interna_motivos TEXT[];
