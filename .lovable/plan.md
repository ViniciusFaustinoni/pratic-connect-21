

# Plano: Adicionar coluna + Inserir dados Advanced (Motos)

## PARTE 1 — Migration (Schema)

Criar migration SQL para adicionar a coluna:

```sql
ALTER TABLE tabelas_preco_mensalidade
ADD COLUMN IF NOT EXISTS requer_autorizacao boolean DEFAULT false;
```

## PARTE 2 — Inserir 78 registros

Inserir todos os registros fornecidos via SQL INSERT em `tabelas_preco_mensalidade`:

- **GRUPO 1:** advanced | rj | advanced — 16 faixas
- **GRUPO 2:** advanced | rj | advanced-plus — 10 faixas
- **GRUPO 3:** advanced | lagos | advanced — 16 faixas
- **GRUPO 4:** advanced | lagos | advanced-plus — 10 faixas
- **GRUPO 5:** advanced | sp | advanced — 16 faixas
- **GRUPO 6:** advanced | sp | advanced-plus — 10 faixas

**Total: 78 registros**

## PARTE 3 — Verificação

Executar query de verificação para confirmar contagens e flags `requer_autorizacao` por região e tipo_uso.

## Observação

Nenhuma alteração de código no frontend é necessária — os hooks já leem de `tabelas_preco_mensalidade` e o campo `requer_autorizacao` será ignorado onde não for usado (campos extras não quebram queries existentes).

