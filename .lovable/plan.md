
# Plano: Corrigir Lógica de Identificação Autovistoria vs Vistoria Presencial

## Diagnóstico do Problema

A tela de análise cadastral (`PropostaAnalise.tsx`) está identificando incorretamente **todas as propostas com fotos** como autovistoria, quando deveria distinguir entre:

| Cenário | Quem tira fotos | tipo_vistoria | modalidade | Aprovação Analista |
|---------|-----------------|---------------|------------|-------------------|
| Autovistoria | **Cliente** | `autovistoria` | `autovistoria` | Roubo/Furto apenas |
| Vistoria Presencial | **Vistoriador** | `agendada` | `presencial` | Cobertura Total |
| Vistoria na Base | **Vistoriador** | `agendada_base` | `presencial` | Cobertura Total |

### Código Problemático

**Arquivo:** `src/pages/cadastro/PropostaAnalise.tsx` (linhas 626 e 777)

```typescript
// LÓGICA ATUAL (INCORRETA)
const isAutovistoria = proposta.vistoria?.fotos?.length > 0 && !proposta.instalacao_info;
```

Esta lógica falha porque:
- Vistoria presencial também tem fotos (tiradas pelo vistoriador)
- Vistoria na base também tem fotos
- O único critério confiável é o campo `modalidade`

## Fluxos Detalhados (Conforme Especificação)

### 1. AUTOVISTORIA SELECIONADA

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente tira    │────►│ Paga e agenda   │────►│ Analista aprova │
│ fotos (auto)    │     │ vistoria completa    │ Roubo/Furto     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
            ┌────────────────────────────────────────────┘
            ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Atribuição      │────►│ Vistoriador     │────►│ Cobertura Total │
│ automática      │     │ aprova          │     │ ATIVADA ✅      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Cenário alternativo:** Se vistoriador aprovar ANTES do analista:
- Proposta fica "Pendente de Análise Cadastral"
- Analista aprova → Cobertura Total ativada

### 2. AGENDAMENTO (SEM AUTOVISTORIA)

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente agenda  │────►│ Atribuição      │────►│ Vistoriador     │
│ vistoria        │     │ automática      │     │ realiza e aprova│
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
            ┌────────────────────────────────────────────┘
            ▼
┌─────────────────┐     ┌─────────────────┐
│ Pendente de     │────►│ Analista aprova │
│ Análise Cadastral     │ Cobertura Total │
└─────────────────┘     └─────────────────┘
```

### 3. VISTORIA NA BASE

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente seleciona    │ Cliente leva    │────►│ Vistoriador da  │
│ horário na base │────►│ carro na data   │     │ base realiza    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
            ┌────────────────────────────────────────────┘
            ▼
┌─────────────────┐     ┌─────────────────┐
│ Pendente de     │────►│ Analista aprova │
│ Análise Cadastral     │ Cobertura Total │
└─────────────────┘     └─────────────────┘
```

### Status do Associado

| Situação | Status |
|----------|--------|
| Nenhuma aprovação | `pendente_vistoria` |
| Analista aprovou autovistoria (aguarda vistoriador) | `em_analise` + `cobertura_roubo_furto=true` |
| Vistoriador aprovou (aguarda analista) | `em_analise` |
| Ambos aprovaram | `ativo` + `cobertura_total=true` |
| Qualquer um recusou | `recusado` |

## Implementação

### 1. Corrigir Identificação de Autovistoria na Tela de Análise

**Arquivo:** `src/pages/cadastro/PropostaAnalise.tsx`

Substituir a lógica em 2 locais (linhas ~626 e ~777):

```typescript
// LÓGICA CORRIGIDA
// Autovistoria = modalidade é 'autovistoria' E ainda não tem instalação concluída
const isAutovistoria = (
  proposta.vistoria?.modalidade === 'autovistoria' ||
  proposta.vistoria?.tipo === 'autovistoria'
) && !proposta.instalacao_info;
```

### 2. Garantir Campo `modalidade` Disponível no Hook

**Arquivo:** `src/hooks/usePropostasPendentes.ts`

Verificar que a busca em `vistorias` (linha 271-276) já inclui `modalidade`:

```typescript
const { data: vistoriaData } = await supabase
  .from('vistorias')
  .select('id, status, modalidade')  // ✅ Já inclui modalidade
  .eq('contrato_id', contrato.id)
  ...
```

E que está sendo propagado corretamente para a interface `VistoriaInfo`:

```typescript
vistoria = {
  id: vistoriaData.id,
  status: vistoriaData.status || 'pendente',
  tipo: vistoriaData.modalidade === 'autovistoria' ? 'autovistoria' : 'agendada',
  modalidade: vistoriaData.modalidade || undefined,  // ✅ Já propaga
  fotos: fotosVistoria as VistoriaFotoInfo[],
};
```

