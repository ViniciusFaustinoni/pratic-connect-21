-- Adicionar coluna coberturas à tabela planos (se não existir)
ALTER TABLE planos ADD COLUMN IF NOT EXISTS coberturas TEXT[] DEFAULT '{}';

-- Atualizar coberturas do Plano Básico
UPDATE planos SET coberturas = ARRAY[
  'Colisão (100% FIPE)',
  'Roubo e Furto (100% FIPE)',
  'Incêndio Total',
  'Perda Total',
  'Assistência 24h básica (200km)'
] WHERE codigo = 'BASICO';

-- Atualizar coberturas do Plano Total
UPDATE planos SET coberturas = ARRAY[
  'Colisão (100% FIPE)',
  'Roubo e Furto (100% FIPE)',
  'Incêndio Total',
  'Perda Total',
  'Vidros completos',
  'App de Rastreamento 24h',
  'Assistência 24h completa',
  'Reboque ilimitado'
] WHERE codigo = 'TOTAL';

-- Atualizar coberturas do Plano Premium
UPDATE planos SET coberturas = ARRAY[
  'Colisão (100% FIPE)',
  'Roubo e Furto (100% FIPE)',
  'Incêndio Total',
  'Perda Total',
  'Vidros completos',
  'App de Rastreamento 24h',
  'Assistência 24h VIP',
  'Reboque ilimitado',
  'Carro reserva (7 dias)',
  'Proteção para terceiros',
  'Faróis e lanternas',
  'Retrovisores'
] WHERE codigo = 'PREMIUM';