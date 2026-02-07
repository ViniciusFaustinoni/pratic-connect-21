

# Plano: Completar Tela de Conclusão de Manutenção para o Vistoriador

## Problema Identificado

A tela `ExecutarManutencao.tsx` (app do vistoriador) possui apenas um `AlertDialog` simples que pergunta "Confirme que a manutenção foi realizada". Isso não cobre os 4 cenários reais de campo:

| Cenário | O que acontece | Status Final |
|---------|----------------|--------------|
| A) Resolvido | Consertou (fiação, reset, reposicionamento). Rastreador continua instalado | Concluída |
| B) Substituição | Trocou por novo rastreador do seu porte. Antigo vai para triagem ou baixa | Concluída |
| C) Não Resolvido | Não tinha peça/substituto. Precisa reagendar ou cancelar | Pendente ou Cancelada |
| D) Ausente | Associado não estava (BASE) ou não foi possível acessar (ROTA) | Reagendada |

O sistema já tem toda a lógica backend no hook `useRegistrarResultadoManutencao` e um modal completo `RegistrarResultadoModal` no painel administrativo. A tela do vistoriador precisa usar essa mesma infraestrutura.

---

## Solução

Substituir o `AlertDialog` simples por um modal completo de resultado, adaptado para mobile e reutilizando os hooks existentes.

---

## Alterações

### Arquivo: `src/pages/instalador/ExecutarManutencao.tsx`

#### 1. Remover imports não mais necessários
```diff
- import { AlertDialog, AlertDialogAction, ... } from "@/components/ui/alert-dialog";
```

#### 2. Adicionar novos imports

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { 
  RefreshCw, 
  XCircle, 
  RotateCcw, 
  Trash2, 
  ArrowRight, 
  Search, 
  AlertTriangle,
  UserX
} from 'lucide-react';
import { 
  useRegistrarResultadoManutencao, 
  useRastreadoresParaSubstituicao,
  useMarcarNaoCompareceuManutencao 
} from '@/hooks/useVistoriaManutencao';
import { 
  type ResultadoManutencao,
  type DestinoRastreadorSubstituido,
  type AcaoNaoResolvido,
} from '@/types/vistoriaManutencao';
```

#### 3. Novos estados para o modal de resultado

```typescript
// Modal de resultado
const [showResultadoModal, setShowResultadoModal] = useState(false);
const [resultado, setResultado] = useState<ResultadoManutencao>('resolvido');
const [descricao, setDescricao] = useState('');

// Para substituição
const [rastreadorNovoId, setRastreadorNovoId] = useState('');
const [idPlataforma, setIdPlataforma] = useState('');
const [buscaRastreador, setBuscaRastreador] = useState('');
const [destinoRastreadorAntigo, setDestinoRastreadorAntigo] = useState<DestinoRastreadorSubstituido>('retorno_base');

// Para não resolvido
const [acaoNaoResolvido, setAcaoNaoResolvido] = useState<AcaoNaoResolvido>('reagendar');
```

#### 4. Hooks adicionais

```typescript
const { data: rastreadoresDisponiveis, isLoading: loadingRastreadores } = useRastreadoresParaSubstituicao();
const registrarResultado = useRegistrarResultadoManutencao();
const marcarNaoCompareceu = useMarcarNaoCompareceuManutencao();
```

#### 5. Handler de conclusão com resultado

```typescript
const handleConcluirComResultado = async () => {
  if (!id || !descricao.trim()) {
    toast.error('Preencha a descrição do que foi feito');
    return;
  }

  if (resultado === 'substituicao' && !rastreadorNovoId) {
    toast.error('Selecione o rastreador substituto');
    return;
  }

  await registrarResultado.mutateAsync({
    servicoId: id,
    resultado,
    descricao,
    rastreadorNovoId: resultado === 'substituicao' ? rastreadorNovoId : undefined,
    idPlataforma: resultado === 'substituicao' ? idPlataforma : undefined,
    destinoRastreadorAntigo: resultado === 'substituicao' ? destinoRastreadorAntigo : undefined,
    acaoNaoResolvido: resultado === 'nao_resolvido' ? acaoNaoResolvido : undefined,
  });

  // Feedback conforme resultado
  if (resultado === 'nao_resolvido') {
    toast.success(acaoNaoResolvido === 'reagendar' ? 'Manutenção reagendada' : 'Manutenção cancelada');
  } else {
    toast.success('Manutenção concluída!');
  }
  
  setShowResultadoModal(false);
  navigate('/instalador');
};
```

#### 6. Handler para "Associado Ausente"

```typescript
const handleNaoCompareceu = async () => {
  if (!id) return;
  
  await marcarNaoCompareceu.mutateAsync({
    servicoId: id,
    observacao: 'Associado não estava presente no local',
  });
  
  toast.info('Registrado como não compareceu');
  navigate('/instalador');
};
```

#### 7. Atualizar botão de "Concluir Manutenção"

O botão agora abre o modal de resultado:

```tsx
<Button 
  className="w-full bg-green-600 hover:bg-green-700" 
  onClick={() => setShowResultadoModal(true)}