### 3. Adicionar Fallback para Cotações Sem Registro em `vistorias`

Quando não existe registro na tabela `vistorias` mas existe em `cotacoes_vistoria_fotos` (legado), buscar o `tipo_vistoria` da cotação para determinar corretamente:

**Arquivo:** `src/hooks/usePropostasPendentes.ts` (após linha ~297)

```typescript
// 3. Fallback adicional: buscar tipo_vistoria da cotação quando não tem vistoria nem fotos legadas
if (!vistoria && contrato.cotacao_id) {
  const { data: cotacao } = await supabase
    .from('cotacoes')
    .select('tipo_vistoria')
    .eq('id', contrato.cotacao_id)
    .maybeSingle();
  
  // Se cotação indica tipo de vistoria, usar para determinar modalidade
  if (cotacao?.tipo_vistoria) {
    // tipo_vistoria = 'autovistoria' | 'agendada' | 'agendada_base'
    const isAuto = cotacao.tipo_vistoria === 'autovistoria';
    // Nota: Mesmo sem fotos, podemos saber a modalidade esperada
  }
}
```

### 4. Atualizar Texto do Botão de Aprovação

**Arquivo:** `src/pages/cadastro/PropostaAnalise.tsx`

O texto do botão deve refletir o cenário corretamente:

| Cenário | Botão | Descrição no Dialog |
|---------|-------|---------------------|
| Autovistoria sem instalação | "Aprovar Cobertura de Roubo e Furto" | Libera apenas roubo/furto, aguarda instalação |
| Vistoria presencial/base sem instalação | "Aprovar Proposta" | Aguarda instalação para cobertura total |
| Qualquer com instalação concluída | "Ativar Cobertura Total" | Ativa cobertura completa |

### 5. Adicionar Verificação de Vistoria na Base

**Arquivo:** `src/pages/cadastro/PropostaAnalise.tsx`

Quando `vistoria_base_info` existe, considerar como vistoria presencial (não autovistoria):

```typescript
const isVistoriaBase = !!proposta.vistoria_base_info;
const isAutovistoria = (
  proposta.vistoria?.modalidade === 'autovistoria' ||
  proposta.vistoria?.tipo === 'autovistoria'
) && !proposta.instalacao_info && !isVistoriaBase;
```

## Alterações de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/cadastro/PropostaAnalise.tsx` | Corrigir lógica `isAutovistoria` em 2 locais (linhas ~626 e ~777), adicionar verificação de vistoria base |
| `src/hooks/usePropostasPendentes.ts` | Adicionar fallback para buscar `tipo_vistoria` da cotação quando necessário |

## Seção Técnica - Detalhes de Implementação

### Lógica Final para `isAutovistoria`

```typescript
// Em PropostaAnalise.tsx - substituir em ambos os locais

// Vistoria na base NÃO é autovistoria (mesmo que tenha fotos)
const isVistoriaBase = !!proposta.vistoria_base_info;

// Autovistoria = modalidade explícita 'autovistoria' E ainda não tem instalação concluída
// E não é vistoria na base
const isAutovistoria = (
  proposta.vistoria?.modalidade === 'autovistoria' ||
  proposta.vistoria?.tipo === 'autovistoria'
) && !proposta.instalacao_info && !isVistoriaBase;

// Determinar texto do botão
const textoAprovar = isAutovistoria 
  ? 'Aprovar Cobertura de Roubo e Furto'
  : proposta.instalacao_info
    ? 'Ativar Cobertura Total'
    : 'Aprovar Proposta';
```

### Fallback no Hook (quando necessário)

```typescript
// Em usePropostasPendentes.ts - adicionar após busca de fotos legadas (linha ~313)

// 3. Se ainda não tem vistoria e tem cotacao_id, verificar tipo_vistoria
if (!vistoria && contrato.cotacao_id) {
  // Já temos a cotação buscada acima com tipo_vistoria, usar esse dado
  // Para determinar se espera-se autovistoria ou presencial
}
```

## Resultado Esperado

### Antes (Bug)

| Cliente fez | Sistema identifica | Botão mostrado |
|-------------|-------------------|----------------|
| Autovistoria | Autovistoria ✅ | Roubo/Furto ✅ |
| Vistoria Presencial | **Autovistoria** ❌ | **Roubo/Furto** ❌ |
| Vistoria na Base | **Autovistoria** ❌ | **Roubo/Furto** ❌ |

### Depois (Corrigido)

| Cliente fez | Sistema identifica | Botão mostrado |
|-------------|-------------------|----------------|
| Autovistoria | Autovistoria ✅ | Roubo/Furto ✅ |
| Vistoria Presencial | Presencial ✅ | Aprovar Proposta ✅ |
| Vistoria na Base | Presencial ✅ | Aprovar Proposta ✅ |
