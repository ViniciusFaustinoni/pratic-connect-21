UPDATE public.configuracoes
SET valor = '["HAOJUE", "SHINERAY", "SUZUKI", "KAWASAKI", "TRIUMPH", "DUCATI", "HARLEY-DAVIDSON", "YAMAHA", "BMW MOTORRAD", "DAFRA", "ROYAL ENFIELD"]',
    updated_at = now()
WHERE chave = 'marcas_exclusivas_moto';