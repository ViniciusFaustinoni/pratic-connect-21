
## Plano: Implementar Vistoria de Retirada

### Resumo Executivo

A Vistoria de Retirada é um novo tipo de serviço que permite ao Coordenador de Monitoramento agendar a retirada de um rastreador instalado em um veículo. O fluxo é similar a uma instalação (fotos obrigatórias, assinatura do cliente), porém ao finalizar:
- O rastreador é desativado na plataforma externa (Rede Veículos ou Softruck)
- É desassociado do veículo
- É atribuído ao porte do vistoriador que executou a tarefa
- Fica disponível no estoque

### Alterações Necessárias

---

#### 1. Adicionar novo tipo de serviço no banco de dados

**Arquivo:** Nova migração SQL

```sql
-- Adicionar 'vistoria_retirada' ao enum tipo_servico
ALTER TYPE tipo_servico ADD VALUE 'vistoria_retirada';
```

---

#### 2. Atualizar tipos e labels no frontend

**Arquivo:** `src/hooks/useServicos.ts`

Adicionar o novo tipo ao TypeScript e seus labels:

```typescript
export type TipoServico = 
  | 'instalacao' 
  | 'vistoria_entrada' 
  | 'vistoria_saida' 
  | 'vistoria_sinistro'
  | 'vistoria_periodica'
  | 'vistoria_manutencao'
  | 'vistoria_retirada';  // Novo

export const TIPO_SERVICO_LABELS: Record<TipoServico, string> = {
  // ...existentes
  vistoria_retirada: 'Retirada de Rastreador',  // Novo
};
```

---

#### 3. Criar hook `useCriarRetirada`

**Arquivo:** `src/hooks/useCriarRetirada.ts` (novo)

Similar ao `useCriarManutencao.ts`, porém:
- Cria serviço com `tipo: 'vistoria_retirada'`
- Não altera o status do rastreador (será alterado após conclusão)
- Busca dados do veículo e associado para preencher endereço

```typescript
export interface CriarRetiradaParams {
  rastreadorId: string;
  dataAgendada: string;
  periodo: Periodo;
  motivo?: string;
}

export function useCriarRetirada() {
  // Similar ao useCriarManutencao
  // tipo: 'vistoria_retirada'
}

export function isRetirada(tipo: string): boolean {
  return tipo === 'vistoria_retirada';
}
```

---

#### 4. Criar modal `EnviarRetiradaModal`

**Arquivo:** `src/components/monitoramento/estoque/EnviarRetiradaModal.tsx` (novo)

Baseado no `EnviarManutencaoModal.tsx`:
- Mesma seleção de data (hoje + 2 dias) e período
- Ícone diferente (PackageMinus ou similar)
- Texto explicativo: "O rastreador será desativado, desvinculado do veículo e retornará ao estoque do vistoriador"

---

#### 5. Adicionar opção "Retirar Rastreador" no menu de ações

**Arquivo:** `src/pages/monitoramento/Rastreadores.tsx`

Adicionar nova opção no dropdown para rastreadores com `status === 'instalado'`:

```typescript
// Após "Enviar para Manutenção"
{rastreador.status === 'instalado' && (
  <DropdownMenuItem onClick={() => setDialogRetirada({...})}>
    <PackageMinus className="mr-2 h-4 w-4" />
    Retirar Rastreador
  </DropdownMenuItem>
)}
```

---

#### 6. Criar página `ExecutarRetirada`

**Arquivo:** `src/pages/instalador/ExecutarRetirada.tsx` (novo)

Esta é a página mais complexa. Será baseada na `ExecutarVistoriaCompleta.tsx`:

**Funcionalidades:**
- Conferência de dados do veículo (placa, chassi, modelo, cor)
- Registro de hodômetro
- Captura de fotos obrigatórias (mesmas categorias da instalação)
- Vídeo 360° obrigatório
- Observações opcionais
- Assinatura do cliente
- Botão "Concluir Retirada"

**Ao concluir:**
1. Chamar edge function para desativar na plataforma externa
2. Atualizar rastreador: `status = 'estoque'`, `veiculo_id = null`, `portador_id = profissional_id`
3. Limpar IDs de plataforma do veículo
4. Registrar movimentação de estoque
5. Concluir serviço

