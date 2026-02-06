
## Plano: Temporizador de Execução + Relatório de Vistorias por Vistoriador

### Objetivo
1. Ao clicar em "Executar Instalação/Vistoria", mostrar um temporizador em tempo real acima do card do associado
2. O tempo de execução já é salvo no banco (campos `iniciada_em` e `concluida_em` já existem)
3. Fazer o botão "Relatório" na tela Equipe abrir um modal com lista de vistorias/instalações e tempos

---

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/vistoriador/TemporizadorExecucao.tsx` | Componente de temporizador visual que mostra o tempo decorrido desde o início da tarefa |
| `src/components/monitoramento/RelatorioTarefasModal.tsx` | Modal que exibe lista de tarefas concluídas por profissional com tempo de execução |
| `src/hooks/useTarefasProfissional.ts` | Hook para buscar histórico de tarefas de um profissional específico |

---

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/instalador/InstaladorChecklist.tsx` | Adicionar componente TemporizadorExecucao no topo da tela |
| `src/pages/instalador/ExecutarVistoriaCompleta.tsx` | Adicionar componente TemporizadorExecucao no topo da tela |
| `src/pages/monitoramento/Equipe.tsx` | Conectar botão "Relatório" ao modal RelatorioTarefasModal |

---

### Detalhamento Técnico

#### 1. Componente TemporizadorExecucao

```typescript
// src/components/vistoriador/TemporizadorExecucao.tsx
interface TemporizadorExecucaoProps {
  iniciadaEm: string | null; // ISO timestamp
  className?: string;
}

// Funcionalidades:
// - Recebe o timestamp de início (iniciada_em)
// - Calcula diferença em tempo real usando useState + setInterval (1 segundo)
// - Exibe no formato "00:00:00" (horas:minutos:segundos)
// - Visual com ícone Timer, cor verde pulsante
// - Persistente durante toda a execução da vistoria
```

**Visual do componente:**
```
┌─────────────────────────────────────────────────┐
│  ⏱️  TEMPO DE EXECUÇÃO: 00:15:32               │
│      (barra verde com animação pulse)          │
└─────────────────────────────────────────────────┘
```

#### 2. Hook useTarefasProfissional

```typescript
// src/hooks/useTarefasProfissional.ts
interface TarefaProfissional {
  id: string;
  tipo: 'vistoria' | 'instalacao' | 'manutencao';
  status: string;
  data_agendada: string;
  iniciada_em: string | null;
  concluida_em: string | null;
  tempo_execucao_min: number | null;
  associado_nome: string;
  veiculo_placa: string;
  bairro: string;
}

// Query: buscar serviços concluídos do profissional
// - Calcular tempo_execucao_min = (concluida_em - iniciada_em) / 60
// - Ordenar por data de conclusão (mais recentes primeiro)
// - Filtrar por período (últimos 30 dias por padrão)
```

#### 3. Modal RelatorioTarefasModal

```typescript
// src/components/monitoramento/RelatorioTarefasModal.tsx
interface RelatorioTarefasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profissionalId: string;
  profissionalNome: string;
}

// Funcionalidades:
// - Título: "Relatório de {nome}"
// - Resumo no topo: total de tarefas, tempo médio de execução
// - Filtros: período (7 dias, 30 dias, todos), tipo de serviço
// - Tabela com colunas: Data, Tipo, Cliente, Veículo, Tempo
// - Badge de cores para tempo (verde=rápido, amarelo=normal, vermelho=lento)
```

