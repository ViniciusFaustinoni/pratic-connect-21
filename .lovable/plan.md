
# Plano: Unificação do Fluxo de Manutenção no Menu Rastreadores

## Situação Atual

Existem **múltiplos pontos de entrada fragmentados** para iniciar manutenções:

| Local | Modal/Hook | Status criado |
|-------|------------|---------------|
| Menu **Rastreadores** | `AbrirManutencaoModal` + `useAbrirVistoriaManutencao` | `pendente` (sem data) |
| Menu **Estoque** (antigo) | ~~Removido na última correção~~ | - |
| Menu **Vistorias de Manutenção** | `AbrirManutencaoModal` (botão "Nova Manutenção") | `pendente` (sem data) |
| `EnviarManutencaoModal` (não usado ativamente) | `useCriarManutencao` | `pendente` com data/período |

O fluxo atual obriga o coordenador a usar **duas etapas**: primeiro abrir a manutenção (AbrirManutencaoModal) e depois agendar (AgendarManutencaoModal na tela VistoriasManutencao). Isso não está errado, mas é fragmentado.

## Solução Proposta

Unificar tudo em um **único modal no menu Rastreadores** que faz abertura + agendamento numa só operação, conforme solicitado.

---

## Arquivos a Criar

### 1. `src/components/monitoramento/rastreadores/AgendarManutencaoUnificadoModal.tsx`

Modal unificado que combina:
- Campos de `AbrirManutencaoModal` (motivo, detalhes)
- Campos de `AgendarManutencaoModal` (data, período, local, técnico, encaixe, WhatsApp)
- Exibe dados do rastreador, veículo e associado

Ao confirmar, executa tudo numa única operação criando o serviço já com `status: 'agendada'`.

---

## Arquivos a Modificar

### 2. `src/hooks/useVistoriaManutencao.ts`

Adicionar novo hook **`useAbrirEAgendarManutencao`** que:

```typescript
interface AbrirEAgendarManutencaoParams {
  rastreadorId: string;
  motivo: MotivoManutencao;
  motivoDetalhe?: string;
  dataAgendada: string;
  periodo: 'manha' | 'tarde';
  localTipo: 'base' | 'rota';
  localEndereco?: string;
  profissionalId: string;
  permiteEncaixe: boolean;
  notificarWhatsApp: boolean;
}
```

Executa:
1. Busca dados do rastreador (veículo, associado)
2. Atualiza rastreador: `instalado` → `manutencao`
3. Registra movimentação em `estoque_movimentacoes`
4. Cria serviço com `status: 'agendada'` (não `pendente`)
5. Notifica WhatsApp se habilitado

---

### 3. `src/pages/monitoramento/Rastreadores.tsx`

**Modificar:**
- Substituir `AbrirManutencaoModal` por `AgendarManutencaoUnificadoModal`
- Ajustar estado `dialogManutencao` para incluir dados do veículo/associado
- Manter opção apenas para rastreadores com `status === 'instalado'`
- Alterar texto do dropdown de "Abrir Manutenção" para "Enviar para Manutenção"

---

### 4. `src/pages/monitoramento/VistoriasManutencao.tsx`

**Remover:**
- Botão "Nova Manutenção" do header (linhas 114-119)
- Modal `AbrirManutencaoModal` e seu estado `modalAbrir`
- Imports relacionados

Esta página passa a ser **apenas para gestão** de manutenções já criadas.

---

## Fluxo Final

