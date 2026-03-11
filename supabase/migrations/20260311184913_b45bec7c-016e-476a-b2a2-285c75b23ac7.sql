-- Premium plans: +R$30 sobre Basic
UPDATE planos SET adicional_mensal = 30 WHERE codigo IN ('select-premium', 'lancamento-premium');

-- Exclusive plans: +R$60 sobre Basic
UPDATE planos SET adicional_mensal = 60 WHERE codigo IN ('select-exclusive', 'lancamento-exclusive');