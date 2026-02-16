ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS pecas_chegaram boolean DEFAULT false;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS pecas_chegaram_em timestamptz;