

# Plano: Atribuir Grade "TESTE (Cópia)" a Todos os Vendedores Externos

## Dados encontrados

**Grade**: `TESTE (Cópia)` — ID: `a9518c56-2b76-45ee-ab4e-3c76641342bb`

**5 vendedores externos sem grade** (tabela `usuario_grade_comissao` está vazia):

| Nome | user_id |
|---|---|
| [teste] VENDEDOR EXTERNO | 0e65a299-70ac-4faf-ae2b-cfabab505488 |
| ADRIANO DA SILVA VIEIRA | 9543bb60-3674-4e0f-9e5b-2e579ffceff1 |
| CARLOS EDUARDO DE LIMA NEGREIROS | 047bca0d-fc17-43fb-b075-686316fff8c7 |
| KALAYANE SHASNAM MURADO | 37015964-1f50-4ed6-8249-46f073b06eec |
| SUANE DONOZOR | 98ab00bb-22b1-41b3-8438-076aec22bb0d |

## Ação

Inserir 5 registros na tabela `usuario_grade_comissao` vinculando cada vendedor externo à grade de teste:

```sql
INSERT INTO usuario_grade_comissao (user_id, grade_comissao_id)
VALUES
  ('0e65a299-70ac-4faf-ae2b-cfabab505488', 'a9518c56-2b76-45ee-ab4e-3c76641342bb'),
  ('9543bb60-3674-4e0f-9e5b-2e579ffceff1', 'a9518c56-2b76-45ee-ab4e-3c76641342bb'),
  ('047bca0d-fc17-43fb-b075-686316fff8c7', 'a9518c56-2b76-45ee-ab4e-3c76641342bb'),
  ('37015964-1f50-4ed6-8249-46f073b06eec', 'a9518c56-2b76-45ee-ab4e-3c76641342bb'),
  ('98ab00bb-22b1-41b3-8438-076aec22bb0d', 'a9518c56-2b76-45ee-ab4e-3c76641342bb');
```

Nenhum arquivo de código é alterado — apenas inserção de dados.

