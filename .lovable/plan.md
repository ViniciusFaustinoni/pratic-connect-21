

## Diagnóstico

O template `cadastro_aprovado_botao` tem um botão com URL dinâmica: `.../acompanhar/{{1}}`.

O parâmetro do botão (último item do array `template_params`) está sendo preenchido com **`associado.id`** em todos os mapeamentos do `notificar-cliente/index.ts`.

Porém, a rota `/acompanhar/:token` busca pelo **`contrato.link_token`** na tabela `contratos`, não pelo `associado.id`.

Resultado: o link enviado no WhatsApp aponta para o ID errado e a página não encontra dados.

O mesmo problema **não** ocorre no `ativar-associado/index.ts`, que usa o mesmo template mas com URL de botão diferente (`/app/criar-senha?token={{1}}`), portanto lá o parâmetro é `tokenPrimeiroAcesso` e está correto.

---

## Correção

**Arquivo:** `supabase/functions/notificar-cliente/index.ts`

Em todos os mapeamentos que usam `cadastro_aprovado_botao`, o último parâmetro (que vai para o botão URL) precisa ser o `link_token` do contrato do associado, não o `associado.id`.

### Mudanças:

1. **Buscar o `link_token` do contrato ativo** do associado antes de montar os parâmetros:
   ```typescript
   const { data: contratoLink } = await supabase
     .from('contratos')
     .select('link_token')
     .eq('associado_id', associado.id)
     .in('status', ['ativo', 'assinado', 'pendente_assinatura'])
     .order('created_at', { ascending: false })
     .limit(1)
     .maybeSingle();
   
   const linkToken = contratoLink?.link_token || associado.id; // fallback
   ```

2. **Substituir `associado.id` por `linkToken`** em todos os 6 mapeamentos que usam `cadastro_aprovado_botao`:
   - `cadastro_aprovado`
   - `proposta_aprovada_roubo_furto`
   - `proposta_aprovada_cobertura_total`
   - `cobertura_total_ativada`
   - `vistoria_aprovada`
   - `instalacao_concluida`

3. **Redeploy** da Edge Function `notificar-cliente`.

