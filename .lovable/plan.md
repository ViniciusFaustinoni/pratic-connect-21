

# Fix: Template `boas_vindas_associado` — formato de botões e variáveis de exemplo

## Problemas no banco

1. `botoes` armazenado como `[{"type": "URL", "text": "..."}]` — o código espera `[{"tipo": "url", "texto": "..."}]`
2. `variaveis_exemplo` tem apenas `{"1": "João", "2": "ABC-1234"}` mas o corpo tem 4 variáveis — Meta exige exemplos para todas
3. `status` ficou `REJECTED` pela tentativa anterior com formato errado

## Correção

### 1 migration SQL

```sql
UPDATE whatsapp_meta_templates
SET
  botoes = '[{"tipo": "url", "texto": "Acessar App PRATIC", "url": "https://pratic-connect-21.lovable.app/acompanhar/{{1}}"}]'::jsonb,
  variaveis_exemplo = '{"1": "João", "2": "ABC1234 - Toyota Corolla XEi", "3": "Roubo e Furto", "4": "Instalação do rastreador"}'::jsonb,
  status = 'DRAFT',
  updated_at = now()
WHERE nome = 'boas_vindas_associado';
```

### Nenhuma alteração em código
O drawer e a edge function já usam `tipo`/`texto` — o problema era apenas o dado gravado pela migration anterior.

