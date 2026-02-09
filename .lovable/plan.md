
# Plano: Integrar Cancelamento (Cadastro) com Retirada (Monitoramento)

## Objetivo

Conectar o fluxo de cancelamento de associado no Cadastro com o processo de retirada de rastreador no Monitoramento, garantindo que o cancelamento definitivo só seja finalizado após devolução do rastreador ou pagamento da multa.

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useAssociados.ts` | Modificar | Interceptar cancelamento para verificar rastreador vinculado |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Modificar | Substituir AlertDialog simples por modal inteligente |
| `src/pages/cadastro/Associados.tsx` | Modificar | Mesma lógica para cancelamento da lista |
| `src/components/cadastro/RastreadorVinculadoModal.tsx` | **CRIAR** | Modal de aviso quando há rastreador |
| `supabase/functions/notificar-retirada-whatsapp/index.ts` | **CRIAR** | Edge function para WhatsApp de retirada |
| `supabase/functions/concluir-retirada/index.ts` | Modificar | Desbloquear cancelamento quando retirada concluída |

---

## Detalhamento Técnico

### 1. Criar Modal `RastreadorVinculadoModal.tsx`

Novo componente em `src/components/cadastro/`:

**Props:**
```typescript
interface RastreadorVinculadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associado: { id: string; nome: string };
  rastreador: { id: string; codigo: string; plataforma: string };
  veiculo: { id: string; placa: string; marca: string; modelo: string };
  onConfirm: (acao: 'criar_retirada' | 'apenas_registrar') => Promise<void>;
  isLoading?: boolean;
}
```

**Layout:**
- Alerta com ícone de aviso
- Dados do rastreador e veículo
- Mensagem explicativa sobre bloqueio de cancelamento
- RadioGroup com 2 opções:
  1. "Criar solicitação de retirada automaticamente" (vai para fila do Monitoramento)
  2. "Apenas registrar cancelamento" (pendência criada)
- Botões: Voltar + Prosseguir

---

### 2. Modificar `useAssociados.ts` (Hook cancelarAssociado)

Na mutation `cancelarAssociado`, ANTES de atualizar status:

```typescript
// 0. Verificar se há rastreador vinculado (NÃO cancelar se tiver)
const { data: veiculosComRastreador } = await supabase
  .from('veiculos')
  .select(`
    id, placa, marca, modelo,
    rastreador:rastreadores!inner(id, codigo, plataforma, status)
  `)
  .eq('associado_id', id)
  .not('rastreador', 'is', null)
  .eq('rastreador.status', 'instalado');

if (veiculosComRastreador && veiculosComRastreador.length > 0) {
  // Retornar info do rastreador para frontend decidir
  return {
    temRastreador: true,
    veiculos: veiculosComRastreador,
  };
}
```

Criar uma nova mutation `cancelarAssociadoComRetirada` que:
1. Cria serviço de retirada com `solicitado_por_modulo: 'cadastro'`
2. Marca `pendencia_rastreador: true` no associado
3. Atualiza status para 'cancelado' mas com bloqueio

---

### 3. Modificar `AssociadoDetalhe.tsx`

**Estado adicional:**
```typescript
const [rastreadorModal, setRastreadorModal] = useState<{
  open: boolean;
  rastreador?: any;
  veiculo?: any;
} | null>(null);
```

**Modificar handleCancelar:**
```typescript
const handleCancelar = async () => {
  if (!id) return;
  
  // Verificar rastreador antes de cancelar
  const { data: veiculosComRastreador } = await supabase
    .from('veiculos')
    .select(`id, placa, marca, modelo, rastreador:rastreadores!inner(id, codigo, plataforma)`)
    .eq('associado_id', id)
    .eq('rastreador.status', 'instalado');

  if (veiculosComRastreador && veiculosComRastreador.length > 0) {
    // Abrir modal de aviso
    const v = veiculosComRastreador[0];
    setRastreadorModal({
      open: true,
      rastreador: v.rastreador[0],
      veiculo: v,
    });
    setCancelarDialogOpen(false);
    return;
  }

  // Sem rastreador - cancelamento normal
  cancelarAssociado({ id, motivo: 'Cancelado pelo administrador' });
  setCancelarDialogOpen(false);
  navigate('/cadastro/associados');
};
```

**Handler do modal:**
```typescript
const handleConfirmRastreadorModal = async (acao: 'criar_retirada' | 'apenas_registrar') => {
  if (!rastreadorModal || !id) return;
  
  if (acao === 'criar_retirada') {
    // Usar hook de abrir retirada
    await criarSolicitacaoRetirada({
      rastreadorId: rastreadorModal.rastreador.id,
      motivo: 'cancelamento_voluntario',
      solicitadoPorModulo: 'cadastro',
      bloquearCancelamento: true,
    });
  }
  
  // Atualizar associado com pendência
  await supabase.from('associados').update({
    status: 'cancelado',
    pendencia_rastreador: true,
    pendencia_rastreador_servico_id: /* ID do serviço se criou */,
    motivo_cancelamento: 'Cancelado pelo administrador',
    data_cancelamento: new Date().toISOString(),
  }).eq('id', id);
  
  setRastreadorModal(null);
  navigate('/cadastro/associados');
};
```

**Banner de pendência** (adicionar no topo da página):
```tsx
{associado.pendencia_rastreador && (
  <Alert variant="destructive" className="mb-4">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      <strong>Pendência de rastreador:</strong> O cancelamento não pode ser 
      finalizado até a devolução do equipamento ou pagamento da multa (R$ 400,00).
    </AlertDescription>
  </Alert>
)}
```

---

### 4. Criar Edge Function `notificar-retirada-whatsapp`

Baseada no padrão de `notificar-manutencao-whatsapp`:

```typescript
// supabase/functions/notificar-retirada-whatsapp/index.ts

