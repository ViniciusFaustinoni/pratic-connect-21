
# Plano: Sistema de Vistoria de Manutencao de Rastreadores (Integracao)

## Analise do Sistema Atual

### O Que Ja Existe

1. **Tabela `servicos`** - Unificada para todas as tarefas operacionais:
   - Tipos existentes: `instalacao`, `vistoria_entrada`, `vistoria_saida`, `vistoria_sinistro`, `vistoria_periodica`, `vistoria_manutencao`, `vistoria_retirada`
   - Status: `pendente`, `agendada`, `em_rota`, `em_andamento`, `concluida`, etc.

2. **Hook `useCriarManutencao`** - Ja implementado:
   - Atualiza rastreador.status para `manutencao`
   - Cria registro em `servicos` com tipo `vistoria_manutencao`
   - Registra movimentacao em `estoque_movimentacoes`

3. **Enum `status_rastreador`** - Atual:
   - `estoque`, `instalado`, `manutencao`, `baixado`

4. **Fila de Vistorias** - Ja integra manutencoes:
   - Busca servicos de `vistoria_manutencao` e `vistoria_retirada`
   - Exibe na mesma tabela com badge "Manutencao"

5. **Tela de Estoque** - Modal `EnviarManutencaoModal`:
   - Permite agendar manutencao para rastreadores
   - Usa hook `useCriarManutencao`

6. **Hook `useSubstituirEquipamento`** - Ja implementado:
   - Desvincula rastreador antigo (status `manutencao`)
   - Vincula rastreador novo ao mesmo veiculo
   - Integra com APIs (Rede Veiculos, Softruck)

---

## O Que o PRD Adiciona (Incrementos)

### 1. Novos Sub-Status de Rastreador

O PRD pede granularidade no processo de manutencao:

| Status Atual | Proposta PRD |
|--------------|--------------|
| `manutencao` | `manutencao_pendente` + `manutencao_agendada` |

**Decisao de Integracao**: Em vez de quebrar o enum existente, vamos usar campos adicionais na tabela `servicos` para controlar o fluxo interno.

### 2. Campos Especificos de Manutencao

Adicionar colunas na tabela `servicos` para suportar o workflow do PRD:

```text
-- Novos campos para vistoria_manutencao
motivo_manutencao: text (sem_sinal, bateria_baixa, gps_incorreto, etc.)
motivo_detalhe: text
local_tipo_manutencao: text (base, ponto_instalacao, rota)
protecao_suspensa: boolean
data_suspensao: timestamptz
rastreador_substituto_id: uuid (FK rastreadores)
resultado_manutencao: text (resolvido, substituicao)
```

### 3. Tela Dedicada de Vistorias de Manutencao

Nova pagina em `/monitoramento/vistorias-manutencao` com:
- Cards de metricas (Pendentes, Agendadas, Em Andamento, Nao Compareceu)
- Filtros especializados (motivo, local_tipo, tecnico)
- Tabela com acoes contextuais

### 4. Modal de Resultado com Substituicao

Novo modal que permite:
- Cenario A: Problema resolvido (rastreador volta para `instalado`)
- Cenario B: Substituicao (rastreador antigo `baixado`, novo `instalado`)

---

## Arquitetura de Integracao

### Camada de Dados

```text
┌────────────────────────────────────────────────────────────────────┐
│                        TABELA: servicos                            │
├────────────────────────────────────────────────────────────────────┤
│ tipo = 'vistoria_manutencao'                                       │
│                                                                    │
│ Campos existentes:                                                 │
│ - id, protocolo, status, data_agendada, periodo                   │
│ - associado_id, veiculo_id, rastreador_id                         │
│ - profissional_id, observacoes                                    │
│                                                                    │
│ NOVOS campos (migracao):                                          │
│ - motivo_manutencao: text                                         │
│ - local_tipo_manutencao: text (base | ponto_instalacao | rota)    │
│ - protecao_suspensa: boolean                                      │
│ - data_suspensao: timestamptz                                     │
│ - rastreador_substituto_id: uuid                                  │
│ - resultado_manutencao: text (resolvido | substituicao)           │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    TABELA: rastreadores                            │
├────────────────────────────────────────────────────────────────────┤
│ Enum status_rastreador permanece:                                  │
│ - estoque, instalado, manutencao, baixado                         │
│                                                                    │
│ O estado "manutencao" e generico, o detalhamento                   │
│ (pendente/agendada) fica na tabela servicos.status                │
└────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Status Integrado

```text
RASTREADOR                         SERVICO
-----------                        -------
instalado ──────────────────────── (nao existe)
     │
     │ [Abrir Manutencao]
     ▼
