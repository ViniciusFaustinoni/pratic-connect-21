

# Fix: Template `assinatura_instalacao_v1` — `variaveis_exemplo` com formato errado

## Problema

A migration inseriu `variaveis_exemplo` como **array JSON**:
```json
["João", "HB20 - ABC1234", "https://example.com/acompanhar/token123"]
```

Mas todo o sistema (drawer, preview, edge function de envio à Meta) espera um **objeto com chaves numéricas**:
```json
{"1": "João", "2": "HB20 - ABC1234", "3": "https://example.com/acompanhar/token123"}
```

Quando é array, `Object.keys()` retorna `["0", "1", "2"]` — os índices ficam deslocados em 1 posição. Por isso a preview mostra "Olá HB20 - ABC1234!" (`{{1}}` pega o valor do índice 1 do array = segundo item) em vez de "Olá João!".

## Correção

### Migration SQL

```sql
UPDATE whatsapp_meta_templates
SET variaveis_exemplo = '{"1": "João", "2": "HB20 - ABC1234", "3": "https://app.praticprotecao.com.br/acompanhar/token123"}'::jsonb
WHERE nome = 'assinatura_instalacao_v1';
```

Isso corrige o formato e também atualiza o link de exemplo para o domínio real.

| Arquivo | Ação |
|---|---|
| Nova migration SQL | UPDATE `variaveis_exemplo` de array para objeto com chaves `"1"`, `"2"`, `"3"` |