```text
MENU RASTREADORES (único ponto de entrada)
         │
         │ Coordenador clica "Enviar para Manutenção"
         │ em rastreador com status 'instalado'
         ▼
┌──────────────────────────────────────────────────────────┐
│ MODAL UNIFICADO "Agendar Manutenção"                     │
├──────────────────────────────────────────────────────────┤
│ INFORMAÇÕES (auto-preenchidas)                           │
│ • Rastreador: RST-001234                                 │
│ • Associado: João da Silva                               │
│ • Veículo: VW Gol 2020 • ABC-1234                        │
│ • Última comunicação: 03/02/2026 14:32                   │
│                                                          │
│ MOTIVO                                                   │
│ [Selecione: sem_sinal / bateria_baixa / etc.]           │
│ Detalhes: [___________________________________]          │
│                                                          │
│ AGENDAMENTO                                              │
│ Data*: [📅 calendário - hoje até +2 dias]               │
│ Período*: (○) Manhã  (○) Tarde                          │
│ Local*: (○) Base  (○) Rota                              │
│   └ Se Rota: [Endereço cadastrado ou informar outro]    │
│ Técnico*: [Selecione profissional]                       │
│                                                          │
│ ☑ Notificar via WhatsApp                                │
│ ☑ Permitir encaixe (só coord/diretor)                   │
│                                                          │
│ [Cancelar]  [Agendar Manutenção]                        │
└──────────────────────────────────────────────────────────┘
         │
         │ Ao confirmar:
         │ 1. rastreador.status → 'manutencao'
         │ 2. estoque_movimentacoes.insert()
         │ 3. servicos.insert({ status: 'agendada' })
         ▼
┌──────────────────────────────────────────────────────────┐
│ FILA DE VISTORIAS / VISTORIAS DE MANUTENÇÃO              │
│ • Manutenção aparece já agendada                         │
│ • Técnico designado pode ver na sua fila                │
│ • Coordenador pode gerenciar (cancelar, reagendar, etc.)│
└──────────────────────────────────────────────────────────┘
         │
         ▼
   TÉCNICO EXECUTA NO CAMPO
   (ExecutarManutencao.tsx - sem alteração)
```

---

## Permissões

O botão "Enviar para Manutenção" será visível apenas para:
- **Diretor** (`isDiretor`)
- **Coordenador de Monitoramento** (`isCoordenadorMonitoramento`)

A checkbox "Permitir encaixe" também segue esta regra.

---

## Resumo das Alterações

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/monitoramento/rastreadores/AgendarManutencaoUnificadoModal.tsx` | **CRIAR** | Modal unificado com motivo + agendamento |
| `src/hooks/useVistoriaManutencao.ts` | **ADICIONAR** | Hook `useAbrirEAgendarManutencao` |
| `src/pages/monitoramento/Rastreadores.tsx` | **MODIFICAR** | Usar novo modal, ajustar dropdown e permissões |
| `src/pages/monitoramento/VistoriasManutencao.tsx` | **MODIFICAR** | Remover botão "Nova Manutenção" e modal |

---

## O que NÃO será alterado

- `ExecutarManutencao.tsx` - Fluxo do técnico em campo
- `ManutencaoInterna.tsx` - Bancada/triagem
- Hooks de gestão existentes (`useAgendarVistoriaManutencao`, `useCancelarVistoriaManutencao`, etc.) - Continuam funcionando para reagendamentos
- `AgendarManutencaoModal.tsx` - Será mantido para reagendamentos pós-ausência
- `AbrirManutencaoModal.tsx` - Pode ser mantido ou deprecado (não mais usado após esta alteração)

---

## Detalhes Técnicos

### Estrutura do novo modal

O modal será composto por:

1. **Seção de informações** (somente leitura)
   - Dados do rastreador vindos do dropdown
   - Busca dados do veículo e associado via query

2. **Seção de motivo** (reaproveitando lógica do AbrirManutencaoModal)
   - Select com `MOTIVOS_MANUTENCAO_OPTIONS`
   - Campo de texto para detalhes

3. **Seção de agendamento** (reaproveitando lógica do AgendarManutencaoModal)
   - Calendário (hoje até +2 dias, sem domingo)
   - Botões de período com vagas (usa `useVagasPeriodo`)
   - Radio de local (Base/Rota)
   - Se Rota: seletor de endereço (cadastrado ou informar)
   - Select de técnico (usa `useProfissionaisEquipe`)
   - Checkbox notificar WhatsApp
   - Checkbox encaixe (apenas para coord/diretor)

### Dependências reutilizadas

- `useVagasPeriodo` - Verificar vagas disponíveis
- `useProfissionaisEquipe` - Listar técnicos
- `usePermissions` - Verificar permissões
- `buscarCep` - Autocomplete de endereço
- `PERIODOS_DISPONIVEIS`, `getPeriodosDisponivelsPorHora` - Configuração de períodos