---

#### 7. Criar edge function `concluir-retirada`

**Arquivo:** `supabase/functions/concluir-retirada/index.ts` (novo)

**Parâmetros:**
- `servicoId`: ID do serviço de retirada
- `rastreadorId`: ID do rastreador
- `veiculoId`: ID do veículo
- `profissionalId`: ID do vistoriador (para atribuir porte)
- `hodometro`: Quilometragem atual
- `assinaturaUrl`: URL da assinatura do cliente

**Fluxo:**
1. Buscar dados do rastreador (plataforma, IMEI, etc.)
2. Se `plataforma === 'rede_veiculos'`:
   - Chamar `rede-veiculos-desvincular-cliente` (já existe)
3. Se `plataforma === 'softruck'`:
   - Chamar `softruck-api` com operação de desativação
4. Atualizar rastreador:
   ```sql
   UPDATE rastreadores SET 
     status = 'estoque',
     veiculo_id = NULL,
     portador_id = profissional_id,
     id_plataforma = NULL
   WHERE id = rastreador_id
   ```
5. Limpar IDs de plataforma do veículo
6. Registrar movimentação de estoque
7. Concluir serviço

---

#### 8. Adicionar rota no App.tsx

**Arquivo:** `src/App.tsx`

```typescript
import ExecutarRetirada from './pages/instalador/ExecutarRetirada';

// Na seção de rotas do instalador
<Route path="/instalador/retirada/:id" element={<ExecutarRetirada />} />
```

---

#### 9. Atualizar TarefaAtualCard para detectar retirada

**Arquivo:** `src/components/vistoriador/TarefaAtualCard.tsx`

Adicionar lógica para navegar para página de retirada:

```typescript
import { isRetirada } from '@/hooks/useCriarRetirada';

const handleExecutar = () => {
  if (isManutencao(tarefa.tipo)) {
    navigate(`/instalador/manutencao/${tarefa.id}`);
  } else if (isRetirada(tarefa.tipo)) {
    navigate(`/instalador/retirada/${tarefa.id}`);  // Novo
  } else if (isInstalacao(tarefa.tipo)) {
    navigate(`/instalador/instalacao/${tarefa.id}`);
  } else {
    navigate(`/instalador/vistoria/${tarefa.id}`);
  }
};
```

---

#### 10. Atualizar FilaVistorias para exibir tipo "retirada"

**Arquivo:** `src/pages/monitoramento/FilaVistorias.tsx`

Adicionar mapeamento para o tipo:

```typescript
type TipoVistoria = 'presencial' | 'auto_vistoria' | 'ponto_fixo' | 'manutencao' | 'retirada';

const TIPO_CONFIG: Record<TipoVistoria, { label: string; className: string }> = {
  // ...existentes
  retirada: { label: 'Retirada', className: 'bg-red-100 text-red-800 border-red-300' },
};

const mapTipo = (modalidade?: string, tipoServico?: string): TipoVistoria => {
  if (tipoServico === 'vistoria_manutencao') return 'manutencao';
  if (tipoServico === 'vistoria_retirada') return 'retirada';  // Novo
  // ...resto
};
```

---

