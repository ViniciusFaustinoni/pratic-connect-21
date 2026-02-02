
# Análise Completa: Fluxos de Ativação Softruck e SGA Hinova

## 1. Fluxo de Ativação de Rastreadores Softruck

### 1.1 Visão Geral do Fluxo Atual

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO ATIVAÇÃO SOFTRUCK                                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  [ENTRADA]                                                                           │
│     │                                                                                │
│     ├── PropostasPendentes.tsx → handleAtivarRastreador()                           │
│     ├── useVistoriaCompletaAnalise.ts → useAtivarRastreadorPlataforma()             │
│     ├── useServicos.ts → useAprovarVeiculoServico()                                 │
│     ├── useSubstituirEquipamento.ts                                                  │
│     └── useAtivarRastreador.ts                                                       │
│                      │                                                               │
│                      ▼                                                               │
│       ┌──────────────────────────────────────────┐                                  │
│       │  softruck-ativar-dispositivo (Edge Fn)   │                                  │
│       │  ─────────────────────────────────────── │                                  │
│       │  1. Busca rastreador por IMEI            │                                  │
│       │  2. Busca veículo local                  │                                  │
│       │  3. Cria/busca veículo na Softruck       │                                  │
│       │  4. Cria/busca chip na Softruck          │                                  │
│       │  5. Cria/busca device na Softruck        │                                  │
│       │  6. Associa device ao veículo            │                                  │
│       │  7. Ativa device na Softruck             │                                  │
│       │  8. Ativa veículo na Softruck            │                                  │
│       │  9. Polling para primeira posição GPS    │                                  │
│       │  10. Atualiza rastreador local           │                                  │
│       │  11. Atualiza associado.status = 'ativo' │ ← PROBLEMA A                     │
│       │  12. Atualiza veículo.cobertura_total    │ ← PROBLEMA B                     │
│       │  13. Chama ativar-associado              │ ← PROBLEMA C                     │
│       └──────────────────────────────────────────┘                                  │
│                      │                                                               │
│                      ▼                                                               │
│       ┌──────────────────────────────────────────┐                                  │
│       │  ativar-associado (Edge Fn)              │                                  │
│       │  ─────────────────────────────────────── │                                  │
│       │  - Cria usuário Auth (se não existir)    │                                  │
│       │  - Senha: Pratic@ + 4 últimos CPF        │                                  │
│       │  - Envia email + WhatsApp                │                                  │
│       │  - Role: associado                       │                                  │
│       └──────────────────────────────────────────┘                                  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Problemas Identificados no Fluxo Softruck

#### ⚠️ PROBLEMA A: Ativação Duplicada do Associado

**Arquivo:** `softruck-ativar-dispositivo/index.ts` (linhas 593-609)

A edge function atualiza `associados.status = 'ativo'` E depois chama `ativar-associado`. Isso causa:
- Atualização redundante do status
- Se `ativar-associado` falhar, o associado fica "ativo" sem acesso ao app

**Fluxo duplicado em:**
- `useVistoriaCompletaAnalise.ts` (linhas 185-195) - também atualiza `associados.status = 'ativo'`
- `useVistoriaCompleta.ts` (linhas 46-56) - também atualiza `associados.status = 'ativo'`

#### ⚠️ PROBLEMA B: Liberação de Cobertura Total Inconsistente

**Arquivo:** `softruck-ativar-dispositivo/index.ts` (linhas 611-626)

A edge function define `veiculos.cobertura_total = true`, porém:
- `useVistoriaCompletaAnalise.ts` (linhas 173-181) faz a mesma coisa
- `useVistoriaCompleta.ts` (linha 39) também define `cobertura_total = true`
- `useServicos.ts` NÃO atualiza explicitamente a cobertura

**Resultado:** Dependendo do ponto de entrada, a cobertura pode ou não ser liberada.

#### ⚠️ PROBLEMA C: Chamada HTTP Direta para Edge Function

**Arquivo:** `softruck-ativar-dispositivo/index.ts` (linhas 631-643)

```typescript
const ativarAssociadoResponse = await fetch(`${supabaseUrl}/functions/v1/ativar-associado`, {
  headers: { 'Authorization': `Bearer ${supabaseAnonKey}` },
  ...
});
```

Isso usa a chave anônima ao invés da service key. Se `ativar-associado` verificar JWT, pode falhar.

#### ⚠️ PROBLEMA D: Verificação de Status de Rastreador Incompleta

**Arquivo:** `softruck-ativar-dispositivo/index.ts` (linhas 176-182)

```typescript
// Aceitar status 'estoque' (novo) ou 'instalado' (já vinculado localmente)
if (rastreador.status !== 'estoque' && rastreador.status !== 'instalado') {
  throw new Error(`Rastreador ${imei} não está disponível`);
}
```