manutencao ─────────────────────── status: pendente
     │                              (aguardando agendamento)
     │ [Agendar]
     │
manutencao ─────────────────────── status: agendada
     │                              (data/periodo/tecnico definidos)
     │ [Tecnico inicia]
     │
manutencao ─────────────────────── status: em_andamento
     │
     ├──── [Resolvido]
     │         ▼
     │     instalado ───────────── status: concluida
     │
     └──── [Substituicao]
               ▼
          baixado (antigo) ────── status: concluida
          instalado (novo)         rastreador_substituto_id = novo.id
```

---

## Arquivos a Criar

### Novos Componentes

| Arquivo | Descricao |
|---------|-----------|
| `src/types/vistoriaManutencao.ts` | Tipos e constantes especificos |
| `src/hooks/useVistoriaManutencao.ts` | Hooks para CRUD e metricas |
| `src/pages/monitoramento/VistoriasManutencao.tsx` | Pagina principal |
| `src/components/monitoramento/manutencao/ManutencaoMetricas.tsx` | Cards de resumo |
| `src/components/monitoramento/manutencao/ManutencaoFiltros.tsx` | Filtros especializados |
| `src/components/monitoramento/manutencao/ManutencaoTabela.tsx` | Tabela com acoes |
| `src/components/monitoramento/manutencao/AbrirManutencaoModal.tsx` | Modal para abrir nova |
| `src/components/monitoramento/manutencao/AgendarManutencaoModal.tsx` | Modal para agendar |
| `src/components/monitoramento/manutencao/RegistrarResultadoModal.tsx` | Modal com substituicao |
| `src/components/monitoramento/manutencao/index.ts` | Barrel exports |

### Migracao SQL

```text
supabase/migrations/xxx_vistoria_manutencao_campos.sql
- ALTER TABLE servicos ADD COLUMN motivo_manutencao text
- ALTER TABLE servicos ADD COLUMN local_tipo_manutencao text
- ALTER TABLE servicos ADD COLUMN protecao_suspensa boolean DEFAULT false
- ALTER TABLE servicos ADD COLUMN data_suspensao timestamptz
- ALTER TABLE servicos ADD COLUMN rastreador_substituto_id uuid REFERENCES rastreadores(id)
- ALTER TABLE servicos ADD COLUMN resultado_manutencao text
```

---

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/hooks/useCriarManutencao.ts` | Adicionar campo `motivo_manutencao` |
| `src/components/monitoramento/estoque/EnviarManutencaoModal.tsx` | Adicionar select de motivo |
| `src/components/monitoramento/estoque/EstoqueMetricas.tsx` | Manter como esta (usa enum) |
| `src/hooks/useServicos.ts` | Adicionar tipos para novos campos |
| `src/App.tsx` | Adicionar rota `/monitoramento/vistorias-manutencao` |
| `src/components/layout/Sidebar.tsx` | Adicionar item de menu |

---

## Regras de Negocio Preservadas

### 1. Quem Pode Abrir Manutencao

Atual: Qualquer usuario com acesso ao estoque pode clicar em "Manutenção"

PRD: Apenas Coordenador de Monitoramento e Diretor

**Implementacao**: Adicionar verificacao de permissao no `EnviarManutencaoModal` e no novo `AbrirManutencaoModal`

```typescript
const { isDiretor, isCoordenadorMonitoramento } = usePermissions();
const canOpenManutencao = isDiretor || isCoordenadorMonitoramento;
```

