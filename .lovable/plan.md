
# Exibir Localização do Evento (e não do veículo) no Mapa

## Problema

O mapa "Posições GPS - Evidência" na tela de análise do sinistro mostra apenas a posição do rastreador GPS (localização atual do veículo). O local do evento informado pelo associado ("Estrada do pau da fome, 1000") aparece apenas como texto, sem marcador no mapa, porque os campos `latitude_informada` e `longitude_informada` estão vazios (NULL) no banco de dados.

## Causa Raiz

Durante o registro do sinistro (B.O.), o endereço do local da ocorrência é salvo como texto em `local_ocorrencia`, mas as coordenadas (`latitude_informada`, `longitude_informada`) não são preenchidas. O componente `ComparacaoPosicoes` depende dessas coordenadas para plotar o marcador azul "Informada pelo Usuário" no mapa.

## Solução

Quando `latitude_informada`/`longitude_informada` forem nulos e existir `local_ocorrencia` (endereço textual), geocodificar o endereço usando o Nominatim (OpenStreetMap) diretamente no componente para obter as coordenadas e exibir o marcador do **local do evento** no mapa.

## Alterações

### Arquivo: `src/components/sinistros/ComparacaoPosicoes.tsx`

1. Adicionar um `useQuery` que geocodifica `localOcorrencia` via Nominatim quando `latitudeInformada`/`longitudeInformada` são nulos
2. Usar as coordenadas geocodificadas como fallback para `latitudeInformada`/`longitudeInformada` na lógica de análise existente
3. Exibir indicador visual "(geocodificado)" quando as coordenadas vêm do endereço e não de GPS direto

```text
Fluxo:
  latitudeInformada existe?
    SIM -> usar diretamente (comportamento atual)
    NAO -> localOcorrencia existe?
      SIM -> geocodificar via Nominatim -> usar coordenadas resultantes
      NAO -> sem marcador de posição informada
```

A mudança é localizada: apenas o componente `ComparacaoPosicoes` será alterado, sem afetar nenhuma outra tela.
