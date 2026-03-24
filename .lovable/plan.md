

# Causa Raiz: Keyword "riva" classifica MERIVA como moto

## O problema

Na lista `MOTO_KEYWORDS` em `src/data/vistoriaConfigCompleta.ts` (linha 166), existe a keyword `'riva'` (modelo de scooter). O modelo **"MERIVA MAXX"** contém a substring **"riva"** dentro de "Me**riva**", fazendo o sistema classificar o veículo como **moto**.

Fluxo detalhado:
1. Placa buscada → veículo retorna marca "Chevrolet", modelo "Meriva Maxx"
2. `useDetectarTipoVeiculo` consulta `plano_elegibilidade_modelos` com `ILIKE '%MERIVA MAXX%'`
3. No banco, o modelo é cadastrado apenas como "MERIVA" (sem "MAXX") → **nenhum match** na query
4. Hook retorna `null` → fallback síncrono por keywords
5. `detectarTipoVeiculo(undefined, "Meriva Maxx", "Chevrolet")` → verifica MOTO_KEYWORDS → **"riva"** faz match em "me**riva**" → retorna **'moto'**
6. `tipoVeiculoDetectado = 'moto'` → todos os planos de carro são filtrados → **nenhum plano aparece**

O fix anterior (priorizar `veiculoEncontrado`) não resolve porque `tipoFromHook` já vem errado — o hook em si retorna 'moto'.

## Solução (duas camadas)

### 1. Corrigir keyword "riva" — `src/data/vistoriaConfigCompleta.ts`

Trocar `'riva'` por `' riva'` (com espaço antes) para exigir que "riva" seja início de palavra, não substring de "meriva".

### 2. Usar `tipo_de_veiculo` da API de placa — `src/hooks/useDetectarTipoVeiculo.ts`

Aceitar um parâmetro opcional `tipoVeiculoApi` (campo `tipo_de_veiculo` retornado pela API: "Automovel", "Motocicleta" etc.). Quando disponível, usar como fonte primária antes de qualquer fallback por keyword.

### 3. Passar o campo no CotacaoFormDialog — `src/components/cotacoes/CotacaoFormDialog.tsx`

Passar `veiculoEncontrado?.vehicleData?.tipo_de_veiculo` para o hook de detecção.

## Impacto

Apenas corrige a classificação de tipo. Nenhuma alteração em preços, elegibilidade ou regras de negócio.

| Arquivo | Alteração |
|---------|-----------|
| `src/data/vistoriaConfigCompleta.ts` | Trocar `'riva'` por `' riva'` em MOTO_KEYWORDS |
| `src/hooks/useDetectarTipoVeiculo.ts` | Adicionar parâmetro `tipoVeiculoApi` e usar como prioridade no fallback |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Passar `tipo_de_veiculo` ao hook |

