
## Gerenciamento de Manutenções de Rastreadores

### Resumo

Implementar um fluxo completo para que o coordenador de monitoramento possa enviar rastreadores para manutenção através de um agendamento por período (Manhã/Tarde), seguindo o fluxo padrão de atribuição automática. O vistoriador executará a tarefa de forma simplificada (apenas botões de iniciar e concluir).

### Estado Atual do Sistema

O sistema já possui:
- Tipo de serviço `vistoria_manutencao` definido no enum e nos tipos
- Tabela `servicos` unificada para todos os tipos de tarefas
- Fluxo de atribuição automática via Edge Functions
- Página `FilaVistorias` para gestão de vistorias pelo coordenador
- Menu de opções (3 pontinhos) na listagem de rastreadores

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/monitoramento/estoque/EnviarManutencaoModal.tsx` | Modal para agendar manutenção do rastreador |
| `src/hooks/useCriarManutencao.ts` | Hook para criar serviço de manutenção |
| `src/pages/instalador/ExecutarManutencao.tsx` | Página simplificada para o vistoriador executar manutenção |

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/monitoramento/estoque/ListaRastreadores.tsx` | Adicionar opção "Enviar para Manutenção" no menu dropdown |
| `src/pages/monitoramento/Rastreadores.tsx` | Adicionar opção "Enviar para Manutenção" no menu dropdown |
| `src/pages/monitoramento/FilaVistorias.tsx` | Incluir filtro para exibir vistorias de manutenção |
| `src/hooks/useServicos.ts` | Adicionar helper `isManutencao()` |
| `src/components/vistoriador/TarefaAtualCard.tsx` | Redirecionar para página simplificada se for manutenção |
| `src/App.tsx` | Adicionar rota para ExecutarManutencao |

---

### Detalhes de Implementação

#### 1. Modal de Enviar para Manutenção

```text
┌────────────────────────────────────────────────────────────────────────┐
│                    Enviar para Manutenção                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Rastreador: ABC-12345 (IMEI: 867530012345678)                        │
│  Status atual: Instalado                                               │
│  Veículo: ABC-1234 - João Silva                                       │
│                                                                        │
│  ─────────────────────────────────────────────────────────────────────│
│                                                                        │
│  📅 Data do Agendamento *                                              │
│  [ Seg, 10/02/2025 ▼ ]                                                │
│                                                                        │
│  ⏰ Período *                                                          │
│  ┌─────────────────────┐  ┌─────────────────────┐                     │
│  │  ☀️ MANHÃ            │  │  🌅 TARDE            │                     │
│  │  8h às 12h          │  │  14h às 18h         │                     │
│  │  ✓ 8 vagas          │  │  ✓ 10 vagas         │                     │
│  └─────────────────────┘  └─────────────────────┘                     │
│                                                                        │
│  📝 Motivo da Manutenção                                              │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Ex: Rastreador sem comunicação há 48h                          │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ⚠️ Ao confirmar, o rastreador será marcado como "Em Manutenção"      │
│     e uma tarefa será criada para o vistoriador mais próximo.         │
│                                                                        │
│                              [ Cancelar ]  [ Confirmar Agendamento ]  │
└────────────────────────────────────────────────────────────────────────┘
```

Comportamento:
- Modal abre ao clicar em "Enviar para Manutenção" no menu de 3 pontinhos
- Exibe dados do rastreador (código, IMEI, veículo vinculado)
- Permite selecionar data e período (Manhã/Tarde)
- Campo opcional para descrever o motivo da manutenção
- Ao confirmar:
  1. Altera status do rastreador para `manutencao`
  2. Cria registro na tabela `servicos` com `tipo = 'vistoria_manutencao'`
  3. O CRON de atribuição automática atribui ao vistoriador disponível

#### 2. Hook useCriarManutencao

```typescript
interface CriarManutencaoParams {
  rastreadorId: string;
  dataAgendada: string;      // formato: YYYY-MM-DD
  periodo: 'manha' | 'tarde';
  motivo?: string;
}

// Fluxo:
// 1. Busca dados do rastreador (veiculo_id, associado_id)
// 2. Atualiza rastreador.status = 'manutencao'
// 3. Insere em servicos:
//    - tipo: 'vistoria_manutencao'
//    - status: 'pendente'
//    - data_agendada: dataAgendada
//    - periodo: periodo
//    - rastreador_id: rastreadorId
//    - veiculo_id: rastreador.veiculo_id
//    - associado_id: rastreador.associado_id
//    - observacoes: motivo
//    - local_vistoria: 'cliente' (técnico vai até o veículo)
```

#### 3. Página ExecutarManutencao (Simplificada)