### Fluxo Completo

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    COORDENADOR DE MONITORAMENTO                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Rastreadores > Menu (⋯) > "Retirar Rastreador"                     │
│                    │                                                    │
│                    ▼                                                    │
│  2. Modal de Agendamento de Retirada                                   │
│     ┌──────────────────────────────────────────────────────────┐       │
│     │ Rastreador: ABC-123 (IMEI: 123456789)                    │       │
│     │ Veículo: ABC1D23 - Honda Civic                           │       │
│     │ Associado: João Silva                                    │       │
│     │                                                           │       │
│     │ Data: [Hoje] [Amanhã] [Depois de amanhã]                 │       │
│     │ Período: [Manhã] [Tarde]                                 │       │
│     │ Motivo: [____________________]                           │       │
│     │                                                           │       │
│     │ ⚠️ Ao confirmar, o rastreador será desativado e         │       │
│     │ retornará ao estoque após a retirada.                    │       │
│     └──────────────────────────────────────────────────────────┘       │
│                    │                                                    │
│                    ▼                                                    │
│  3. Vistoria aparece em:                                               │
│     - Fila de Vistorias (badge "Retirada" vermelha)                    │
│     - Atribuição automática para vistoriador                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         VISTORIADOR (APP)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  4. Tarefa atribuída - Badge "Retirada de Rastreador"                  │
│     ┌──────────────────────────────────────────────────────────┐       │
│     │ [RETIRADA DE RASTREADOR]                                  │       │
│     │ Cliente: João Silva                                       │       │
│     │ Veículo: ABC1D23 - Honda Civic                           │       │
│     │ Endereço: Rua das Flores, 123                            │       │
│     │                                                           │       │
│     │ [Iniciar Rota]                                           │       │
│     └──────────────────────────────────────────────────────────┘       │
│                    │                                                    │
│                    ▼                                                    │
│  5. Ao executar > navega para ExecutarRetirada.tsx                     │
│     ┌──────────────────────────────────────────────────────────┐       │
│     │ 📦 Retirada de Rastreador                                │       │
│     │ ─────────────────────────────────────────                │       │
│     │                                                           │       │
│     │ ✅ Conferência de Dados                                  │       │
│     │    ☑ Placa: ABC1D23                                      │       │
│     │    ☑ Chassi: 9BWZZZ377VT123456                          │       │
│     │    ☑ Modelo: Honda Civic                                 │       │
│     │    ☑ Cor: Prata                                          │       │
│     │    Hodômetro: [_______] km                               │       │
│     │                                                           │       │
│     │ 📷 Fotos Obrigatórias (12/12)                            │       │
│     │    [Identificação] [Motor] [Exterior] [Rastreador]       │       │
│     │                                                           │       │
│     │ 🎥 Vídeo 360° ✅                                         │       │
│     │                                                           │       │
│     │ ✍️ Assinatura do Cliente                                 │       │
│     │    [Pad de assinatura]                                   │       │
│     │                                                           │       │
│     │ [✅ Concluir Retirada]                                   │       │
│     └──────────────────────────────────────────────────────────┘       │
│                    │                                                    │
│                    ▼                                                    │
│  6. Sistema executa:                                                   │
│     - Desativa rastreador na plataforma (Rede Veículos/Softruck)       │
│     - Desvincula do veículo                                            │
│     - Atribui ao porte do vistoriador                                  │
│     - Marca como disponível no estoque                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useCriarRetirada.ts` | Hook para criar serviço de retirada |
| `src/components/monitoramento/estoque/EnviarRetiradaModal.tsx` | Modal de agendamento |
| `src/pages/instalador/ExecutarRetirada.tsx` | Página do vistoriador |
| `supabase/functions/concluir-retirada/index.ts` | Edge function de conclusão |

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useServicos.ts` | Adicionar tipo e labels |
| `src/pages/monitoramento/Rastreadores.tsx` | Adicionar opção no menu |
| `src/components/vistoriador/TarefaAtualCard.tsx` | Adicionar navegação |
| `src/pages/monitoramento/FilaVistorias.tsx` | Adicionar tipo e badge |
| `src/App.tsx` | Adicionar rota |

### Migração SQL Necessária

```sql
ALTER TYPE tipo_servico ADD VALUE 'vistoria_retirada';
```

---

### Sequência de Implementação

1. Migração SQL para adicionar novo tipo de serviço
2. Criar `useCriarRetirada.ts` e adicionar helper `isRetirada()`
3. Atualizar `useServicos.ts` com tipo e labels
4. Criar `EnviarRetiradaModal.tsx`
5. Modificar `Rastreadores.tsx` para adicionar opção no menu
6. Criar `ExecutarRetirada.tsx` (baseado em ExecutarVistoriaCompleta)
7. Criar edge function `concluir-retirada`
8. Atualizar `TarefaAtualCard.tsx` para navegação
9. Atualizar `FilaVistorias.tsx` para exibição
10. Adicionar rota em `App.tsx`