**Problema:** Não verifica se o rastreador já tem `plataforma_device_id` preenchido (já ativado na Softruck), podendo causar duplicidade de registros na plataforma externa.

#### ⚠️ PROBLEMA E: Pontos de Entrada Múltiplos Sem Centralização

Há pelo menos 5 pontos de entrada diferentes que chamam `softruck-ativar-dispositivo`:

| Arquivo | Contexto |
|---------|----------|
| `PropostasPendentes.tsx` | Botão manual de ativação |
| `useVistoriaCompletaAnalise.ts` | Após análise de vistoria |
| `useServicos.ts` | Ao aprovar veículo em serviço |
| `useSubstituirEquipamento.ts` | Ao substituir rastreador |
| `useAtivarRastreador.ts` | Hook genérico |

Cada um faz pós-processamento diferente (ou nenhum), causando inconsistências.

---

## 2. Fluxo de Sincronização SGA Hinova

### 2.1 Visão Geral do Fluxo Atual

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO SINCRONIZAÇÃO SGA                                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  [GATILHO AUTOMÁTICO]                                                               │
│     │                                                                                │
│     └── usePropostasPendentes.ts → useAprovarProposta() (linha 1573)                │
│              │                                                                       │
│              │  NOTA: Executa em background, NÃO bloqueia aprovação                 │
│              │                                                                       │
│  [GATILHOS MANUAIS]                                                                 │
│     │                                                                                │
│     ├── BotaoEnviarSGA.tsx                                                          │
│     ├── BotaoAtivarSGA.tsx                                                          │
│     └── useSGASync.ts                                                               │
│              │                                                                       │
│              ▼                                                                       │
│       ┌──────────────────────────────────────────┐                                  │
│       │  sga-hinova-sync (Edge Fn)               │                                  │
│       │  ─────────────────────────────────────── │                                  │
│       │  1. Autenticar na API Hinova             │                                  │
│       │  2. Buscar dados do associado local      │                                  │
│       │  3. Buscar dados do veículo local        │                                  │
│       │  4. Cadastrar associado no Hinova        │ ← PROBLEMA F                     │
│       │     └─ Trata CPF duplicado (erro 406)    │                                  │
│       │  5. Cadastrar veículo no Hinova          │ ← PROBLEMA G                     │
│       │  6. Enviar fotos/documentos              │                                  │
│       │  7. Atualizar status_sga = 'ativado_sga' │                                  │
│       └──────────────────────────────────────────┘                                  │
│                                                                                      │
│  CAMPOS ATUALIZADOS:                                                                │
│    - veiculos.sincronizado_hinova = true                                            │
│    - veiculos.sincronizado_hinova_em = timestamp                                    │
│    - veiculos.codigo_hinova = código                                                │
│    - veiculos.status_sga = 'ativado_sga'                                            │
│    - associados.codigo_hinova = código                                              │
│    - associados.sincronizado_hinova = true                                          │
│    - associados.sincronizado_hinova_em = timestamp                                  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Problemas Identificados no Fluxo SGA

#### ⚠️ PROBLEMA F: Validação de Campos Obrigatórios Ausente

**Arquivo:** `sga-hinova-sync/index.ts` (linhas 612-630)

O payload do veículo é enviado sem validar se RENAVAM e CHASSI estão preenchidos:

```typescript
const veiculoPayload = {
  renavam: veiculo.renavam || '',  // Pode ir vazio!
  chassi: veiculo.chassi || '',    // Pode ir vazio!
  ...
};
```

Conforme a memória do projeto: "A sincronização exige obrigatoriamente RENAVAM e CHASSI preenchidos."

**Consequência:** O cadastro do veículo falha silenciosamente ou retorna erro genérico.

#### ⚠️ PROBLEMA G: Erro de Veículo Duplicado Não Tratado

**Arquivo:** `sga-hinova-sync/index.ts` (linhas 646-657)

Se o veículo já existir no Hinova (placa duplicada), o fluxo retorna erro sem tentar buscar o código existente (diferentemente do tratamento de CPF duplicado do associado).

```typescript
if (!veiculoResponse.ok) {
  // NÃO tenta buscar veículo existente por placa
  return new Response(JSON.stringify({ 
    success: false, 
    error: `Falha ao cadastrar veículo: ${veiculoData.mensagem}`,
    ...
  }));
}
```

#### ⚠️ PROBLEMA H: Execução em Background Sem Feedback

**Arquivo:** `usePropostasPendentes.ts` (linhas 1561-1590)

O envio automático para SGA é feito em background e falhas são apenas logadas:

```typescript
if (sgaError) {
  console.warn('[useAprovarProposta] Erro no envio SGA (não crítico):', sgaError);
}
```

