
# Plano: Adicionar Botão "Abrir no Mapa" nos Detalhes do Associado

## Objetivo
Adicionar um botão "Abrir no Mapa" na área de ações do cabeçalho dos detalhes do associado. Ao clicar, será exibido um modal com mapa Leaflet mostrando a localização do endereço do associado.

---

## Análise

### Dados Disponíveis
O associado tem os seguintes campos de endereço:
- `logradouro`, `numero`, `bairro`, `cidade`, `uf`, `cep`
- `endereco_latitude`, `endereco_longitude` (podem estar vazios)

### Situação Atual
O associado Marcus Vinicius possui endereço cadastrado (EST CAFUNDA, 725 - TANQUE, RIO DE JANEIRO/RJ), mas `endereco_latitude` e `endereco_longitude` estão nulos.

### Solução
1. Se coordenadas existirem → mostrar mapa diretamente
2. Se coordenadas não existirem → geocodificar via edge function, salvar no banco, e mostrar mapa

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/cadastro/AssociadoDetalhe.tsx` | **MODIFICAR** | Adicionar botão "Abrir no Mapa" e modal com mapa |
| `src/services/geocodingService.ts` | **MODIFICAR** | Adicionar função para atualizar coordenadas de associado |

---

## Implementação Detalhada

### 1. Adicionar Função de Geocodificação para Associados

No arquivo `geocodingService.ts`, adicionar:

```typescript
export async function atualizarCoordenadasAssociado(
  associadoId: string,
  endereco: EnderecoParaGeocodificar
): Promise<{ latitude: number | null; longitude: number | null; success: boolean }> {
  const coords = await geocodificarEndereco(endereco);
  
  if (!coords.success) {
    return { latitude: null, longitude: null, success: false };
  }

  const { error } = await supabase
    .from("associados")
    .update({
      endereco_latitude: coords.latitude,
      endereco_longitude: coords.longitude,
    })
    .eq("id", associadoId);

  if (error) {
    console.error("[Geocode] Erro ao atualizar associado:", error);
    return { latitude: null, longitude: null, success: false };
  }

  return { 
    latitude: coords.latitude, 
    longitude: coords.longitude, 
    success: true 
  };
}
```

### 2. Adicionar Botão e Modal no AssociadoDetalhe

**Novos imports:**
```typescript
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { atualizarCoordenadasAssociado } from '@/services/geocodingService';
```

**Novo estado:**
```typescript
const [mapaModalOpen, setMapaModalOpen] = useState(false);
const [coordenadas, setCoordenadas] = useState<{lat: number | null; lng: number | null}>({ 
  lat: associado.endereco_latitude, 
  lng: associado.endereco_longitude 
});
const [geocodificando, setGeocodificando] = useState(false);
```

**Função para abrir mapa:**
```typescript
const handleAbrirMapa = async () => {
  // Se já tem coordenadas, abrir diretamente
  if (coordenadas.lat && coordenadas.lng) {
    setMapaModalOpen(true);
    return;
  }

  // Se não tem, geocodificar primeiro
  setGeocodificando(true);
  const result = await atualizarCoordenadasAssociado(id!, {
    logradouro: associado.logradouro,
    numero: associado.numero,
    bairro: associado.bairro,
    cidade: associado.cidade,
    uf: associado.uf,
    cep: associado.cep,
  });
  setGeocodificando(false);

  if (result.success && result.latitude && result.longitude) {
    setCoordenadas({ lat: result.latitude, lng: result.longitude });
    setMapaModalOpen(true);
    refetch(); // Atualizar dados do associado
  } else {
    toast.error('Não foi possível localizar o endereço no mapa');
  }
};
```

**Botão na área de ações (linha ~485):**
```tsx
<Button 
  variant="outline" 
  onClick={handleAbrirMapa}
  disabled={geocodificando || !associado.logradouro}
>
  {geocodificando ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <MapPin className="mr-2 h-4 w-4" />
  )}
  Abrir no Mapa
</Button>
```

**Modal com mapa:**
```tsx
<Dialog open={mapaModalOpen} onOpenChange={setMapaModalOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Localização - {associado.nome}
      </DialogTitle>
    </DialogHeader>
    
    {coordenadas.lat && coordenadas.lng && (
      <div className="h-[400px] rounded-lg overflow-hidden">
        <MapContainer
          center={[coordenadas.lat, coordenadas.lng]}
          zoom={16}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          <Marker position={[coordenadas.lat, coordenadas.lng]}>
            <Popup>
              <div className="text-center">
                <strong>{associado.nome}</strong>
                <p className="text-xs mt-1">
                  {associado.logradouro}, {associado.numero}<br/>
                  {associado.bairro} - {associado.cidade}/{associado.uf}
                </p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    )}
    
    <p className="text-sm text-muted-foreground text-center">
      📍 {associado.logradouro}, {associado.numero} - {associado.bairro}, {associado.cidade}/{associado.uf}
    </p>
  </DialogContent>
</Dialog>
```

---

## Layout do Botão

O botão será posicionado após o botão "Financeiro":

```
[Editar] [Documentos] [Financeiro] [Abrir no Mapa] [Suspender] [...]
```

---

## Fluxo do Usuário

```text
1. Usuário clica em "Abrir no Mapa"
2. Sistema verifica se há coordenadas salvas
   ├─ SIM: Abre modal com mapa
   └─ NÃO: 
      a. Exibe loading no botão
      b. Chama edge function para geocodificar
      c. Salva coordenadas no banco
      d. Abre modal com mapa
3. Modal exibe mapa centralizado no endereço
4. Marcador mostra nome e endereço do associado
```

---

## Tratamento de Erros

- **Endereço sem logradouro**: Botão desabilitado
- **Falha na geocodificação**: Toast de erro "Não foi possível localizar o endereço"
- **Coordenadas inválidas**: Modal não abre, erro exibido

---

## Resultado Esperado

1. Novo botão "Abrir no Mapa" visível na barra de ações
2. Modal com mapa Leaflet mostrando localização exata
3. Coordenadas salvas no banco para acesso futuro instantâneo
4. Marcador clicável com popup contendo dados do associado
