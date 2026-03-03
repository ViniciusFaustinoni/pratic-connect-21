

# Plano de Implementacao: Simplificacao do Despacho de Reboque

## Resumo
Substituir o fluxo atual (link publico com timer de 10min) por um fluxo conversacional via WhatsApp onde a IA Maya interage diretamente com os prestadores.

## O que ja existe e sera reutilizado
- Tabelas `despacho_reboque`, `despacho_reboque_convites`, `despacho_reboque_status_log`, `despacho_reboque_tracking` -- schema OK
- `prestadores_assistencia_valores` com `valor_saida` e `valor_km` -- OK
- Edge function `despacho-reboque-disparar` -- sera modificada
- Edge function `despacho-reboque-responder` -- sera modificada
- Componente `CardDespachoReboque.tsx` -- sera modificado

## Fase 1: Modificar `despacho-reboque-disparar`
Alterar a mensagem WhatsApp enviada aos prestadores. Em vez de enviar um link, enviar mensagem informativa direta:

```text
🚨 *NOVO CHAMADO - Reboque Leve*

Veiculo: Toyota Corolla 2013
Rodas travadas
Origem: Rua A, N B
Destino: Rua C, N D

Responda *SIM* se voce esta disponivel para este servico.
```

Remover a geracao de link/token publico. Manter o registro de convites para controle interno.

## Fase 2: Modificar `whatsapp-meta-webhook`
Adicionar logica para interceptar respostas de prestadores cadastrados:

1. Quando recebe mensagem, verificar se o telefone pertence a um prestador ativo
2. Se sim, verificar se existe despacho aguardando para esse prestador
3. Fluxo conversacional:
   - Prestador responde "SIM" → Maya pede localizacao: "Envie sua localizacao atual (GPS do WhatsApp)"
   - Prestador envia localizacao (lat/lng) → Maya calcula distancia via Haversine, busca `valor_saida + valor_km * distancia`, responde: "O valor sugerido para este servico e de R$ XXX,XX. Voce aceita? Responda SIM ou NAO"
   - Prestador aceita → Salva no `despacho_reboque_convites` com status `aceito`, distancia e valor
   - Prestador recusa → Atualiza status para `recusado`

## Fase 3: Modificar `CardDespachoReboque.tsx`
Substituir o botao "Encerrar e atribuir agora" (automatico) por selecao manual do analista:
- Mostrar os 3 prestadores que aceitaram, ordenados por proximidade + menor valor
- Analista clica em "Atribuir" no prestador escolhido
- Remover timer de 10 minutos (nao tem mais bidding automatico)

## Fase 4: Ajustar `despacho-reboque-responder`
Simplificar ou remover -- a logica de aceite agora acontece via webhook do WhatsApp, nao mais via link publico.

## Arquivos afetados

| Acao | Arquivo |
|------|---------|
| Editar | `supabase/functions/despacho-reboque-disparar/index.ts` (mensagem direta, sem link) |
| Editar | `supabase/functions/whatsapp-meta-webhook/index.ts` (interceptar respostas de prestadores) |
| Editar | `src/components/assistencia/CardDespachoReboque.tsx` (selecao manual dos 3 melhores) |
| Manter | `supabase/functions/despacho-reboque-responder/index.ts` (pode manter como fallback) |

## Ordem de execucao
1. Editar `despacho-reboque-disparar` (mensagem sem link)
2. Editar `whatsapp-meta-webhook` (logica conversacional)
3. Editar `CardDespachoReboque` (UI de selecao manual)