### 2. Rastreador Baixado = Terminal

Atual: `useSubstituirEquipamento` coloca antigo em `manutencao`

PRD: Antigo deve ir para `baixado` (irreversivel)

**Implementacao**: Modificar `RegistrarResultadoModal` para:
1. Rastreador antigo: status = `baixado`, veiculo_id = null
2. Rastreador novo: status = `instalado`, veiculo_id = veiculo original

### 3. Suspensao de Protecao (Tipo BASE)

Aplicar quando 48h excedidas sem comparecimento:
- `protecao_suspensa = true`
- `data_suspensao = NOW()`
- Status do servico = `nao_compareceu` (novo status a adicionar ou usar `cancelada`)

---

## Integracao com Sistema Existente

### Fila de Vistorias

A `FilaVistorias.tsx` ja busca servicos de `vistoria_manutencao`:

```typescript
const { data: servicosRaw } = useServicos({
  tipo: ['vistoria_manutencao', 'vistoria_retirada'],
  status: ['pendente', 'agendada', 'em_rota', 'em_andamento'],
});
```

**Nenhuma alteracao necessaria** - os novos registros aparecerao automaticamente.

### Tarefa do Profissional

O hook `useTarefaAtualServico` ja busca qualquer tipo de servico atribuido ao profissional. A `vistoria_manutencao` ja aparece para o tecnico.

**Adicao necessaria**: Tela de execucao especifica para manutencao com opcao de substituicao.

### Estoque de Rastreadores

O `useRastreadoresMetricas` ja conta rastreadores em `manutencao`:

```typescript
case 'manutencao':
  metricas.manutencao++;
  break;
```

**Nenhuma alteracao necessaria** - o status `manutencao` continua sendo usado.

---

## Ordem de Implementacao

### Fase 1: Infraestrutura
1. Migracao SQL para novos campos na tabela `servicos`
2. Tipos TypeScript em `vistoriaManutencao.ts`
3. Atualizar `useServicos.ts` com novos tipos

### Fase 2: Hook de Manutencao
4. Criar `useVistoriaManutencao.ts` com:
   - `useVistoriasManutencao(filters)` - Lista filtrada
   - `useVistoriasManutencaoMetricas()` - Contagens
   - `useAbrirVistoriaManutencao()` - Mutation
   - `useAgendarVistoriaManutencao()` - Mutation
   - `useRegistrarResultadoManutencao()` - Mutation com substituicao

### Fase 3: Pagina Principal
5. Criar `VistoriasManutencao.tsx`
6. Criar componentes de metricas e filtros
7. Criar tabela com acoes

### Fase 4: Modais
8. Atualizar `EnviarManutencaoModal` com campo de motivo
9. Criar `AbrirManutencaoModal` (para abrir sem agendar)
10. Criar `AgendarManutencaoModal` (para agendar pendentes)
11. Criar `RegistrarResultadoModal` (com logica de substituicao)

### Fase 5: Integracao Final
12. Adicionar rota no `App.tsx`
13. Adicionar item no menu lateral
14. Adicionar verificacao de permissoes

---

## Detalhes Tecnicos

### Tipos TypeScript

```typescript
// src/types/vistoriaManutencao.ts

export type MotivoManutencao = 
  | 'sem_sinal'
  | 'bateria_baixa'
  | 'gps_incorreto'
  | 'alarme_desconexao'
  | 'verificacao_periodica'
  | 'suspeita_violacao'
  | 'outro';

export type LocalTipoManutencao = 'base' | 'ponto_instalacao' | 'rota';

export type ResultadoManutencao = 'resolvido' | 'substituicao';

export const MOTIVO_LABELS: Record<MotivoManutencao, string> = {
  sem_sinal: 'Sem sinal',
  bateria_baixa: 'Bateria baixa',
  gps_incorreto: 'GPS incorreto',
  alarme_desconexao: 'Alarme de desconexao',
  verificacao_periodica: 'Verificacao periodica',
  suspeita_violacao: 'Suspeita de violacao',
  outro: 'Outro',
};

export const LOCAL_TIPO_LABELS: Record<LocalTipoManutencao, string> = {
  base: 'Base (associado vem ate a base)',
  ponto_instalacao: 'Ponto de Instalacao',
  rota: 'Rota (tecnico vai ate o associado)',
};
```

