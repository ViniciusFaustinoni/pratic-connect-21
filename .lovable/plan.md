

# Corrigir endpoint Rede Veículos na Edge Function `posicao-veiculo`

## Problema
A edge function `posicao-veiculo` usa um endpoint genérico inexistente (`GET /veiculos/{codigo}/posicao`) para Rede Veículos. O endpoint correto, já implementado em `rastreador-posicao`, é `POST /obterUltimaPosicaoValida/` com body codificado como `json=` URL-encoded.

Além disso, o mapeamento de campos da resposta está errado em `posicao-veiculo` (espera `data_hora`, `ignition`, `speed` em vez dos campos reais `dataGPRS`, `ignicaoLigada`, `velocidade`).

## Solução

### `supabase/functions/posicao-veiculo/index.ts`

**1. Reescrever `getPosicaoRedeVeiculos` (linhas 195-233)**

Substituir o endpoint GET genérico pela chamada correta:

```typescript
async function getPosicaoRedeVeiculos(
  token: string,
  codigoRastreador: string,
  baseUrl: string,
  placa?: string,
  cpfCnpj?: string
): Promise<PosicaoPadrao> {
  const url = `${baseUrl}/obterUltimaPosicaoValida/`;
  
  const payload = JSON.stringify({
    chassi: "",
    placa: placa || "",
    imei: codigoRastreador || "",
    cpfCnpjCliente: cpfCnpj || ""
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `json=${encodeURIComponent(payload)}`
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro Rede Veículos ${response.status}: ${error}`);
  }

  const rawData = await response.json();
  // A resposta pode vir como array [{error, message}]
  const data = Array.isArray(rawData) ? rawData[0]?.message || rawData[0] : rawData;

  if (!data?.latitude || !data?.longitude) {
    throw new Error('Coordenadas ausentes na resposta Rede Veículos');
  }

  return {
    latitude: parseFloat(data.latitude),
    longitude: parseFloat(data.longitude),
    velocidade: parseInt(data.velocidade || '0', 10),
    direcao: undefined,
    ignicao: data.ignicaoLigada === 'S',
    data_posicao: data.dataGPRS || data.dataGPS || new Date().toISOString(),
    dados_extras: {
      endereco: data.endereco,
      voltagemBateria: data.voltagemBateria,
      movimento: data.movimento,
      bloqueado: data.bloqueado,
      statusGPRS: data.statusGPRS,
      statusGPS: data.statusGPS,
      imei: data.imei,
      placa: data.placa,
      chassi: data.chassi,
    }
  };
}
```

**2. Atualizar a chamada à função (onde `getPosicaoRedeVeiculos` é invocada)**

Passar `placa` e `cpfCnpj` do associado como parâmetros adicionais, buscando-os do veículo/associado que já estão disponíveis no contexto.

**3. Converter formato de data**

A resposta retorna datas em `dd/MM/yyyy HH:mm:ss`. Converter para ISO antes de salvar.

## Deploy
Redeployar a edge function `posicao-veiculo` após a correção.

## Arquivos
| Arquivo | Ação |
|---------|------|
| `supabase/functions/posicao-veiculo/index.ts` | Corrigir endpoint e mapeamento de campos |

