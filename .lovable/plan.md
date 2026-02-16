
# Geocodificar Endereco do Evento e Mostrar Pino no Mapa

## Problema Atual

Quando o associado preenche "Rua" e "Numero" na Etapa 3 do link do evento, esses dados sao salvos apenas como texto (`local_rua`, `local_numero`) no campo `dados_etapa3` da tabela `sinistro_evento_links`. Nenhuma geocodificacao acontece, entao `sinistros.latitude_informada` e `sinistros.longitude_informada` ficam nulos.

O componente `ComparacaoPosicoes` (mapa de evidencia) ja suporta mostrar dois pinos (rastreador em verde, informada em azul) -- mas como as coordenadas informadas estao nulas, so aparece o pino do rastreador.

## Solucao

### 1. Geocodificar o endereco na edge function `salvar-etapa-evento`

Quando a etapa 3 for salva e conter `local_rua` (e opcionalmente `local_numero`), a edge function fara uma chamada a API gratuita do Nominatim (OpenStreetMap) para converter o endereco em coordenadas.

As coordenadas resultantes serao salvas em `sinistros.latitude_informada` e `sinistros.longitude_informada`, alem de atualizar `sinistros.local_ocorrencia` com o endereco formatado.

**Arquivo:** `supabase/functions/salvar-etapa-evento/index.ts`

Apos a linha que atualiza o status do sinistro para `documentacao_enviada` (etapa 3, linha ~149), adicionar:

```typescript
// Geocodificar endereco informado
if (dados.local_rua) {
  const enderecoCompleto = dados.local_numero 
    ? `${dados.local_rua}, ${dados.local_numero}` 
    : dados.local_rua;
  
  try {
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoCompleto + ', Brasil')}&limit=1`;
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'PraticConnect/1.0' }
    });
    const geoData = await geoRes.json();
    
    if (geoData.length > 0) {
      await supabase
        .from('sinistros')
        .update({
          latitude_informada: parseFloat(geoData[0].lat),
          longitude_informada: parseFloat(geoData[0].lon),
          local_ocorrencia: enderecoCompleto,
        })
        .eq('id', link.sinistro_id);
    }
  } catch (geoError) {
    console.error('Erro na geocodificacao:', geoError);
    // Nao bloqueia o fluxo se geocodificacao falhar
  }
}
```

### 2. Nenhuma alteracao necessaria no frontend

O componente `ComparacaoPosicoes` ja:
- Aceita `latitudeInformada` e `longitudeInformada` como props
- Mostra marcador azul para posicao informada quando as coordenadas existem
- Mostra linha tracejada entre os dois pontos
- Calcula e exibe a distancia entre posicoes
- Mostra legenda "Rastreador" (verde) e "Informada" (azul)

As paginas `EventoAnaliseDetalhe.tsx` e `SinistroAnalise.tsx` ja passam `sinistro.latitude_informada` e `sinistro.longitude_informada` para o componente.

## Detalhes Tecnicos

### API Nominatim (OpenStreetMap)
- Gratuita, sem necessidade de API key
- Rate limit: 1 req/segundo (suficiente para uso pontual)
- Adicionar `', Brasil'` ao endereco para melhorar precisao
- Header `User-Agent` obrigatorio pela politica de uso

### Fluxo de dados

1. Associado preenche rua + numero na Etapa 3
2. Edge function `salvar-etapa-evento` geocodifica o endereco via Nominatim
3. Coordenadas salvas em `sinistros.latitude_informada` / `longitude_informada`
4. Analista abre o evento e ve o mapa com dois pinos: rastreador (verde) + local informado (azul)

### Tratamento de erros
- Se a geocodificacao falhar (sem resultado ou erro de rede), o fluxo continua normalmente
- O mapa continuara mostrando apenas o pino do rastreador nesse caso

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/salvar-etapa-evento/index.ts` | Adicionar geocodificacao via Nominatim na etapa 3, salvando lat/lng no sinistro |

Nenhuma migration necessaria -- os campos `latitude_informada` e `longitude_informada` ja existem na tabela `sinistros`.
