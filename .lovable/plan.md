
# Plano: Implementar Dialog "Ver Detalhes" do Rastreador

## Problema

Na lista de rastreadores (`ListaRastreadores.tsx`), o botão "Ver Detalhes" no menu dropdown não funciona porque:

1. O estado `dialogDetalhes` é definido na linha 109
2. O clique define o ID do rastreador: `setDialogDetalhes(item.id)` (linha 436)
3. **Não existe nenhum componente Dialog que usa esse estado**

## Solução

Criar um componente `DetalhesRastreadorDialog` que será reutilizável e exibirá informações completas do rastreador.

---

## Alterações

### 1. Criar novo componente `DetalhesRastreadorDialog.tsx`

**Arquivo:** `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx`

Criar um dialog que mostra:
- Status atual com badge colorido
- Informações básicas (código, IMEI, número de série)
- Plataforma e ID na plataforma
- Dados do chip (ICCID, operadora)
- Veículo vinculado (se instalado)
- Associado (se aplicável)
- Portador atual (se em estoque)
- Data de entrada
- Última comunicação
- Histórico de movimentações (últimas 10)

Estrutura do componente:
```tsx
interface DetalhesRastreadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreadorId: string | null;
}

export function DetalhesRastreadorDialog({ open, onOpenChange, rastreadorId }: Props) {
  // Query para buscar dados do rastreador
  const { data: rastreador, isLoading } = useQuery({
    queryKey: ['rastreador-detalhes', rastreadorId],
    queryFn: async () => {
      // Buscar rastreador com veículo, associado e portador
    },
    enabled: !!rastreadorId && open,
  });

  // Query para buscar histórico
  const { data: historico } = useQuery({...});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Rastreador</DialogTitle>
        </DialogHeader>
        
        {/* Status Card */}
        {/* Grid de informações */}
        {/* Histórico de movimentações */}
      </DialogContent>
    </Dialog>
  );
}
```

### 2. Atualizar `ListaRastreadores.tsx`

Adicionar o novo dialog ao final do componente:

```tsx
// Importar o novo componente
import { DetalhesRastreadorDialog } from './DetalhesRastreadorDialog';

// No final do componente, antes de fechar o div principal:
<DetalhesRastreadorDialog
  open={!!dialogDetalhes}
  onOpenChange={() => setDialogDetalhes(null)}
  rastreadorId={dialogDetalhes}
/>
```

---

## Conteúdo do Dialog

O dialog exibirá em formato organizado:

```
┌────────────────────────────────────────────────────────────┐
│  Detalhes do Rastreador                               [X]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📦 RAT-86266708340368                              │    │
│  │ [Estoque]  [Softruck]                              │    │
│  │ Portador: Técnico 1                                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  Informações Técnicas                                      │
│  ┌──────────────────────┬─────────────────────────────┐    │
│  │ IMEI                 │ 86266708340368              │    │
│  │ Número de Série      │ ABC123456                   │    │
│  │ Plataforma           │ Softruck                    │    │
│  │ ID Plataforma        │ STK-12345                   │    │
│  │ ICCID do Chip        │ 8955...                     │    │
│  │ Operadora            │ Vivo                        │    │
│  │ Entrada              │ 02/02/2026                  │    │
│  │ Última Comunicação   │ 07/02/2026 15:30            │    │
│  └──────────────────────┴─────────────────────────────┘    │
│                                                            │
│  Histórico de Movimentações                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │ • entrada_estoque                                  │    │
│  │   02/02/2026 10:00 • Admin                         │    │
│  │   NF: 12345                                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│                                            [Fechar]        │
└────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx` | Criar |
| `src/components/monitoramento/estoque/ListaRastreadores.tsx` | Adicionar import e uso do dialog |

---

## Resultado Esperado

1. Clicar em "Ver Detalhes" abre o dialog com informações completas
2. Mostra status com ícone e cor correspondente
3. Exibe informações técnicas organizadas em grid
4. Histórico de movimentações com timeline visual
5. Botão de fechar funcional
