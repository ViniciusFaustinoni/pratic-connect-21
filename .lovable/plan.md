
## Plano: Gerenciamento de Manutenções para Coordenador de Monitoramento

### Contexto e Análise

A investigação revelou que a funcionalidade de manutenção já está **parcialmente implementada**:

| Componente | Status | Detalhes |
|------------|--------|----------|
| Hook `useCriarManutencao` | ✅ Implementado | Cria serviço `vistoria_manutencao` com atribuição automática |
| Modal `EnviarManutencaoModal` | ✅ Implementado | Seleção de data (a partir de amanhã) e período |
| Página `ExecutarManutencao` | ✅ Implementado | Interface simplificada com "Cheguei" e "Concluir" |
| Rota `/instalador/manutencao/:id` | ✅ Configurada | Navegação funcional |
| TarefaAtualCard | ✅ Implementado | Detecta manutenção via `isManutencao()` |
| Fila de Vistorias | ✅ Implementado | Exibe tipo "manutencao" com badge distinta |
| Menu de ações (Rastreadores.tsx) | ❌ Faltando | Opção "Enviar para Manutenção" não existe |
| Período do dia atual | ❌ Faltando | Modal só permite a partir de amanhã |

### Ajustes Necessários

#### 1. Adicionar opção "Enviar para Manutenção" no menu de ações

**Arquivo:** `src/pages/monitoramento/Rastreadores.tsx`

Adicionar estado para controlar o modal de manutenção e adicionar a opção no dropdown menu para rastreadores com status `instalado`:

```typescript
// Adicionar estado
const [dialogManutencao, setDialogManutencao] = useState<{
  id: string;
  codigo: string;
  imei: string | null;
  status: string;
  veiculo: { placa: string; modelo: string | null } | null;
} | null>(null);

// No dropdown menu, após a opção "Ver Estoque":
{rastreador.status === 'instalado' && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem 
      onClick={() => setDialogManutencao({
        id: rastreador.id,
        codigo: rastreador.codigo,
        imei: rastreador.imei,
        status: rastreador.status,
        veiculo: rastreador.veiculos ? {
          placa: rastreador.veiculos.placa,
          modelo: rastreador.veiculos.modelo
        } : null,
      })}
    >
      <Wrench className="mr-2 h-4 w-4" />
      Enviar para Manutenção
    </DropdownMenuItem>
  </>
)}

// Adicionar o modal no final do componente
<EnviarManutencaoModal
  open={!!dialogManutencao}
  onOpenChange={() => setDialogManutencao(null)}
  rastreador={dialogManutencao}
/>
```

#### 2. Modificar o Modal para permitir agendamento no dia atual + próximos 2 dias

**Arquivo:** `src/components/monitoramento/estoque/EnviarManutencaoModal.tsx`

O modal atual permite agendamento a partir de **amanhã até 30 dias**. Precisa ser modificado para:
- Permitir **hoje + 2 dias** (total de 3 dias)
- Filtrar períodos do dia atual baseado na hora (se passou do horário do período, não exibir)

```typescript
// Alterar de:
const dataMinima = addDays(new Date(), 1); // A partir de amanhã
const dataMaxima = addDays(new Date(), 30); // Até 30 dias

// Para:
const dataMinima = new Date(); // Hoje
const dataMaxima = addDays(new Date(), 2); // Até 2 dias (hoje + próximos 2)

// O filtro de períodos por hora já existe em getPeriodosDisponivelsPorHora()
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/monitoramento/Rastreadores.tsx` | Adicionar estado, opção no menu e modal de manutenção |
| `src/components/monitoramento/estoque/EnviarManutencaoModal.tsx` | Ajustar datas permitidas para hoje + 2 dias |

### Imports Necessários (Rastreadores.tsx)

```typescript
import { Wrench } from 'lucide-react';
import { EnviarManutencaoModal } from '@/components/monitoramento/estoque/EnviarManutencaoModal';
```

