
## Plano: Bloquear Veículos da Blacklist na Cotação

### Problema
Atualmente, veículos que estão na blacklist (reprovados por vistoria ou análise) ainda podem iniciar o processo de cotação. O sistema deve bloquear a cotação logo ao informar a placa, exibindo uma mensagem clara de que o veículo está bloqueado.

### Solução
Integrar a verificação da blacklist no fluxo de busca por placa (`handleBuscarPlaca`), ANTES de consultar a API de veículos. Se o veículo estiver bloqueado, exibir um modal informativo e impedir a continuação do processo.

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/cotacoes/PlacaBlacklistModal.tsx` | **CRIAR** | Modal para exibir quando veículo está na blacklist |
| `src/pages/vendas/Cotador.tsx` | **MODIFICAR** | Adicionar verificação de blacklist antes da busca FIPE |

---

### 1. Criar Modal de Veículo Bloqueado

Novo componente `PlacaBlacklistModal.tsx` similar ao `PlacaDuplicadaModal`:

```typescript
// src/components/cotacoes/PlacaBlacklistModal.tsx
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, Calendar, AlertTriangle, FileText } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

interface BlacklistInfo {
  id: string;
  motivo: string;
  tipo_reprovacao: string;
  created_at: string;
}

interface PlacaBlacklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placa: string;
  info: BlacklistInfo | null;
}

const TIPO_LABELS: Record<string, { label: string; variant: 'destructive' | 'default' }> = {
  vistoria_reprovada: { label: 'Vistoria Reprovada', variant: 'destructive' },
  proposta_reprovada: { label: 'Proposta Reprovada', variant: 'destructive' },
};

export function PlacaBlacklistModal({ open, onOpenChange, placa, info }: Props) {
  // Exibe:
  // - Ícone de bloqueio (Ban)
  // - Título: "Veículo Bloqueado"
  // - Mensagem: "Este veículo está na lista de bloqueio..."
  // - Motivo do bloqueio
  // - Tipo de reprovação (badge)
  // - Data de inclusão na blacklist
  // - Instrução para contatar a diretoria
}
```

### 2. Modificar Cotador.tsx

**Linha ~44-59**: Adicionar imports:
```typescript
import { PlacaBlacklistModal } from '@/components/cotacoes/PlacaBlacklistModal';
```

**Linha ~344**: Adicionar estados para blacklist:
```typescript
// Estado para modal de blacklist
const [blacklistInfo, setBlacklistInfo] = useState<{
  id: string;
  motivo: string;
  tipo_reprovacao: string;
  created_at: string;
} | null>(null);
const [showBlacklistModal, setShowBlacklistModal] = useState(false);
```

**Linha ~495-520**: Modificar `handleBuscarPlaca` para verificar blacklist PRIMEIRO:
```typescript
const handleBuscarPlaca = async () => {
  if (!placaBusca || placaBusca.length < 7) {
    toast.error('Digite uma placa válida');
    return;
  }

  setBuscandoPlaca(true);
  setErroBusca(null);
  
  try {
    // 1. PRIMEIRO: Verificar se está na BLACKLIST
    const placaNormalizada = placaBusca.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const { data: blacklistData, error: blacklistError } = await supabase
      .from('blacklist_veiculos')
      .select('id, motivo, tipo_reprovacao, created_at')
      .eq('placa', placaNormalizada)
      .eq('ativo', true)
      .maybeSingle();
    
    if (!blacklistError && blacklistData) {
      // VEÍCULO BLOQUEADO - Interromper fluxo
      setBlacklistInfo(blacklistData);
      setShowBlacklistModal(true);
      setBuscandoPlaca(false);
      return;
    }

    // 2. Depois verificar placa duplicada (já existente)
    const placaDuplicada = await verificarPlacaDuplicada.mutateAsync(placaBusca);
    // ... resto do código existente
  }
};
```

**Final do componente (~linha 1550)**: Adicionar o modal:
```typescript
{/* Modal Veículo na Blacklist */}
<PlacaBlacklistModal
  open={showBlacklistModal}
  onOpenChange={setShowBlacklistModal}
  placa={placaBusca}
  info={blacklistInfo}
/>
```

---

### Fluxo Após Implementação

```
┌─────────────────────────────────────────────────────────────────┐
│  VENDEDOR DIGITA PLACA: ABC-1234                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. VERIFICA BLACKLIST                                          │
│     SELECT * FROM blacklist_veiculos                            │
│     WHERE placa = 'ABC1234' AND ativo = true                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌─────────────────────┐       ┌─────────────────────────────────┐
│  ESTÁ NA BLACKLIST  │       │  NÃO ESTÁ NA BLACKLIST          │
│                     │       │                                 │
│  ┌───────────────┐  │       │  2. Verificar placa duplicada   │
│  │ ⛔ BLOQUEADO  │  │       │  3. Buscar dados FIPE           │
│  │               │  │       │  4. Continuar cotação           │
│  │ Veículo       │  │       │                                 │
│  │ reprovado!    │  │       └─────────────────────────────────┘
│  │               │  │
│  │ Motivo: ...   │  │
│  │ Data: ...     │  │
│  │               │  │
│  │ [Entendido]   │  │
│  └───────────────┘  │
│                     │
│  FLUXO INTERROMPIDO │
└─────────────────────┘
```

---

### Resultado Esperado

Após implementação:
1. Vendedor digita a placa no Cotador
2. Sistema verifica PRIMEIRO se está na blacklist
3. Se estiver bloqueado:
   - Modal vermelho aparece com ícone de bloqueio
   - Exibe motivo do bloqueio (vistoria/proposta reprovada)
   - Exibe data de inclusão na blacklist
   - Instrui a contatar a diretoria
   - Botão "Entendido" fecha o modal
   - Cotação NÃO pode prosseguir
4. Se não estiver bloqueado:
   - Continua fluxo normal (verifica duplicada, busca FIPE, etc.)
