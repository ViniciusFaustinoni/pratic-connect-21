

# Plano: Fluxo Conversacional de Reboque via WhatsApp

## Resumo

Substituir o fluxo atual (SIM/NAO simples) por um fluxo conversacional em 3 etapas onde a IA coleta localização, calcula valor dinamicamente e pergunta tempo de chegada. O analista vê os Top 3 com valor + distancia + ETA.

## Estado Atual

- **Disparo** (`despacho-reboque-disparar`): Envia mensagem com valor_sugerido fixo. Prestadores respondem SIM/NAO.
- **Webhook** (`whatsapp-meta-webhook`): Processa apenas etapa `aguardando_aceite` (SIM/NAO).
- **DB**: `despacho_reboque_convites` já tem `etapa_conversacao`, `latitude_prestador`, `longitude_prestador`, `distancia_km`, `valor_calculado`, `valor_saida`, `valor_km`.
- **Tabela `prestadores_assistencia_valores`**: Já tem `valor_fixo` e `valor_km`.
- **Falta**: campo `tempo_chegada_minutos` nos convites, e toda a lógica conversacional multi-etapa.

---

## Mudanças

### 1. Migração SQL

Adicionar campo ao `despacho_reboque_convites`:

```sql
ALTER TABLE despacho_reboque_convites 
ADD COLUMN IF NOT EXISTS tempo_chegada_minutos integer;
```

### 2. Edge Function: `despacho-reboque-disparar`

**Mudança na mensagem**: Remover o "Valor sugerido" fixo da mensagem inicial. A mensagem agora apresenta apenas os dados do serviço e pede interesse:

```
🚨 *NOVO CHAMADO - Reboque Leve*

🚗 Veículo: Toyota Corolla 2013
📝 Obs: Rodas travadas

📍 Origem: Rua A, 123
📍 Destino: Rua C, 456

Tem interesse neste serviço? Responda *SIM* ou *NÃO*.
```

Mudar `etapa_conversacao` inicial para `"aguardando_interesse"`.

### 3. Edge Function: `whatsapp-meta-webhook` (processarRespostaPrestador)

Reescrever para suportar 4 etapas de conversação:

| Etapa | Ação do prestador | Resposta da IA |
|-------|-------------------|----------------|
| `aguardando_interesse` | SIM/NAO | Se SIM: "Qual seu endereço atual ou envie sua localização?" → avança para `aguardando_localizacao` |
| `aguardando_localizacao` | Texto ou localização GPS | Geocodifica endereço, calcula distância ate origem, calcula valor (fixo + km*dist), informa: "Valor sugerido: R$ XXX. Aceita? SIM/NAO" → `aguardando_confirmacao_valor` |
| `aguardando_confirmacao_valor` | SIM/NAO | Se SIM: "Em quanto tempo você chega ao local?" → `aguardando_eta` |
| `aguardando_eta` | Texto com minutos | Extrai numero, salva `tempo_chegada_minutos`, marca como `aceito` |

**Logica de calculo**:
- Se mensagem tipo `location`, usar lat/lng diretamente
- Se texto, chamar edge function `geocode-endereco` para obter coordenadas
- Distancia = haversine(prestador, origem_chamado)
- Valor = `valor_fixo + (distancia * valor_km)` (buscar de `prestadores_assistencia_valores`)

**Buscar convites em todas as etapas ativas**:
```typescript
.in("etapa_conversacao", [
  "aguardando_interesse", 
  "aguardando_localizacao", 
  "aguardando_confirmacao_valor", 
  "aguardando_eta"
])
```

### 4. Frontend: `CardDespachoReboque.tsx`

- Adicionar coluna "ETA" na exibicao dos Top 3 aceitos
- Ranking: ordenar por `valor_calculado` ASC, desempate por `distancia_km` ASC
- Exibir `tempo_chegada_minutos` como "~XX min" em cada card

### 5. Atribuicao: `CardDespachoReboque.tsx` (mutation atribuir)

Ao atribuir, disparar 2 mensagens WhatsApp:

**Para o reboquista selecionado** (já existe, manter):
- Dados do associado + localização exata

**Para o associado** (já existe em `despacho-reboque-atribuir`, mas adicionar ETA do prestador):
- Nome do prestador + previsão de chegada

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar `tempo_chegada_minutos` em `despacho_reboque_convites` |
| `supabase/functions/despacho-reboque-disparar/index.ts` | Remover valor da msg, mudar etapa para `aguardando_interesse` |
| `supabase/functions/whatsapp-meta-webhook/index.ts` | Reescrever `processarRespostaPrestador` com 4 etapas conversacionais |
| `src/components/assistencia/CardDespachoReboque.tsx` | Adicionar ETA na exibição, ajustar etapas no config |

