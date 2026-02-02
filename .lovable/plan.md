
# Plano: Mover Ações para Propostas Pendentes

## Contexto do Problema

Os botões de **"Enviar para SGA"**, **"Ativar Rastreador"** e **"Excluir Associado"** estão distribuídos incorretamente:
- O botão SGA foi adicionado à página de Ativações (`/vendas/ativacoes`)
- O botão de ativar rastreador está só na seção de instalações pendentes
- O botão de excluir associado não existe na página de propostas

O usuário precisa que **todas essas ações** estejam disponíveis na página de **Propostas Pendentes** (`/cadastro/propostas-pendentes`).

## Solução

Refatorar a página `PropostasPendentes.tsx` para:

1. **Substituir o botão "Analisar"** por um **menu dropdown** com múltiplas ações
2. **Adicionar as seguintes ações**:
   - Analisar (navegar para detalhes)
   - Enviar para SGA (se não sincronizado)
   - Ativar Rastreador (se instalação concluída mas não ativado)
   - Excluir Associado (apenas para diretores, com confirmação)

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/cadastro/PropostasPendentes.tsx` | Adicionar dropdown e funções de ação |

## Alterações Detalhadas

### 1. Novos Imports

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Upload, Zap, Trash2, Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteAssociado } from '@/hooks/useAssociados';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmacaoAcaoDialog } from '@/components/associados/ConfirmacaoAcaoDialog';
```

### 2. Novos Estados e Hooks

```typescript
const { isDiretor } = usePermissions();
const { mutate: deleteAssociado, isPending: isExcluindo } = useDeleteAssociado();

const [enviandoSGAId, setEnviandoSGAId] = useState<string | null>(null);
const [ativandoRastreadorId, setAtivandoRastreadorId] = useState<string | null>(null);
const [dialogExcluirAberto, setDialogExcluirAberto] = useState(false);
const [associadoParaExcluir, setAssociadoParaExcluir] = useState<{ id: string; nome: string } | null>(null);
```

### 3. Função: Enviar para SGA

```typescript
const handleEnviarSGA = async (proposta: PropostaPendente) => {
  if (!proposta.veiculo_id || !proposta.associado_id) {
    toast.error('Veículo ou associado não encontrado');
    return;
  }
  
  setEnviandoSGAId(proposta.id);
  try {
    // Buscar veiculo_id real da proposta
    const { data: veiculo } = await supabase
      .from('veiculos')
      .select('id')
      .eq('associado_id', proposta.associado_id)
      .eq('placa', proposta.veiculo_placa)
      .single();
    
    if (!veiculo) throw new Error('Veículo não encontrado');
    
    const { data, error } = await supabase.functions.invoke('sga-hinova-sync', {
      body: { veiculo_id: veiculo.id, associado_id: proposta.associado_id }
    });
    
    if (error) throw error;
    if (data.success) {
      toast.success('Enviado para SGA com sucesso!');
      refetch();
    } else {
      throw new Error(data.error);
    }
  } catch (err: any) {
    toast.error(err.message || 'Erro ao enviar para SGA');
  } finally {
    setEnviandoSGAId(null);
  }
};
```

### 4. Função: Ativar Rastreador

```typescript
const handleAtivarRastreador = async (proposta: PropostaPendente) => {
  if (!proposta.instalacao_info?.rastreador_id || !proposta.associado_id) {
    toast.error('Dados insuficientes para ativação');
    return;
  }
  
  setAtivandoRastreadorId(proposta.id);
  try {
    // Buscar veiculo_id
    const { data: veiculo } = await supabase
      .from('veiculos')
      .select('id')
      .eq('associado_id', proposta.associado_id)
      .eq('placa', proposta.veiculo_placa)
      .single();
    
    if (!veiculo) throw new Error('Veículo não encontrado');
    
    // Ativar baseado na plataforma
    const plataforma = proposta.instalacao_info.rastreador_plataforma;
    let endpoint = '';
    
    if (plataforma === 'softruck') {
      endpoint = 'softruck-ativar-dispositivo';
    } else if (plataforma === 'rede_veiculos') {
      endpoint = 'rede-veiculos-vincular-cliente';
    } else {
      // Ativação local
      await supabase.from('rastreadores')
        .update({ status: 'instalado', veiculo_id: veiculo.id })
        .eq('id', proposta.instalacao_info.rastreador_id);
      
      toast.success('Rastreador ativado!');
      refetch();
      return;
    }
    
    const { data, error } = await supabase.functions.invoke(endpoint, {
      body: { 
        imei: proposta.instalacao_info.rastreador_imei,
        veiculoId: veiculo.id,
        associadoId: proposta.associado_id,
      }
    });
    
    if (error) throw error;
    if (data.success) {
      toast.success('Rastreador ativado na plataforma!');
      refetch();
    }
  } catch (err: any) {
    toast.error(err.message || 'Erro ao ativar rastreador');
  } finally {
    setAtivandoRastreadorId(null);
  }
};
```