**Layout do modal:**
```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Relatório de Produtividade - [TESTE] Vistoriador      [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ Total Tarefas   │  │ Tempo Médio     │  │ Última Tarefa  │  │
│  │     15          │  │    25 min       │  │   Hoje 14:30   │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│                                                                 │
│  Filtros: [Últimos 30 dias ▼]  [Todos os tipos ▼]              │
│                                                                 │
│  ┌─────────┬────────────┬───────────────┬───────────┬────────┐ │
│  │  Data   │    Tipo    │    Cliente    │  Veículo  │ Tempo  │ │
│  ├─────────┼────────────┼───────────────┼───────────┼────────┤ │
│  │ 05/02   │ Instalação │ Marcus V.     │ LTB4J74   │ 12min  │ │
│  │ 04/02   │ Vistoria   │ João Silva    │ ABC1234   │ 18min  │ │
│  │ 04/02   │ Instalação │ Maria Santos  │ XYZ5678   │ 45min  │ │
│  │   ...   │    ...     │     ...       │    ...    │  ...   │ │
│  └─────────┴────────────┴───────────────┴───────────┴────────┘ │
│                                                                 │
│                                           [Fechar]              │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. Modificação em InstaladorChecklist.tsx

Na etapa de execução (quando status = em_andamento), adicionar o temporizador logo após o header:

```typescript
// Linha ~480-485 (após o header fixo)
{servico?.iniciada_em && (
  <TemporizadorExecucao 
    iniciadaEm={servico.iniciada_em} 
    className="mx-4 mt-4"
  />
)}
```

#### 5. Modificação em ExecutarVistoriaCompleta.tsx

Adicionar temporizador após o header:

```typescript
// Linha ~275 (após o header)
{vistoria?.iniciada_em && (
  <TemporizadorExecucao 
    iniciadaEm={vistoria.iniciada_em} 
    className="mx-4 mt-2"
  />
)}
```

#### 6. Modificação em Equipe.tsx

Conectar o botão "Relatório" ao modal:

```typescript
// Adicionar estados:
const [relatorioModalOpen, setRelatorioModalOpen] = useState(false);
const [profissionalRelatorio, setProfissionalRelatorio] = useState<ProfissionalEquipe | null>(null);

// No botão Relatório (linha ~472-475):
<Button 
  variant="outline" 
  size="sm" 
  className="flex-1"
  onClick={() => {
    setProfissionalRelatorio(profissional);
    setRelatorioModalOpen(true);
  }}
>
  <BarChart className="mr-2 h-4 w-4" />
  Relatório
</Button>

// No final do componente:
<RelatorioTarefasModal
  open={relatorioModalOpen}
  onOpenChange={setRelatorioModalOpen}
  profissionalId={profissionalRelatorio?.id || ''}
  profissionalNome={profissionalRelatorio?.nome || ''}
/>
```

---

### Fluxo do Usuário

```
VISTORIADOR:
┌─────────────────────────────────────────────────────────────────┐
│  1. Clica em "Executar Instalação"                             │
│                    ↓                                            │
│  2. Sistema marca iniciada_em = NOW() no banco                 │
│                    ↓                                            │
│  3. Temporizador aparece no topo: ⏱️ 00:00:00                  │
│                    ↓                                            │
│  4. Contador atualiza a cada segundo                           │
│                    ↓                                            │
│  5. Ao concluir, sistema marca concluida_em = NOW()            │
│                    ↓                                            │
│  6. Tempo de execução = concluida_em - iniciada_em (salvo)     │
└─────────────────────────────────────────────────────────────────┘

COORDENADOR:
┌─────────────────────────────────────────────────────────────────┐
│  1. Acessa Monitoramento > Equipe                              │
│                    ↓                                            │
│  2. Clica em "Relatório" no card do profissional               │
│                    ↓                                            │
│  3. Modal abre com lista de tarefas e tempos                   │
│                    ↓                                            │
│  4. Pode filtrar por período e tipo de serviço                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Dados Já Existentes

O banco de dados já salva os timestamps necessários:
- `servicos.iniciada_em` - preenchido quando o profissional inicia a tarefa
- `servicos.concluida_em` - preenchido quando a tarefa é concluída

O tempo de execução é calculado dinamicamente:
```sql
EXTRACT(EPOCH FROM (concluida_em - iniciada_em))/60 as tempo_execucao_min
```

Exemplo de dado já existente:
```
id: c237ff6c-9fd1-40da-9ea5-21f70edcd603
tipo: instalacao
iniciada_em: 2026-02-05 20:04:56
concluida_em: 2026-02-05 20:16:53
tempo_execucao_min: 11.95 (aproximadamente 12 minutos)
```

---

### Resultado Esperado

1. **Temporizador Visual**: O vistoriador vê o tempo de execução em tempo real durante toda a vistoria
2. **Dados Persistentes**: O tempo é calculado automaticamente dos timestamps já salvos
3. **Relatório por Profissional**: O coordenador pode ver todas as tarefas e tempos de cada profissional
4. **Métricas de Produtividade**: Tempo médio, total de tarefas, comparativo entre profissionais
