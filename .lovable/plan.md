
# Completar fluxo do webhook Autentique para Ordens de Servico

## Problema
Quando o associado assina o Termo de Saida, o webhook do Autentique recebe o evento e atualiza apenas `termo_saida_assinado = true`. Porem, ele **nao executa** as acoes que deveriam ocorrer automaticamente:

1. Nao muda o status da OS para `finalizado`
2. Nao encerra o sinistro vinculado
3. Nao registra o custo (`valor_indenizacao`)
4. Nao envia WhatsApp confirmando a liberacao

O polling na pagina funciona (a cada 10s), mas como o status nunca muda de `pendente_assinatura`, a pagina parece "travada".

## Solucao

### Arquivo: `supabase/functions/autentique-webhook/index.ts` (bloco OS, linhas ~498-557)

Apos `termo_saida_assinado = true`, adicionar:

1. **Atualizar status da OS para `finalizado`**:
```
status: 'finalizado'
```

2. **Encerrar sinistro vinculado** (se houver `sinistro_id`):
   - Atualizar `sinistros.status = 'encerrado'` e `sinistros.valor_indenizacao = os.valor_orcamento`
   - Inserir registro em `sinistros_historico`

3. **Registrar historico da OS** com status `finalizado` (atualmente registra com o status antigo)

4. **Enviar WhatsApp ao associado** confirmando que o veiculo foi liberado, usando `whatsapp-send-text`

### Mudancas tecnicas no webhook (pseudocodigo)

```text
// Apos "signature.accepted" para OS:

1. UPDATE ordens_servico SET
     termo_saida_assinado = true,
     termo_saida_assinado_em = now(),
     status = 'finalizado',          // <-- NOVO
     updated_at = now()
   WHERE id = osDoc.id

2. IF osDoc.sinistro_id THEN
     UPDATE sinistros SET
       status = 'encerrado',
       valor_indenizacao = osDoc.valor_orcamento,
       updated_at = now()
     WHERE id = osDoc.sinistro_id

     INSERT sinistros_historico (
       sinistro_id, status_novo, observacao
     )

3. INSERT ordens_servico_historico (
     status_novo = 'finalizado',     // <-- CORRIGIDO (era osDoc.status antigo)
     observacao = 'Veiculo liberado automaticamente...'
   )

4. WhatsApp: invocar whatsapp-send-text com mensagem de liberacao
```

### Resultado esperado

Quando o associado assinar o Termo de Saida:

```text
Webhook Autentique dispara
  |
  +-> OS status = finalizado
  +-> OS termo_saida_assinado = true
  +-> Sinistro status = encerrado
  +-> Sinistro valor_indenizacao = valor OS
  +-> Historico registrado
  +-> WhatsApp enviado ao associado
  +-> Polling na pagina detecta mudanca em 10s
  +-> Pagina atualiza automaticamente (badge verde "Finalizado")
```

### Arquivos alterados
- `supabase/functions/autentique-webhook/index.ts` - expandir bloco de OS assinada
