
# Plano: Simplificação do Despacho de Reboque

## Contexto
Substituir o sistema "Uber do Guincho" (lances com timer de 10min) por um fluxo direto via WhatsApp com cálculo de valor sugerido por prestador.

## Fluxo Novo

```text
Chamado de reboque criado (via WhatsApp ou sistema)
  └── Sistema busca TODOS prestadores ativos tipo "reboque"
        └── Envia WhatsApp para cada um:
              "🚨 Novo Chamado - Reboque Leve
               Veículo: Toyota Corolla 2013
               Rodas travadas
               Origem: Rua A, Nº B
               Destino: Rua C, Nº D
               Responda SIM se disponível"
              
        └── Prestador responde SIM
              └── IA (Maya) pergunta localização atual do prestador
                    └── Prestador envia localização (WhatsApp GPS)
                          └── IA calcula distância prestador → origem
                                └── Valor sugerido = valor_saida + (valor_km × distância)
                                      └── IA informa: "O valor sugerido para este serviço é R$ XXX,XX. Aceita?"
                                            └── Prestador aceita
                                                  └── Sistema registra resposta com valor e distância
                                                  
  └── Após 3+ aceites (ou timeout):
        └── Sistema mostra ao Analista de Eventos os 3 prestadores:
              - Mais próximos
              - Com menor valor
              └── Analista escolhe → prestador atribuído → notificação ao prestador e associado
```

## O que já existe no banco
- `prestadores_assistencia_valores` já tem `valor_saida` e `valor_km` por tipo de serviço/reboque ✅
- `prestadores_assistencia` já tem `whatsapp`, `tipos_servico`, `tipos_reboque`, `disponivel` ✅
- `chamados_assistencia` já tem `origem_endereco`, `destino_endereco`, `tipo_servico` ✅

## Fases de Implementação

### Fase 1: Disparo automático para prestadores (Edge Function)
- **Nova Edge Function `despacho-reboque-disparar`**: 
  - Recebe chamado_id
  - Busca todos prestadores ativos com tipo_servico = 'reboque' e disponivel = true
  - Envia mensagem WhatsApp para cada um com dados do chamado (via Meta API ou Evolution)
  - Registra na tabela `despacho_reboque_respostas` cada envio com status 'enviado'
- **Trigger ou hook**: Ao criar chamado tipo reboque, chama automaticamente essa function

### Fase 2: IA conversa com prestadores que respondem
- **Modificar whatsapp-webhook**: Quando prestador responde "SIM":
  - IA pergunta localização
  - Ao receber localização (lat/lng), calcula distância via Haversine
  - Busca `valor_saida` + `valor_km` do prestador na tabela de valores
  - Calcula: `valor_sugerido = valor_saida + (valor_km × distância_km)`
  - Informa valor e pergunta se aceita
  - Se aceita, salva na tabela de respostas: prestador_id, distancia_km, valor_sugerido, status='aceito'

### Fase 3: Tela do Analista para selecionar prestador
- **Modificar `CardDespachoReboque`**: Mostrar lista de prestadores que aceitaram, ordenados por proximidade e valor
- Analista clica → atribui prestador → notifica prestador e associado

### Fase 4: Migração de dados (schema)
- **Nova tabela `despacho_reboque_respostas`** (ou reutilizar a existente se compatível):
  - chamado_id, prestador_id, status (enviado/interessado/aceito/recusado), 
  - distancia_km, valor_sugerido, localizacao_lat, localizacao_lng, respondido_em

## Arquivos Afetados

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/despacho-reboque-disparar/index.ts` |
| Editar | `supabase/functions/whatsapp-webhook/index.ts` (lógica de resposta do prestador) |
| Editar | `src/components/assistencia/CardDespachoReboque.tsx` (UI de seleção) |
| Migration | Nova tabela ou ajuste em `despacho_reboque_respostas` |
| Editar | `supabase/config.toml` |

## Ordem de execução
1. Fase 4 (schema) → 2. Fase 1 (disparo) → 3. Fase 2 (IA/webhook) → 4. Fase 3 (UI analista)
