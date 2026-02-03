
# Plano: Adicionar Botão de Localização nos Detalhes de Evento de Roubo/Furto

## Objetivo
Quando um evento de **roubo** ou **furto** for gerado, exibir um botão "Abrir Localização" nos detalhes do evento. Este botão abrirá o mesmo modal de mapa que é usado na página de detalhes do associado (`Cadastro > Associados > Detalhes`).

---

## Componentes Envolvidos

| Componente | Arquivo | Função |
|------------|---------|--------|
| Página de Detalhe | `src/pages/eventos/SinistroDetalhe.tsx` | Exibir botão e modal |
| Modal de Mapa | Reutilizar `Dialog` com `MapaRastreador` | Exibir localização em tempo real |
| Componente de Mapa | `src/components/rastreadores/MapaRastreador.tsx` | Mapa com telemetria |
| Hook de Posição | `useRastreadorTempoReal` | Buscar posição via edge function |

---

## Alterações no Arquivo `SinistroDetalhe.tsx`

### 1. Novos Imports

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapaRastreador } from '@/components/rastreadores/MapaRastreador';
```

### 2. Novo Estado para o Modal

```typescript
const [mapaLocalizacaoOpen, setMapaLocalizacaoOpen] = useState(false);
```

### 3. Query para Buscar Rastreador do Veículo

Adicionar query para buscar o rastreador instalado no veículo do sinistro:

```typescript
const { data: rastreadorVeiculo } = useQuery({
  queryKey: ['sinistro-rastreador-veiculo', sinistro?.veiculo_id],
  queryFn: async () => {
    if (!sinistro?.veiculo_id) return null;
    
    const { data, error } = await supabase
      .from('rastreadores')
      .select('id, codigo, status, ultima_posicao_lat, ultima_posicao_lng')
      .eq('veiculo_id', sinistro.veiculo_id)
      .eq('status', 'instalado')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  enabled: !!sinistro?.veiculo_id && ['roubo', 'furto'].includes(sinistro?.tipo || ''),
});
```

### 4. Botão na Seção de Roubo/Furto

Adicionar botão logo após o `CardAcionamentoRoubo`, visível apenas quando:
- O sinistro é do tipo `roubo` ou `furto`
- Existe um rastreador instalado no veículo

```tsx
{/* Botão Abrir Localização - para roubo/furto com rastreador */}
{['roubo', 'furto'].includes(sinistro.tipo) && rastreadorVeiculo && (
  <Card>
    <CardContent className="pt-6">
      <Button 
        onClick={() => setMapaLocalizacaoOpen(true)}
        className="w-full gap-2"
        variant="outline"
      >
        <MapPin className="h-4 w-4" />
        Abrir Localização do Veículo
      </Button>
    </CardContent>
  </Card>
)}
```

### 5. Modal de Mapa no Final do Componente

Adicionar o modal junto com os outros modais existentes:

```tsx
{/* Modal Localização do Veículo (Roubo/Furto) */}
<Dialog open={mapaLocalizacaoOpen} onOpenChange={setMapaLocalizacaoOpen}>
  <DialogContent className="max-w-4xl max-h-[90vh]">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Localização do Veículo - {sinistro?.veiculo?.placa}
      </DialogTitle>
    </DialogHeader>
    {rastreadorVeiculo && (
      <MapaRastreador
        rastreadorId={rastreadorVeiculo.id}
        altura="450px"
        mostrarControles={true}
      />
    )}
  </DialogContent>
</Dialog>
```

---

## Fluxo Visual

```text
┌───────────────────────────────────────────────────────────────┐
│                    DETALHES DO SINISTRO                       │
│                       (Roubo/Furto)                           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  🚨 Card Acionamento de Recuperação                    │   │
│  │     Status: Confirmado                                 │   │
│  │     Protocolo Central: XXXX                            │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  📍 [Abrir Localização do Veículo]                     │   │  ← NOVO BOTÃO
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  📊 Comparação de Posições GPS                         │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘

                           │
                           ▼ (Clica no botão)

┌───────────────────────────────────────────────────────────────┐
│  📍 Localização do Veículo - LTB4J74                     [X]  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                                                        │   │
│  │                  🗺️ MAPA SATÉLITE                      │   │
│  │              (MapaRastreador component)               │   │
│  │                                                        │   │
│  │            📍 Marcador com posição atual               │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────┬─────────┬─────────┬─────────┐                    │
│  │ 45 km/h │ Ligado  │  180°   │ 2 min   │  ← Telemetria      │
│  └─────────┴─────────┴─────────┴─────────┘                    │
│                                                               │
│  📍 Rua das Flores, 123 - Centro, BH/MG                      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Resumo Técnico

| Item | Descrição |
|------|-----------|
| **Arquivo** | `src/pages/eventos/SinistroDetalhe.tsx` |
| **Imports** | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `MapaRastreador` |
| **Estados** | `mapaLocalizacaoOpen` (boolean) |
| **Query** | Buscar rastreador por `veiculo_id` com status `instalado` |
| **Condição** | Mostrar apenas se `tipo === 'roubo' || tipo === 'furto'` E rastreador existe |
| **Modal** | Reutiliza `MapaRastreador` com `rastreadorId` |

---

## Comportamento Esperado

1. Usuário acessa detalhes de um sinistro de **roubo** ou **furto**
2. Sistema busca se existe rastreador instalado no veículo
3. Se existir, exibe botão "Abrir Localização do Veículo"
4. Ao clicar, abre modal com mapa satélite e posição em tempo real
5. O mapa mostra telemetria: velocidade, ignição, direção, última atualização
6. Botão "Atualizar" permite buscar posição mais recente da plataforma
