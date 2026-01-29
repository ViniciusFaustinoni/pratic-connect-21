

# Revisão Completa - Fluxo de Acionamento de Roubo/Furto na Rede Veículos

## Resumo Executivo

Após análise detalhada do sistema, identifiquei que **o fluxo de acionamento de roubo/furto na Rede Veículos NÃO está implementado**. A plataforma está configurada no banco de dados com `suporta_acionamento_roubo: true`, porém não existe nenhuma edge function ou lógica que faça a chamada ao endpoint `POST /acionamentoRouboFurto` da API Rede Veículos.

---

## Status Atual

| Item | Status | Detalhes |
|------|--------|----------|
| Plataforma configurada no banco | OK | `rede_veiculos` com `suporta_acionamento_roubo: true` |
| Token Bearer configurado | OK | `REDE_VEICULOS_TOKEN` nos secrets |
| Endpoint `/acionamentoRouboFurto` | NÃO IMPLEMENTADO | Não existe edge function |
| Integração sinistro → rastreador | NÃO IMPLEMENTADO | `criar-sinistro` não aciona rastreador |
| Modo rastreamento intensivo | NÃO IMPLEMENTADO | Não existe lógica |
| Histórico com maior frequência | PARCIAL | Existe `rastreador_posicoes` mas sem modo intensivo |
| Registro com data/hora/responsável | NÃO IMPLEMENTADO | Não há tabela de acionamentos |

---

## Gaps Identificados

### 1. Ausência de Edge Function para Acionamento

**Problema:** Não existe edge function que chame o endpoint `POST /acionamentoRouboFurto` da API Rede Veículos.

**Momentos que deveria ser chamado (conforme requisitos):**
1. Quando associado comunica roubo/furto pelo App ❌
2. Quando setor de Eventos confirma sinistro tipo roubo/furto ❌
3. Quando Assistência 24h recebe chamado de emergência ❌
4. Quando diretoria autoriza acionamento de recuperação ❌

---

### 2. `criar-sinistro` Não Integra com Rastreador

**Código atual (linha 295-333):**
O sinistro é criado no banco, histórico registrado, documentos pendentes criados, notificações enviadas - mas **não há nenhuma chamada para acionar o rastreador**.

---

### 3. Ausência de Tabela de Acionamentos

Não existe tabela para registrar acionamentos de roubo/furto com:
- Data/hora do acionamento
- Responsável pelo acionamento
- Status do acionamento (sucesso/erro)
- Resposta da API

---

### 4. Ausência de Modo de Rastreamento Intensivo

O sistema não possui lógica para:
- Aumentar frequência de coleta de posições durante emergência
- Mudar veículo para "modo rastreamento intensivo"
- Preservar histórico com maior granularidade

---

## Plano de Implementação

### Fase 1: Infraestrutura de Banco de Dados

**Nova tabela: `acionamentos_roubo_furto`**

```sql
CREATE TABLE acionamentos_roubo_furto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referências
  sinistro_id UUID REFERENCES sinistros(id),
  chamado_assistencia_id UUID REFERENCES chamados_assistencia(id),
  veiculo_id UUID NOT NULL REFERENCES veiculos(id),
  rastreador_id UUID REFERENCES rastreadores(id),
  
  -- Dados do acionamento
  tipo_origem VARCHAR(50) NOT NULL, -- 'sinistro', 'assistencia', 'diretoria', 'manual'
  protocolo_externo VARCHAR(100), -- Protocolo retornado pela Rede Veículos
  
  -- Quem acionou
  solicitado_por UUID REFERENCES profiles(id),
  solicitado_por_nome VARCHAR(255),
  solicitado_em TIMESTAMPTZ DEFAULT NOW(),
  
  -- Autorização (para acionamentos que requerem aprovação)
  autorizado_por UUID REFERENCES profiles(id),
  autorizado_em TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(30) DEFAULT 'solicitado',
  -- (solicitado, autorizado, enviado, confirmado, erro, cancelado)
  
  -- Resposta da API
  api_request JSONB,
  api_response JSONB,
  api_status_code INTEGER,
  
  -- Observações
  observacoes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_acionamentos_sinistro ON acionamentos_roubo_furto(sinistro_id);
CREATE INDEX idx_acionamentos_veiculo ON acionamentos_roubo_furto(veiculo_id);
CREATE INDEX idx_acionamentos_status ON acionamentos_roubo_furto(status);
```

---

### Fase 2: Edge Function `acionar-roubo-furto`

**Nova edge function em `supabase/functions/acionar-roubo-furto/index.ts`**

```typescript
// Endpoints da API Rede Veículos:
// POST /acionamentoRouboFurto - Aciona alerta prioritário
// POST /veiculos/{codigo}/rastreamentoIntensivo - Ativa modo intensivo

// Fluxo:
// 1. Validar autenticação e permissões
// 2. Buscar dados do veículo e rastreador
// 3. Verificar se rastreador é da plataforma Rede Veículos
// 4. Chamar API /acionamentoRouboFurto
// 5. Se sucesso, ativar rastreamento intensivo
// 6. Registrar na tabela acionamentos_roubo_furto
// 7. Criar alerta crítico na tabela rastreador_alertas
// 8. Notificar equipe de monitoramento
```