### 5. Função: Excluir Associado

```typescript
const handleExcluirAssociado = async (motivo: string) => {
  if (!associadoParaExcluir) return;
  
  try {
    deleteAssociado(associadoParaExcluir.id);
    setDialogExcluirAberto(false);
    setAssociadoParaExcluir(null);
    refetch();
  } catch (err) {
    // Erro tratado pelo hook
  }
};
```

### 6. Novo Componente de Menu de Ações

Substituir o botão atual por um dropdown:

```tsx
<TableCell className="text-right">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        {(enviandoSGAId === proposta.id || ativandoRastreadorId === proposta.id) ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {/* Analisar */}
      <DropdownMenuItem onClick={() => navigate(`/cadastro/propostas/${proposta.id}`)}>
        <Eye className="mr-2 h-4 w-4" />
        Analisar Proposta
      </DropdownMenuItem>

      {/* Enviar para SGA - se não sincronizado */}
      {!proposta.associado?.sincronizado_hinova && proposta.associado_id && (
        <DropdownMenuItem 
          onClick={(e) => { e.stopPropagation(); handleEnviarSGA(proposta); }}
          disabled={enviandoSGAId === proposta.id}
        >
          <Upload className="mr-2 h-4 w-4" />
          Enviar para SGA
        </DropdownMenuItem>
      )}

      {/* Ativar Rastreador - se instalação concluída mas não ativado */}
      {proposta.instalacao_info && 
       !proposta.instalacao_info.rastreador_ativado && 
       proposta.instalacao_info.rastreador_id && (
        <DropdownMenuItem 
          onClick={(e) => { e.stopPropagation(); handleAtivarRastreador(proposta); }}
          disabled={ativandoRastreadorId === proposta.id}
        >
          <Zap className="mr-2 h-4 w-4" />
          Ativar Rastreador
        </DropdownMenuItem>
      )}

      {/* Excluir Associado - apenas diretores */}
      {isDiretor && proposta.associado_id && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setAssociadoParaExcluir({ 
                id: proposta.associado_id!, 
                nome: proposta.cliente_nome || 'Associado' 
              });
              setDialogExcluirAberto(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir Associado
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
</TableCell>
```

### 7. Dialog de Confirmação de Exclusão

Adicionar no final do componente, antes do fechamento da div principal:

```tsx
<ConfirmacaoAcaoDialog
  open={dialogExcluirAberto}
  onOpenChange={setDialogExcluirAberto}
  acao="excluir"
  nomeAssociado={associadoParaExcluir?.nome || ''}
  onConfirm={handleExcluirAssociado}
/>
```

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│  PROPOSTAS PENDENTES - Tabela de Propostas                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Cliente        │ Veículo    │ Plano  │ Status  │ Ações (...)   │
│  ───────────────┼────────────┼────────┼─────────┼───────────────│
│  Marcus Vinicius│ LTB4J74    │ Elite  │ Assinado│ [...]         │
│                 │            │        │         │    │          │
│                 │            │        │         │    ▼          │
│                 │            │        │         │ ┌───────────────────┐
│                 │            │        │         │ │ 👁️ Analisar       │
│                 │            │        │         │ │ 📤 Enviar para SGA│
│                 │            │        │         │ │ ⚡ Ativar Rastread.│
│                 │            │        │         │ │ ────────────────  │
│                 │            │        │         │ │ 🗑️ Excluir (dir.) │
│                 │            │        │         │ └───────────────────┘
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Condições de Exibição das Ações

| Ação | Condição |
|------|----------|
| Analisar | Sempre visível |
| Enviar para SGA | `!associado.sincronizado_hinova && associado_id` |
| Ativar Rastreador | `instalacao_info && !rastreador_ativado && rastreador_id` |
| Excluir Associado | `isDiretor && associado_id` |

## Atualização de Dados

Para que o botão "Enviar para SGA" funcione corretamente, precisamos garantir que a query em `usePropostasPendentes` busque o campo `sincronizado_hinova` do associado. O campo já está disponível via `proposta.associado?.sincronizado_hinova`.

## Remoção de Código Duplicado

Após esta implementação, **remover** a lógica de SGA adicionada anteriormente em `AtivacoesList.tsx`:
- Estado `enviandoSGAId`
- Função `handleEnviarSGA`
- Props `onEnviarSGA` e `isEnviandoSGA` do `AtivacaoTableRow`

## Validação

Após implementação:

1. Acessar `/cadastro/propostas-pendentes`
2. Encontrar proposta do MARCUS VINICIUS FAUSTINONI DE FREITAS
3. Clicar no menu (...)
4. Verificar opções disponíveis:
   - ✅ Analisar Proposta
   - ✅ Enviar para SGA (se não sincronizado)
   - ✅ Ativar Rastreador (se instalação concluída sem ativação)
   - ✅ Excluir Associado (só para diretores)
5. Testar envio para SGA e verificar `codigo_conta: 2`