interface NotificacaoRetiradaPayload {
  telefone: string;
  nome_associado: string;
  veiculo_modelo: string;
  veiculo_placa: string;
  data_agendada: string;
  periodo: 'manha' | 'tarde';
  local: string;
  motivo: string;
}

// Usar variável: N8N_WEBHOOK_URL_RETIRADA
// Mensagem: "Prezado(a) [nome], informamos que a retirada do equipamento 
// rastreador do veículo [modelo • placa] está agendada para [data] 
// no período da [período]. Local: [local]. Prazo: 48 horas. Em caso de 
// não comparecimento, será aplicada multa de R$400 conforme regulamento. Praticcar."
```

---

### 5. Modificar Edge Function `concluir-retirada`

Adicionar lógica para desbloquear cancelamento:

```typescript
// Após atualizar serviço e rastreador...

// 11. Se cancelamento estava bloqueado, desbloquear
const { data: servicoAtual } = await supabase
  .from('servicos')
  .select('cancelamento_bloqueado_ate_devolucao, associado_id')
  .eq('id', servicoId)
  .single();

if (servicoAtual?.cancelamento_bloqueado_ate_devolucao && servicoAtual.associado_id) {
  await supabase.from('associados').update({
    pendencia_rastreador: false,
    pendencia_rastreador_servico_id: null,
    updated_at: new Date().toISOString(),
  }).eq('id', servicoAtual.associado_id);
  
  console.log('Cancelamento desbloqueado para associado:', servicoAtual.associado_id);
}
```

---

### 6. Hook para Solicitação de Retirada do Cadastro

Adicionar função em `useRetiradaRastreador.ts`:

```typescript
export function useCriarSolicitacaoRetiradaCadastro() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      rastreadorId: string;
      veiculoId: string;
      associadoId: string;
      motivo: MotivoRetirada;
    }) => {
      // Criar serviço de retirada com status 'pendente' (sem agendamento)
      const { data, error } = await supabase.from('servicos').insert({
        tipo: 'vistoria_retirada',
        status: 'pendente', // Monitoramento vai agendar
        rastreador_id: params.rastreadorId,
        veiculo_id: params.veiculoId,
        associado_id: params.associadoId,
        motivo_retirada: params.motivo,
        solicitado_por_modulo: 'cadastro',
        cancelamento_bloqueado_ate_devolucao: true,
      }).select('id').single();
      
      if (error) throw error;
      return data;
    },
    // ... invalidações
  });
}
```

---

## Migration SQL (Campos Pendência)

```sql
-- Adicionar campos de pendência de rastreador
ALTER TABLE associados 
ADD COLUMN IF NOT EXISTS pendencia_rastreador BOOLEAN DEFAULT false;

ALTER TABLE associados 
ADD COLUMN IF NOT EXISTS pendencia_rastreador_servico_id UUID 
REFERENCES servicos(id) ON DELETE SET NULL;

-- Índice para queries
CREATE INDEX IF NOT EXISTS idx_associados_pendencia_rastreador 
ON associados(pendencia_rastreador) WHERE pendencia_rastreador = true;

COMMENT ON COLUMN associados.pendencia_rastreador IS 
'Indica se o associado tem rastreador pendente de devolução (bloqueia finalização de cancelamento)';

COMMENT ON COLUMN associados.pendencia_rastreador_servico_id IS 
'ID do serviço de retirada vinculado à pendência';
```

---

## Fluxo Visual

```
┌──────────────────────────────────────────────────────────────────┐
│                     MÓDULO DE CADASTRO                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Usuário clica "Cancelar Associado"                          │
│                    ↓                                             │
│  2. Sistema verifica: tem rastreador instalado?                  │
│                    ↓                                             │
│        ┌──────────┴──────────┐                                   │
│       SIM                   NÃO                                  │
│        ↓                     ↓                                   │
│  Abre Modal de            Cancela                                │
│  Rastreador Vinculado     normalmente                            │
│        ↓                                                         │
│  Opções:                                                         │
│  • Criar retirada → Serviço "pendente" no Monitoramento         │
│  • Apenas registrar → Flag de pendência                          │
│        ↓                                                         │
│  Associado.status = 'cancelado'                                  │
│  Associado.pendencia_rastreador = true                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                  MÓDULO DE MONITORAMENTO                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Alerta: "X retiradas solicitadas pelo Cadastro"                │
│                    ↓                                             │
│  Coordenador agenda retirada (data, técnico)                     │
│                    ↓                                             │
│  Técnico executa retirada                                        │
│                    ↓                                             │
│  Edge function concluir-retirada:                                │
│  • Rastreador → estoque/retorno_base                             │
│  • Associado.pendencia_rastreador = false ← DESBLOQUEIA          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Checklist de Implementação

- [ ] Criar migration SQL para campos `pendencia_rastreador`
- [ ] Criar componente `RastreadorVinculadoModal.tsx`
- [ ] Modificar `AssociadoDetalhe.tsx` para verificar rastreador antes de cancelar
- [ ] Modificar `Associados.tsx` (lista) com mesma lógica
- [ ] Adicionar mutation `useCriarSolicitacaoRetiradaCadastro` em `useRetiradaRastreador.ts`
- [ ] Criar edge function `notificar-retirada-whatsapp`
- [ ] Modificar `concluir-retirada` para desbloquear cancelamento
- [ ] Adicionar banner de pendência na ficha do associado
- [ ] Testar fluxo completo end-to-end