### Logica de Substituicao

```typescript
// Dentro de useRegistrarResultadoManutencao

async function registrarSubstituicao(params: {
  servicoId: string;
  rastreadorAntigoId: string;
  rastreadorNovoId: string;
  descricao: string;
}) {
  // 1. Buscar veiculo do rastreador antigo
  const { data: antigoData } = await supabase
    .from('rastreadores')
    .select('veiculo_id, plataforma, imei')
    .eq('id', params.rastreadorAntigoId)
    .single();

  const veiculoId = antigoData?.veiculo_id;

  // 2. Desvincular antigo na plataforma (se aplicavel)
  // ... (reutilizar logica de useSubstituirEquipamento)

  // 3. Atualizar rastreador ANTIGO -> BAIXADO
  await supabase
    .from('rastreadores')
    .update({ 
      status: 'baixado', 
      veiculo_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.rastreadorAntigoId);

  // 4. Vincular novo na plataforma (se aplicavel)
  // ... (reutilizar logica de useSubstituirEquipamento)

  // 5. Atualizar rastreador NOVO -> INSTALADO
  await supabase
    .from('rastreadores')
    .update({ 
      status: 'instalado', 
      veiculo_id: veiculoId,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.rastreadorNovoId);

  // 6. Atualizar servico
  await supabase
    .from('servicos')
    .update({
      status: 'concluida',
      concluida_em: new Date().toISOString(),
      rastreador_substituto_id: params.rastreadorNovoId,
      resultado_manutencao: 'substituicao',
      observacoes_analise: params.descricao,
    })
    .eq('id', params.servicoId);

  // 7. Registrar movimentacoes de estoque
  await supabase.from('estoque_movimentacoes').insert([
    {
      tipo: 'baixa_substituicao',
      rastreador_id: params.rastreadorAntigoId,
      status_anterior: 'manutencao',
      status_novo: 'baixado',
      observacoes: 'Baixado por substituicao em manutencao',
    },
    {
      tipo: 'instalacao_substituicao',
      rastreador_id: params.rastreadorNovoId,
      status_anterior: 'estoque',
      status_novo: 'instalado',
      veiculo_id: veiculoId,
      observacoes: 'Instalado em substituicao ao rastreador baixado',
    },
  ]);
}
```

---

## Permissoes por Perfil

| Acao | Diretor | Coord. Monitoramento | Tecnico |
|------|---------|---------------------|---------|
| Abrir manutencao | Sim | Sim | Nao |
| Agendar | Sim | Sim | Nao |
| Registrar resultado | Sim | Sim | Sim (suas) |
| Suspender protecao | Sim | Sim | Nao |
| Cancelar | Sim | Sim | Nao |

---

## Validacoes Criticas

### Rastreador Baixado = Bloqueado

Em todas as telas de selecao de rastreador, filtrar:

```typescript
const rastreadoresDisponiveis = rastreadores.filter(r => 
  r.status === 'estoque' // Apenas estoque
  // NUNCA: baixado, instalado, manutencao
);
```

### Substituicao Requer Novo Rastreador

```typescript
if (resultado === 'substituicao' && !novoRastreadorId) {
  throw new Error('Selecione o rastreador substituto');
}
```

### Local Tipo BASE Permite Suspensao

A opcao de "Marcar nao compareceu" so aparece se `local_tipo_manutencao === 'base'`

---

## Resultado Esperado

1. **Nova pagina** em `/monitoramento/vistorias-manutencao` com gestao completa
2. **Integracao total** com sistema existente (servicos, fila, tarefas)
3. **Workflow de substituicao** que coloca rastreador antigo em `baixado`
4. **Preservacao** de todo o codigo existente (sem breaking changes)
5. **Permissoes** restritas para abertura de manutencao
