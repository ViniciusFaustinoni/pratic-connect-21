
# Plano: Corrigir Endpoint de Posição para Rede Veículos

## Problema Identificado

As Edge Functions `rastreador-posicao` e `sync-rastreadores` usam o endpoint incorreto para buscar a última posição dos rastreadores Rede Veículos:

**Atual (incorreto):**
```
GET /veiculos/{codigo}/posicao
```

**Correto (conforme documentação):**
```
POST /obterUltimaPosicaoValida/
Content-Type: application/x-www-form-urlencoded
Body: json={"chassi":"","placa":"","imei":"","cpfCnpjCliente":""}
```

---

## Dados Necessários

Para usar o endpoint correto, precisamos:
- **imei** do rastreador (disponível na tabela `rastreadores`)
- **placa** do veículo (disponível via join com `veiculos`)
- **cpfCnpjCliente** do associado (disponível via join com `associados`)

---

## Arquivos a Modificar

### 1. `supabase/functions/rastreador-posicao/index.ts`

Alterar a função `getPosicaoRedeVeiculos` para:

```typescript
async function getPosicaoRedeVeiculos(
  token: string,
  imei: string,
  placa: string,
  cpfCnpj: string,
  baseUrl: string
): Promise<PosicaoResponse> {
  console.log(`[Rede Veículos] Buscando posição: imei=${imei}, placa=${placa}`);
  
  const url = `${baseUrl}/obterUltimaPosicaoValida/`;
  
  const payload = JSON.stringify({
    chassi: "",
    placa: placa || "",
    imei: imei || "",
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

  const data = await response.json();
  
  // Mapear campos da resposta documentada
  return {
    latitude: parseFloat(data.latitude),
    longitude: parseFloat(data.longitude),
    velocidade: parseInt(data.velocidade || 0),
    direcao: data.direcao,
    ignicao: data.ignicaoLigada === 'S',
    data_posicao: data.dataGPRS || data.dataGPS || new Date().toISOString(),
    endereco: data.endereco,
    dados_extras: {
      voltagemBateria: data.voltagemBateria,
      movimento: data.movimento,
      bloqueado: data.bloqueado,
      statusGPRS: data.statusGPRS,
      statusGPS: data.statusGPS,
    }
  };
}
```

Também ajustar o select do rastreador para incluir dados do veículo e associado:

```typescript
// Buscar rastreador com veículo e associado
const { data: rastreador } = await supabase
  .from('rastreadores')
  .select(`
    *,
    plataforma:rastreadores_config_plataformas(*),
    veiculo:veiculos(
      id, placa, modelo, marca, chassi,
      associado:associados(cpf, cnpj)
    )
  `)
  .eq('id', rastreador_id)
  .single();
```

### 2. `supabase/functions/sync-rastreadores/index.ts`

Alterar a função `syncRedeVeiculos` de forma similar:
- Mudar de GET para POST
- Usar o endpoint `/obterUltimaPosicaoValida/`
- Enviar body com formato urlencoded
- Mapear a resposta corretamente

---

## Mapeamento de Resposta

| Campo API Rede Veículos | Campo Sistema |
|------------------------|---------------|
| `latitude` | `latitude` |
| `longitude` | `longitude` |
| `velocidade` | `velocidade` |
| `ignicaoLigada` ("S"/"N") | `ignicao` (boolean) |
| `dataGPRS` | `data_posicao` |
| `movimento` | `dados_extras.movimento` |
| `bloqueado` | `dados_extras.bloqueado` |
| `statusGPRS` | `dados_extras.statusGPRS` |
| `voltagemBateria` | `dados_extras.voltagemBateria` |

---

## Resultado Esperado

1. Rastreadores Rede Veículos terão sua posição atualizada corretamente
2. O botão de "Atualizar" no mapa funcionará para veículos desta plataforma
3. A sincronização automática (cron) também funcionará corretamente
