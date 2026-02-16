

# Capturar Posicao do Rastreador no Momento do Registro (WhatsApp) + Corrigir Exibicao

## Problema

1. **WhatsApp webhook**: Quando o associado registra um sinistro via WhatsApp, o sistema NAO captura a posicao do rastreador naquele momento. Os campos `rastreador_lat_momento`, `rastreador_lng_momento` e `rastreador_posicao_capturada_em` ficam nulos.
2. **Tela de Analise** (`SinistroAnalise.tsx`): Usa a posicao ATUAL do rastreador (`rastreador?.ultima_posicao_lat`) em vez da posicao salva no momento do registro (`sinistro.rastreador_lat_momento`).

O `SinistroDetalhe.tsx` ja usa os campos corretos. O `criar-sinistro` (usado pelo App) ja captura corretamente.

## Solucao

### 1. WhatsApp webhook: Capturar posicao do rastreador ao criar sinistro

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

Antes do INSERT do sinistro (linha ~900), buscar a posicao atual do rastreador do veiculo e incluir no INSERT:

```text
// Buscar posicao do rastreador do veiculo
const { data: rastreadorSin } = await supabase
  .from("rastreadores")
  .select("ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao")
  .eq("veiculo_id", veiculoSin.id)
  .eq("status", "instalado")
  .maybeSingle();

// No INSERT, adicionar:
rastreador_lat_momento: rastreadorSin?.ultima_posicao_lat || null,
rastreador_lng_momento: rastreadorSin?.ultima_posicao_lng || null,
rastreador_posicao_capturada_em: rastreadorSin?.ultima_comunicacao || null,
```

### 2. Tela de Analise: Usar posicao do momento do registro

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx` (linhas 680-687)

Trocar de:

```text
rastreadorLat={rastreador?.ultima_posicao_lat}
rastreadorLng={rastreador?.ultima_posicao_lng}
rastreadorCapturadoEm={rastreador?.ultima_comunicacao}
```

Para:

```text
rastreadorLat={sinistro.rastreador_lat_momento}
rastreadorLng={sinistro.rastreador_lng_momento}
rastreadorCapturadoEm={sinistro.rastreador_posicao_capturada_em}
```

### 3. Corrigir sinistro existente (d710629f)

Executar edge function temporaria para buscar a posicao do rastreador mais proxima da data de criacao do sinistro na tabela `rastreador_posicoes` e atualizar os campos `rastreador_lat_momento` e `rastreador_lng_momento`.

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Buscar e salvar posicao do rastreador ao criar sinistro |
| `src/pages/eventos/SinistroAnalise.tsx` | Usar `sinistro.rastreador_lat_momento` em vez de `rastreador?.ultima_posicao_lat` |
| `supabase/functions/fix-rastreador-momento/index.ts` | Edge function temporaria para corrigir sinistro existente |

Nenhuma migration necessaria.
