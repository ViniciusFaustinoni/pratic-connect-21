UPDATE configuracoes 
SET valor = '[{"procedimento":"Adesão","taxa":"1% da FIPE (mín. R$ 100)"},{"procedimento":"Substituição","taxa":"R$ 50"},{"procedimento":"Revistoria","taxa":"R$ 50"},{"procedimento":"Troca Titularidade","taxa":"R$ 50"},{"procedimento":"Multa Rastreador","taxa":"R$ 400"}]',
    updated_at = now()
WHERE chave = 'taxas_procedimentos';