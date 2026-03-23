

# Plano: Corrigir Template `boas_vindas_agencia_v1` — Adicionar Exemplos e Botão URL

## Problema

A migration inseriu o template sem:
1. `variaveis_exemplo` — Meta exige exemplos preenchidos para aprovar
2. `botoes` — o link de acesso deveria ser um **botão URL** (como outros templates do sistema), não texto inline no corpo
3. O corpo tem `{{2}}` no meio do texto como link — isso não funciona bem na Meta; o link deve ir no botão

## Solução

Uma migration UPDATE para corrigir o template existente:

```sql
UPDATE whatsapp_meta_templates 
SET 
  corpo = 'Olá {{1}}, bem-vindo(a) ao Painel PRATIC! Seu acesso foi criado com sucesso. Utilize o botão abaixo para acessar sua conta. Em caso de dúvidas, entre em contato com nosso suporte.',
  variaveis_exemplo = '{"1": "Agência Exemplo"}',
  botoes = '[{"type": "URL", "text": "Acessar Painel", "url": "https://pratic-connect-21.lovable.app/app/criar-senha?token={{1}}"}]',
  updated_at = now()
WHERE nome = 'boas_vindas_agencia_v1';
```

Mudanças:
- Remove `{{2}}` do corpo (link vai no botão)
- Adiciona `variaveis_exemplo` com exemplo para `{{1}}`
- Adiciona botão URL "Acessar Painel" com variável `{{1}}` na URL
- Corpo agora tem apenas `{{1}}` (nome da agência) — 1 variável no corpo, 1 variável no botão

## Arquivo afetado

| Arquivo | Alteração |
|---|---|
| Migration SQL | UPDATE template com exemplos + botão URL |