O usuário não recebe feedback visual se a sincronização falhou.

#### ⚠️ PROBLEMA I: Status Intermediário "Sincronizando" Pode Ficar Travado

**Arquivo:** `sga-hinova-sync/index.ts` (linhas 300-304)

```typescript
await supabase
  .from('veiculos')
  .update({ status_sga: 'sincronizando' })
  .eq('id', veiculo_id);
```

Se a função falhar antes de atualizar para `'ativado_sga'` ou `'erro_sincronizacao'`, o veículo fica travado em `'sincronizando'`.

---

## 3. Tabela Comparativa: Quem Ativa O Quê

| Componente/Hook | Ativa Associado? | Libera Cobertura Total? | Chama Softruck? | Chama SGA? |
|-----------------|------------------|-------------------------|-----------------|------------|
| `usePropostasPendentes` (aprovar) | Não (fica pendente_vistoria) | Não | Não | ✅ Background |
| `softruck-ativar-dispositivo` | ✅ (linha 598) | ✅ (linha 617) | N/A | Não |
| `useVistoriaCompletaAnalise` | ✅ (linha 189) | ✅ (linha 177) | ✅ | Não |
| `useVistoriaCompleta` | ✅ (linha 50) | ✅ (linha 39) | Não | Não |
| `useServicos` (aprovar) | Não (linha 989) | Não diretamente | ✅ | Não |
| `ativar-associado` | Cria user Auth | Não | Não | Não |

---

## 4. Fluxo Esperado vs. Fluxo Atual

### 4.1 Fluxo Esperado (Correto)

```text
1. Analista aprova proposta
   ├── Status: pendente_vistoria
   ├── Cobertura: roubo_furto = true
   └── SGA: Envia para Hinova (background)

2. Instalador executa vistoria + instalação
   ├── Registra fotos, vídeo, hodômetro
   └── Status instalação: concluída

3. Analista/Sistema ativa rastreador
   ├── Softruck: Cria/vincula device + veiculo
   ├── Cobertura: total = true
   ├── Status veículo: ativo
   └── Status associado: ativo

4. Sistema cria acesso do cliente
   ├── Cria user Auth com senha padrão
   ├── Envia email + WhatsApp
   └── Profile: primeiro_acesso = true
```

### 4.2 Problemas no Fluxo Atual

1. **Ativação duplicada:** A edge function `softruck-ativar-dispositivo` faz etapas 3 E 4, mas os hooks no frontend também fazem parte da etapa 3.

2. **Inconsistência de cobertura:** Se `softruck-ativar-dispositivo` falhar após atualizar `associados.status = 'ativo'` mas antes de chamar `ativar-associado`, o cliente fica ativo sem acesso.

3. **SGA desacoplado:** O envio para SGA ocorre na aprovação (etapa 1), não na ativação (etapa 3). Isso está correto, mas não há retry automático se falhar.

---

## 5. Correções Recomendadas

### 5.1 Centralizar Lógica de Ativação

Criar um único ponto de entrada para ativação que coordene:
- Ativação na plataforma (Softruck/Rede Veículos)
- Atualização de status do rastreador, veículo e associado
- Criação de acesso do cliente

### 5.2 Validar Campos Obrigatórios no SGA

Adicionar validação antes de enviar para Hinova:
```typescript
if (!veiculo.renavam || !veiculo.chassi) {
  throw new Error('RENAVAM e CHASSI são obrigatórios para sincronização com SGA');
}
```

### 5.3 Tratar Veículo Duplicado no SGA

Implementar busca por placa similar ao tratamento de CPF duplicado.

### 5.4 Evitar Duplicidade na Edge Function

Não atualizar `associados.status` dentro de `softruck-ativar-dispositivo`. Deixar essa responsabilidade para quem chamou.

### 5.5 Timeout para Status "Sincronizando"

Adicionar lógica para resetar status travados após X minutos.

---

## 6. Arquivos Afetados

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `supabase/functions/softruck-ativar-dispositivo/index.ts` | Remover ativação duplicada, melhorar validações |
| `supabase/functions/sga-hinova-sync/index.ts` | Validar RENAVAM/CHASSI, tratar placa duplicada |
| `src/hooks/useVistoriaCompletaAnalise.ts` | Remover atualização redundante de status |
| `src/hooks/useVistoriaCompleta.ts` | Remover atualização redundante de status |
| `src/hooks/useAtivarRastreador.ts` | Centralizar lógica pós-ativação |

---

## Próximos Passos

Deseja que eu implemente as correções identificadas? Posso:
1. Corrigir as validações no fluxo SGA
2. Remover duplicidades no fluxo Softruck
3. Adicionar tratamento de erros mais robusto
4. Criar um fluxo unificado de ativação
