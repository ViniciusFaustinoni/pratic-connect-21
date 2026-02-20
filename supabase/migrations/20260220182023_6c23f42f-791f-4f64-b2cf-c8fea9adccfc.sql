-- Adicionar status pecas_em_cotacao ao enum status_sinistro
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'pecas_em_cotacao';