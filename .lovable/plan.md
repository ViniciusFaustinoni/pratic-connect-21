
# Correção: URL do Botão + Geração de Token de Primeiro Acesso

## Problema

O template `ativacao_conta_pratic` no banco está com URL errada no botão: `/app/login/{{1}}` (rota inexistente). Precisa ser `/app/criar-senha?token={{1}}`. Além disso, a função `ativar-associado` passa `associado.id` como parâmetro do botão em vez de um token de 48h.

## Alterações

### 1. Atualizar URL do template no banco (UPDATE via insert tool)

```sql
UPDATE whatsapp_meta_templates 
SET botoes = '[{"type": "URL", "text": "Acessar meu App", "url": "https://pratic-connect-21.lovable.app/app/criar-senha?token={{1}}"}]'::jsonb,
    updated_at = now()
WHERE nome = 'ativacao_conta_pratic';
```

### 2. Corrigir migration SQL para referência futura

Atualizar a URL no arquivo `supabase/migrations/20260309223238_...sql` de `/app/login/{{1}}` para `/app/criar-senha?token={{1}}`.

### 3. `ativar-associado/index.ts` — Gerar token de 48h (linhas 272-275)

Substituir o trecho que passa `associado.id` por lógica que:
1. Invalida tokens anteriores do associado
2. Gera `crypto.randomUUID()` com expiração de 48h
3. Insere na tabela `auth_tokens_primeiro_acesso`
4. Passa o token no `template_button_params`

```typescript
// Gerar token de primeiro acesso (48h)
const tokenPrimeiroAcesso = crypto.randomUUID();
const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000);

await supabaseAdmin
  .from('auth_tokens_primeiro_acesso')
  .update({ usado: true, usado_em: new Date().toISOString() })
  .eq('associado_id', associado.id)
  .eq('usado', false);

await supabaseAdmin
  .from('auth_tokens_primeiro_acesso')
  .insert({
    associado_id: associado.id,
    token: tokenPrimeiroAcesso,
    expira_em: expiraEm.toISOString(),
    usado: false
  });

sendBody.template_name = 'ativacao_conta_pratic';
sendBody.template_params = [primeiroNome, veiculoDescricao, cobertura];
sendBody.template_button_params = [tokenPrimeiroAcesso];
```

## Resultado

O botão do WhatsApp levará para:
```
https://pratic-connect-21.lovable.app/app/criar-senha?token=uuid-unico-48h
```

| Arquivo | Alteração |
|---|---|
| BD: `whatsapp_meta_templates` | UPDATE URL do botão |
| `supabase/migrations/20260309223238_...sql` | Corrigir URL para referência |
| `supabase/functions/ativar-associado/index.ts` | Gerar token 48h + usar no botão |
