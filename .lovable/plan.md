

# Plano: Simplificar despacho de reboque com valor sugerido por prestador

## Resumo

Simplificar o fluxo de 3 etapas (SIM → localização → aceite valor) para **1 etapa** (SIM/NÃO). O valor sugerido é enviado na mensagem inicial, baseado no campo `valor_sugerido` cadastrado em cada prestador. O prestador responde SIM ou NÃO diretamente.

## Mudancas

### 1. Database: Adicionar campo `valor_sugerido` em `prestadores_assistencia_valores`

```sql
ALTER TABLE prestadores_assistencia_valores 
ADD COLUMN valor_sugerido numeric DEFAULT NULL;
```

Campo opcional — se preenchido, é o valor fixo que aparece na mensagem de despacho para aquele prestador/tipo de serviço.

### 2. Frontend: Campo "Valor Sugerido" no cadastro de prestador

**Arquivo:** `src/components/assistencia/NovoPrestadorModal.tsx`

Na seção de valores (cards de serviço com `isKm`), adicionar campo "Valor Sugerido (R$)" no grid. O campo aparece para serviços do tipo reboque. O `saveValores` deve incluir `valor_sugerido` no insert.

### 3. Edge Function `despacho-reboque-disparar`: Incluir valor sugerido na mensagem

**Arquivo:** `supabase/functions/despacho-reboque-disparar/index.ts`

- Buscar `valor_sugerido` da tabela `prestadores_assistencia_valores` junto com `valor_saida` e `valor_km`
- Montar mensagem com valor sugerido e dados do veículo:

```
🚨 *NOVO CHAMADO - Reboque Leve*

🚗 Veículo: Toyota Corolla 2013
📝 Obs: Rodas travadas

📍 Origem: Rua A, número B
📍 Destino: Rua C, número D

💰 *Valor sugerido: R$ 250,00*

Responda *SIM* para aceitar ou *NÃO* para recusar.
```

- Salvar `valor_calculado = valor_sugerido` no convite criado
- Setar `etapa_conversacao = "aguardando_aceite"` (etapa unica)

### 4. Webhook: Simplificar para 1 etapa

**Arquivo:** `supabase/functions/whatsapp-meta-webhook/index.ts`

Remover etapas `aguardando_localizacao` e `aguardando_aceite_valor`. Manter apenas:

- **`aguardando_aceite`**: SIM → aceito, NÃO → recusado
- Remover logica de pedir localização e calcular distância por conversação

### 5. CardDespachoReboque: Ajustar etapa config

**Arquivo:** `src/components/assistencia/CardDespachoReboque.tsx`

Atualizar `etapaConfig` para refletir a nova etapa unica `aguardando_aceite`.

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Adicionar `valor_sugerido` em `prestadores_assistencia_valores` |
| `NovoPrestadorModal.tsx` | Campo "Valor Sugerido" no card de valores de reboque |
| `despacho-reboque-disparar/index.ts` | Mensagem com valor sugerido + tipo reboque + dados veículo |
| `whatsapp-meta-webhook/index.ts` | Simplificar para 1 etapa (SIM/NÃO) |
| `CardDespachoReboque.tsx` | Ajustar etapa config |

## O que NAO muda
- Auto-despacho ao criar chamado (ja implementado)
- Top 3 mais proximos/menor valor para analista (CardDespachoReboque ja faz)
- Fluxo de atribuição pelo analista