### Fluxo Completo Após Implementação

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    COORDENADOR DE MONITORAMENTO                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Rastreadores > Menu (⋯) > "Enviar para Manutenção"                 │
│                    │                                                    │
│                    ▼                                                    │
│  2. Modal de Agendamento                                               │
│     ┌──────────────────────────────────────────────────────────┐       │
│     │ Rastreador: ABC-123                                       │       │
│     │ Status: Instalado > Em Manutenção                         │       │
│     │ Veículo: ABC1D23 - Honda Civic                           │       │
│     │                                                           │       │
│     │ Data: [Hoje] [Amanhã] [Depois de amanhã]                 │       │
│     │                                                           │       │
│     │ Período: [☀️ Manhã 08-12h] [🌅 Tarde 14-18h]              │       │
│     │          (vagas disponíveis mostradas)                    │       │
│     │                                                           │       │
│     │ Motivo: [_______________________]                         │       │
│     └──────────────────────────────────────────────────────────┘       │
│                    │                                                    │
│                    ▼                                                    │
│  3. Sistema executa:                                                   │
│     - Atualiza rastreador.status = 'manutencao'                        │
│     - Registra movimentação de estoque                                 │
│     - Cria servico tipo = 'vistoria_manutencao'                        │
│                    │                                                    │
│                    ▼                                                    │
│  4. Vistoria aparece em:                                               │
│     - Fila de Vistorias (badge "Manutenção")                           │
│     - Atribuição automática para vistoriador                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         VISTORIADOR (APP)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  5. Tarefa atribuída automaticamente                                   │
│     ┌──────────────────────────────────────────────────────────┐       │
│     │ [MANUTENÇÃO]                                              │       │
│     │ Cliente: João Silva                                       │       │
│     │ Veículo: ABC1D23                                          │       │
│     │ Endereço: Rua das Flores, 123                            │       │
│     │                                                           │       │
│     │ [Iniciar Rota]                                           │       │
│     └──────────────────────────────────────────────────────────┘       │
│                    │                                                    │
│                    ▼                                                    │
│  6. Ao iniciar rota > navega para ExecutarManutencao.tsx               │
│     ┌──────────────────────────────────────────────────────────┐       │
│     │ 🔧 Manutenção de Rastreador                              │       │
│     │ ─────────────────────────────────────────                │       │
│     │ Cliente | Veículo | Endereço | Motivo                    │       │
│     │                                                           │       │
│     │ [Navegar até o local]                                    │       │
│     │ [🎬 Cheguei no Local] ← Registra início                  │       │
│     │                                                           │       │
│     │ [✅ Concluir Manutenção] ← Finaliza tarefa               │       │
│     │                                                           │       │
│     │ SEM EXIGÊNCIA DE FOTOS OU CHECKLIST                      │       │
│     └──────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### O que já está funcionando

1. **Fila de Vistorias**: Vistorias de manutenção já aparecem com badge "Manutenção" (cor laranja)
2. **TarefaAtualCard**: Detecta tipo `vistoria_manutencao` via `isManutencao()` e navega para `/instalador/manutencao/:id`
3. **ExecutarManutencao.tsx**: Interface simplificada sem fotos/checklist, apenas botões "Cheguei" e "Concluir"
4. **Atribuição automática**: Hook `useCriarManutencao` cria serviço com `permite_encaixe: true`

### Sequência de Implementação

1. Modificar `EnviarManutencaoModal.tsx` - Ajustar datas (hoje + 2 dias)
2. Modificar `Rastreadores.tsx` - Adicionar estado e opção no menu
3. Adicionar import do `EnviarManutencaoModal` em `Rastreadores.tsx`
4. Adicionar o componente do modal ao JSX de `Rastreadores.tsx`

### Testes Recomendados

1. Acessar Monitoramento > Rastreadores
2. Encontrar um rastreador com status "Instalado"
3. Clicar no menu de ações (⋯)
4. Verificar opção "Enviar para Manutenção"
5. Testar seleção de datas (hoje, amanhã, depois de amanhã)
6. Confirmar que períodos expirados do dia atual não aparecem
7. Verificar se a manutenção aparece na Fila de Vistorias
