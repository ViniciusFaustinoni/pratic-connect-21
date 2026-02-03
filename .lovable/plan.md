
# Plano: Usar Sistema do Mapa de Monitoramento para Exibir Localização do Veículo

## Problema Atual

O botão "Abrir no Mapa" mostra erro "Nenhum veículo com rastreador instalado" mesmo quando existe um rastreador ativo. Isso ocorre porque a query atual não está trazendo corretamente os dados do rastreador.

**Causa confirmada**: A view `view_rastreadores_posicao` tem o veículo com posição válida:
- Placa: **LTB4J74**
- Lat/Lng: **-22.79677300** / **-43.29465800**
- Status: **instalado**
- Rastreador ID: **3f41f3c1-cbe5-47fc-b305-d1291abc407d**

---

## Solução

1. Trocar a lógica para usar a mesma **view** do mapa de monitoramento (`view_rastreadores_posicao`)
2. Mostrar uma **lista de seleção** quando houver mais de um veículo com rastreador
3. Usar o componente `MapaRastreador` (o mesmo usado no Monitoramento) para exibir a posição em tempo real

---

## Arquitetura

| Componente | Descrição |
|------------|-----------|
| `useVeiculosComRastreador` | Novo hook que busca veículos com rastreador via `view_rastreadores_posicao` |
| `MapaRastreador` | Componente existente que exibe mapa com posição em tempo real |
| Modal de Seleção | Exibido quando há múltiplos veículos com rastreador |

---

## Alterações por Arquivo

### 1. Novo Hook: `src/hooks/useVeiculosComRastreador.ts`

Criar hook para buscar veículos com rastreador de um associado específico usando a view existente:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface VeiculoComRastreador {
  rastreador_id: string;
  placa: string;
  marca: string;
  modelo: string;
  latitude: number | null;
  longitude: number | null;
  ignicao: boolean | null;
  velocidade: number | null;
  ultima_comunicacao: string | null;
  status_comunicacao: string;
  horas_sem_comunicacao: number;
}

export function useVeiculosComRastreador(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['veiculos-com-rastreador', associadoId],
    queryFn: async () => {
      if (!associadoId) return [];
      
      const { data, error } = await supabase
        .from('view_rastreadores_posicao')
        .select('*')
        .eq('associado_id', associadoId);
      
      if (error) throw error;
      return (data || []) as VeiculoComRastreador[];
    },
    enabled: !!associadoId,
  });
}
```

### 2. Modificar: `src/pages/cadastro/AssociadoDetalhe.tsx`

**Alterações principais:**

1. **Importar** o novo hook e o componente `MapaRastreador`
2. **Substituir** o modal atual pelo fluxo:
   - 1 veículo: Abre direto o `MapaRastreador`
   - 0 veículos: Mostra toast de erro
   - N veículos: Mostra dialog de seleção primeiro

**Estado adicional:**
```typescript
const [veiculoSelecionadoId, setVeiculoSelecionadoId] = useState<string | null>(null);
const [selecionarVeiculoOpen, setSelecionarVeiculoOpen] = useState(false);
```

**Nova lógica do handleAbrirMapa:**
```typescript
const { data: veiculosComRastreador } = useVeiculosComRastreador(id);

const handleAbrirMapa = () => {
  if (!veiculosComRastreador || veiculosComRastreador.length === 0) {
    toast.error('Nenhum veículo com rastreador instalado');
    return;
  }
  
  if (veiculosComRastreador.length === 1) {
    // Único veículo - abre direto
    setVeiculoSelecionadoId(veiculosComRastreador[0].rastreador_id);
    setMapaModalOpen(true);
  } else {
    // Múltiplos veículos - mostra seleção
    setSelecionarVeiculoOpen(true);
  }
};
```

**Novo Dialog de Seleção:**
```tsx
<Dialog open={selecionarVeiculoOpen} onOpenChange={setSelecionarVeiculoOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Selecionar Veículo</DialogTitle>
    </DialogHeader>
    <div className="space-y-2">
      {veiculosComRastreador?.map((v) => (
        <div
          key={v.rastreador_id}
          className="p-3 border rounded-lg cursor-pointer hover:bg-muted"
          onClick={() => {
            setVeiculoSelecionadoId(v.rastreador_id);
            setSelecionarVeiculoOpen(false);
            setMapaModalOpen(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold">{v.placa}</span>
              <p className="text-sm text-muted-foreground">{v.marca} {v.modelo}</p>
            </div>
            <Badge className={getStatusBadgeClass(v.status_comunicacao)}>
              {v.status_comunicacao}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  </DialogContent>
</Dialog>
```

**Modal do Mapa (usando MapaRastreador):**
```tsx
<Dialog open={mapaModalOpen} onOpenChange={setMapaModalOpen}>
  <DialogContent className="max-w-4xl max-h-[90vh]">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Localização do Veículo
      </DialogTitle>
    </DialogHeader>
    {veiculoSelecionadoId && (
      <MapaRastreador
        rastreadorId={veiculoSelecionadoId}
        altura="450px"
        mostrarControles={true}
      />
    )}
  </DialogContent>
</Dialog>
```

---

## Fluxo do Usuário

```text
1. Usuário clica em "Abrir no Mapa"
2. Sistema busca veículos via view_rastreadores_posicao
   ├─ 0 veículos: Toast "Nenhum veículo com rastreador instalado"
   ├─ 1 veículo: Abre modal com MapaRastreador
   └─ N veículos: Mostra dialog para selecionar
3. Usuário seleciona veículo (se necessário)
4. Modal exibe MapaRastreador com:
   - Mapa satélite
   - Posição em tempo real
   - Velocidade, ignição, direção
   - Botão "Atualizar" para buscar posição atual
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Erro "rastreador não encontrado" | Usa mesma view do Monitoramento |
| Mapa simples | Componente completo `MapaRastreador` |
| Sem opção de atualizar | Botão de atualização manual |
| Escolha automática | Usuário seleciona o veículo |
| Dados locais podem estar desatualizados | Busca posição via Edge Function |

---

## Arquivos a Modificar

| Arquivo | Ação | Linhas |
|---------|------|--------|
| `src/hooks/useVeiculosComRastreador.ts` | **CRIAR** | ~30 linhas |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | **MODIFICAR** | Imports, estados, handlers, modals |