---

### Fase 3: Integração nos Pontos de Entrada

**3.1. Sinistro tipo roubo/furto (`criar-sinistro/index.ts`)**
- Adicionar verificação: se `tipo_sinistro` é `roubo` ou `furto`
- Chamar `acionar-roubo-furto` automaticamente
- Registrar no histórico do sinistro

**3.2. Atualização de status do sinistro (`SinistroDetalhe.tsx`)**
- Adicionar botão "Acionar Recuperação" para analistas/diretoria
- Disponível apenas para sinistros tipo roubo/furto
- Requer confirmação antes de acionar

**3.3. Assistência 24h emergencial (`criar-chamado-assistencia/index.ts`)**
- Verificar se chamado é de tipo "roubo" ou marcado como emergência
- Disparar acionamento automaticamente

**3.4. Painel de Monitoramento (`AlertasWidget.tsx`)**
- Adicionar tipo de alerta "acionamento_roubo"
- Exibir com severidade "critica" e destaque visual
- Ação rápida para "Ver Rastreamento"

---

### Fase 4: Modo Rastreamento Intensivo

**4.1. Adicionar campo na tabela `rastreadores`:**
```sql
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS 
  modo_rastreamento VARCHAR(20) DEFAULT 'normal'
  CHECK (modo_rastreamento IN ('normal', 'intensivo', 'emergencia'));

ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS 
  modo_ativado_em TIMESTAMPTZ;

ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS 
  modo_ativado_por UUID REFERENCES profiles(id);
```

**4.2. Lógica de coleta mais frequente:**
- Modo normal: coleta a cada 5-10 minutos
- Modo intensivo: coleta a cada 30 segundos (via API Rede Veículos)
- Modo emergência: coleta contínua (tempo real se disponível)

---

### Fase 5: Interface de Usuário

**5.1. Botão no Detalhe do Sinistro:**
- "🚨 Acionar Recuperação"
- Só aparece para sinistros roubo/furto
- Abre modal de confirmação
- Registra quem acionou

**5.2. Card de Acionamento no Sinistro:**
- Mostra status do acionamento
- Data/hora do acionamento
- Responsável
- Link para rastreamento ao vivo

**5.3. Widget no Dashboard de Monitoramento:**
- Lista de veículos em modo intensivo
- Alertas prioritários de roubo/furto
- Mapa com localização em tempo real

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/acionar-roubo-furto/index.ts` | Edge function principal |
| `src/hooks/useAcionamentoRoubo.ts` | Hook para acionamento |
| `src/components/sinistros/AcionarRecuperacaoModal.tsx` | Modal de confirmação |
| `src/components/monitoramento/VeiculosEmergenciaWidget.tsx` | Widget de veículos em emergência |

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `supabase/functions/criar-sinistro/index.ts` | Integrar acionamento automático para roubo/furto |
| `supabase/functions/criar-chamado-assistencia/index.ts` | Integrar acionamento para emergências |
| `src/pages/eventos/SinistroDetalhe.tsx` | Adicionar botão e card de acionamento |
| `src/components/monitoramento/AlertasWidget.tsx` | Adicionar tipo "acionamento_roubo" |
| `supabase/config.toml` | Adicionar nova edge function |

---

## Fluxo Completo Após Implementação

```text
ASSOCIADO COMUNICA ROUBO (App ou WhatsApp)
    │
    ▼
criar-sinistro detecta tipo = roubo/furto
    │
    ▼
Chama acionar-roubo-furto automaticamente
    │
    ├──► POST /acionamentoRouboFurto (Rede Veículos)
    │        │
    │        ▼
    │    Alerta gerado na central da Rede Veículos
    │
    ├──► Ativa modo rastreamento intensivo
    │
    ├──► Cria alerta crítico no SGA (rastreador_alertas)
    │
    ├──► Notifica equipe de monitoramento
    │
    └──► Registra em acionamentos_roubo_furto
              │
              ▼
         Histórico completo:
         - Data/hora
         - Responsável
         - Resposta API
         - Status
```

---

## Requisitos Confirmados Após Implementação

| Requisito | Status |
|-----------|--------|
| Acionamento gera alerta prioritário na central | ✅ Via API Rede Veículos |
| Veículo entra em modo rastreamento intensivo | ✅ Campo `modo_rastreamento` |
| Histórico preservado com maior frequência | ✅ Coleta a cada 30s |
| Registro com data/hora e responsável no SGA | ✅ Tabela `acionamentos_roubo_furto` |

---

## Teste Recomendado

Após implementação, testar em ambiente sandbox:

```bash
# 1. Criar sinistro tipo roubo via App
# 2. Verificar se acionamento foi criado automaticamente
# 3. Confirmar resposta da API Rede Veículos
# 4. Verificar alerta crítico no widget de alertas
# 5. Confirmar que rastreador entrou em modo intensivo
# 6. Verificar registro na tabela acionamentos_roubo_furto
```