```text
┌────────────────────────────────────────────────────────────────────────┐
│ ← Voltar              Manutenção de Rastreador                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  🔧 Rastreador: ABC-12345                                        │ │
│  │  IMEI: 867530012345678                                           │ │
│  │  Veículo: ABC-1234 (Fiat Uno)                                    │ │
│  │  Cliente: João Silva                                             │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  📍 Endereço                                                          │
│  Rua das Flores, 123 - Centro                                        │
│  São Paulo/SP                                                         │
│                            [ Navegar 📍 ]                             │
│                                                                        │
│  📝 Motivo                                                            │
│  "Rastreador sem comunicação há 48h"                                  │
│                                                                        │
│  ────────────────────────────────────────────────────────────────────│
│                                                                        │
│  Se status == 'em_rota':                                              │
│                 [ 🚗 Cheguei no Local ]                               │
│                                                                        │
│  Se status == 'em_andamento':                                         │
│                 [ ✅ Concluir Manutenção ]                            │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

Características:
- **SEM captura de fotos** (diferente de vistoria comum)
- **SEM checklist** de itens
- Apenas dois botões: "Cheguei no Local" → "Concluir Manutenção"
- Ao concluir: status do serviço = `concluida`
- Status do rastreador permanece `manutencao` até coordenador retornar ao estoque

#### 4. Modificações na ListaRastreadores e Rastreadores.tsx

Adicionar opção no DropdownMenu para rastreadores com status `instalado`:

```typescript
// No DropdownMenuContent
{rastreador.status === 'instalado' && (
  <DropdownMenuItem onClick={() => handleEnviarManutencao(rastreador)}>
    <Wrench className="mr-2 h-4 w-4" />
    Enviar para Manutenção
  </DropdownMenuItem>
)}
```

#### 5. Modificações na FilaVistorias

Adicionar suporte para exibir vistorias de manutenção:
- Incluir tipo `vistoria_manutencao` nos filtros
- Exibir badge específica "Manutenção" na listagem
- Permitir reagendar/cancelar manutenções

```typescript
// Adicionar no TIPO_CONFIG
const TIPO_CONFIG = {
  // ... tipos existentes
  manutencao: { label: 'Manutenção', className: 'bg-orange-100 text-orange-800' },
};
```

#### 6. Rota e Redirecionamento

No TarefaAtualCard, ao clicar em "Executar":

```typescript
const handleExecutar = () => {
  if (tarefa.tipo === 'vistoria_manutencao') {
    navigate(`/instalador/manutencao/${tarefa.id}`);
  } else if (isInstalacao(tarefa.tipo)) {
    navigate(`/instalador/instalacao/${tarefa.id}`);
  } else {
    navigate(`/instalador/vistoria/${tarefa.id}`);
  }
};
```

### Fluxo Completo

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ FLUXO DE MANUTENÇÃO DE RASTREADOR                                            │
└──────────────────────────────────────────────────────────────────────────────┘

     COORDENADOR                         SISTEMA                      VISTORIADOR
         │                                  │                              │
         │ 1. Clica "Enviar para           │                              │
         │    Manutenção" no menu           │                              │
         │ ─────────────────────────────────>                              │
         │                                  │                              │
         │ 2. Seleciona data + período      │                              │
         │    (Manhã/Tarde)                 │                              │
         │ ─────────────────────────────────>                              │
         │                                  │                              │
         │                      3. Altera status do                        │
         │                         rastreador para                         │
         │                         'manutencao'                            │
         │                                  │                              │
         │                      4. Cria registro em                        │
         │                         'servicos' com tipo                     │
         │                         'vistoria_manutencao'                   │
         │                                  │                              │
         │                      5. CRON atribui ao                         │
         │                         vistoriador mais                        │
         │                         próximo                                 │
         │                                  │ ─────────────────────────────>
         │                                  │                              │
         │                                  │   6. Recebe notificação de   │
         │                                  │      nova tarefa             │
         │                                  │                              │
         │                                  │   7. Inicia rota             │
         │                                  │   8. Chega no local          │
         │                                  │   9. Realiza manutenção      │
         │                                  │  10. Clica "Concluir"        │
         │                                  │ <─────────────────────────────
         │                                  │                              │
         │                     11. Atualiza serviço                        │
         │                         status = 'concluida'                    │
         │                                  │                              │
         │ 12. Vê tarefa concluída          │                              │
         │     na fila de vistorias         │                              │
         │ <─────────────────────────────────                              │
         │                                  │                              │
         │ 13. Retorna rastreador ao        │                              │
         │     estoque (ação manual)        │                              │
         │ ─────────────────────────────────>                              │
         │                                  │                              │
         v                                  v                              v
```

### Considerações Técnicas

1. **Atribuição Automática**: O serviço de manutenção entrará no fluxo normal do CRON `cron-atribuir-tarefas`, que atribui ao vistoriador mais próximo disponível.

2. **Status do Rastreador**: 
   - Ao criar manutenção: `rastreador.status = 'manutencao'`
   - Após conclusão pelo vistoriador: permanece `manutencao`
   - Coordenador decide manualmente se volta para `estoque` ou `instalado`

3. **Sem Fotos**: A tela do vistoriador para manutenção não terá captura de fotos, apenas botões de "Cheguei no Local" e "Concluir".

4. **Fila de Vistorias**: As manutenções aparecerão na Fila de Vistorias com badge laranja "Manutenção", permitindo acompanhamento pelo coordenador.

5. **Reutilização**: O modal de agendamento reutiliza os mesmos conceitos de período (Manhã/Tarde) já implementados no agendamento de vistoria presencial.
