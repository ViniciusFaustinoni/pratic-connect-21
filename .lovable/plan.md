

# Fix: Mensagem WhatsApp não enviada na aprovação de roubo/furto

## Causa raiz

Na edge function `ativar-associado` (linhas 103-126), quando o associado **já possui `user_id`** (já foi ativado anteriormente), a função retorna imediatamente após enviar apenas um email de "rastreador ativado" — **sem enviar o WhatsApp com o template `cadastro_aprovado_botao`**.

Isso acontece porque:
1. O analista aprova a cobertura roubo/furto
2. `useAprovarProposta` chama `ativar-associado`
3. Se o associado já tem conta (ex: reaprovação, segundo veículo, etc.), o early return na linha 104 pula todo o bloco de WhatsApp (linhas 226-349)

## Correção

### Arquivo: `supabase/functions/ativar-associado/index.ts`

No bloco de early return (linhas 104-126), adicionar o envio do template WhatsApp `cadastro_aprovado_botao` **antes** de retornar. O fluxo será:

1. Manter a verificação `if (associado.user_id)` 
2. Dentro desse bloco, buscar dados do veículo (placa, marca/modelo), plano, e link_token do contrato
3. Enviar o template `cadastro_aprovado_botao` via `whatsapp-send-text` com os mesmos parâmetros usados no fluxo normal
4. Manter o email existente
5. Retornar com a resposta de sucesso

Essencialmente, duplicar a lógica de envio WhatsApp (linhas 226-349) para dentro do bloco de "já possui acesso", ou extrair essa lógica para uma função reutilizável chamada nos dois caminhos.

### Abordagem técnica

Extrair uma função `enviarWhatsAppBoasVindas(supabaseAdmin, associado, body)` que encapsula:
- Verificação da Meta config
- Busca de placa/marca/modelo
- Busca de cobertura/plano
- Geração de token e link_token
- Montagem e envio do template

Chamar essa função tanto no bloco de early return (user_id existe) quanto no fluxo normal (após criação do usuário).

Deploy da edge function após a alteração.

