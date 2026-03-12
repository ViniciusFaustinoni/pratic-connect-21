

# Corrigir link do botão WhatsApp de boas-vindas

## Problema

Na Edge Function `ativar-associado`, o último parâmetro do template `cadastro_aprovado_botao` é `associado.id`, gerando URL `/acompanhar/{associado_id}`. Porém, a rota `/acompanhar/:token` espera o `link_token` do contrato, não o ID do associado. Resultado: o botão leva a uma página que não encontra dados.

## Solução

### `supabase/functions/ativar-associado/index.ts`

Antes de montar os params do template, buscar o `link_token` do contrato vinculado ao associado:

```typescript
// Buscar link_token do contrato
const { data: contrato } = await supabaseAdmin
  .from('contratos')
  .select('link_token')
  .eq('associado_id', associado.id)
  .not('link_token', 'is', null)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

const linkParam = contrato?.link_token || associado.id; // fallback seguro
```

Depois, trocar o último parâmetro de `associado.id` para `linkParam`:

```typescript
sendBody.template_params = [primeiroNome, placa, marcaModelo, cobertura, 'Instalação do rastreador', linkParam];
```

Isso faz o botão gerar a URL correta `/acompanhar/{link_token}`, que abre a página de acompanhamento com formulário de criação de senha integrado.

### Deploy
A Edge Function será redeployada automaticamente.