>
  <CheckCircle2 className="mr-2 h-4 w-4" />
  Concluir Manutenção
</Button>

{/* Botão adicional para não compareceu (apenas se for ROTA) */}
{servico.local_tipo_manutencao === 'rota' && (
  <Button 
    variant="outline"
    className="w-full border-orange-300 text-orange-700"
    onClick={handleNaoCompareceu}
  >
    <UserX className="mr-2 h-4 w-4" />
    Associado Ausente
  </Button>
)}
```

#### 8. Novo modal de resultado (substituir AlertDialog)

O modal terá a mesma estrutura visual do `RegistrarResultadoModal.tsx`, adaptado para mobile:

**Estrutura do modal:**

```
┌─────────────────────────────────────────────┐
│          Resultado da Manutenção            │
├─────────────────────────────────────────────┤
│                                             │
│  [Card] ✓ Problema Resolvido                │
│         Rastreador reparado, continua       │
│                                             │
│  [Card] ↻ Substituição de Rastreador        │
│         Trocar por outro rastreador         │
│                                             │
│  [Card] ✗ Não Resolvido                     │
│         Não foi possível resolver           │
│                                             │
├─────────────────────────────────────────────┤
│  [Campos dinâmicos conforme seleção]        │
│                                             │
│  Se SUBSTITUIÇÃO:                           │
│  - Destino do antigo (Triagem / Baixar)     │
│  - Seleção do novo rastreador               │
│  - ID Plataforma (opcional)                 │
│                                             │
│  Se NÃO RESOLVIDO:                          │
│  - Reagendar ou Cancelar                    │
│                                             │
├─────────────────────────────────────────────┤
│  Descrição: ____________________________    │
│  O que foi feito?                           │
│                                             │
│           [Cancelar]  [Confirmar]           │
└─────────────────────────────────────────────┘
```

#### 9. Resetar estados ao fechar modal

```typescript
useEffect(() => {
  if (!showResultadoModal) {
    setResultado('resolvido');
    setDescricao('');
    setRastreadorNovoId('');
    setIdPlataforma('');
    setBuscaRastreador('');
    setDestinoRastreadorAntigo('retorno_base');
    setAcaoNaoResolvido('reagendar');
  }
}, [showResultadoModal]);
```

---

## Fluxo Visual Completo para o Vistoriador

```
┌─────────────────────┐
│  Chegou no Local    │
│  [Cheguei no Local] │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Em Andamento       │
│                     │
│  [Concluir Manutenção]
│  [Associado Ausente]  ← apenas se ROTA
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│      Modal: Resultado               │
│                                     │
│  ○ Resolvido (consertou)            │
│  ○ Substituição (trocou rastreador) │
│  ○ Não Resolvido (sem peça/etc)     │
│                                     │
│  [campos dinâmicos]                 │
│  [Descrição obrigatória]            │
│                                     │
│  [Cancelar]  [Confirmar]            │
└─────────────────────────────────────┘
```

---

## Resultado Esperado

1. Vistoriador vê 3 opções claras de resultado ao concluir
2. Se **Resolvido**: apenas descreve o que fez
3. Se **Substituição**: 
   - Escolhe destino do antigo (Triagem ou Baixar)
   - Seleciona novo rastreador do seu estoque
   - Opcionalmente informa ID na plataforma
4. Se **Não Resolvido**:
   - Escolhe entre Reagendar ou Cancelar
5. Campo de descrição sempre obrigatório
6. Botão extra "Associado Ausente" para quando for tipo ROTA

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/instalador/ExecutarManutencao.tsx` | Substituir AlertDialog por modal completo com 3 cenários de resultado |

