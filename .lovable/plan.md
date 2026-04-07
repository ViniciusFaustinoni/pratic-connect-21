

# Plano: Importar marcas/modelos FIPE

## Situacao

Os dados ja foram coletados da API FIPE: **11.174 modelos** de carros, motos e caminhoes. O CSV esta pronto em `/tmp/fipe_marcas.csv`.

O problema e que a tabela `marcas_modelos` nao possui constraint UNIQUE em `(marca, modelo)`, impedindo o upsert.

## Passos

### 1. Criar constraint UNIQUE na tabela

Migration SQL:
```sql
ALTER TABLE marcas_modelos 
ADD CONSTRAINT marcas_modelos_marca_modelo_key UNIQUE (marca, modelo);
```

### 2. Inserir os 11.174 registros

Usar o REST API do Supabase com `Prefer: resolution=ignore-duplicates` e `on_conflict=marca,modelo` para fazer upsert sem duplicar os 176 registros existentes.

### Resultado esperado

De ~176 registros para ~11.174 registros cobrindo todas as marcas e modelos da FIPE (carros, motos, caminhoes).

