
# Plano: Revisão Completa do Fluxo de Sinistros — SGA PRATIC 2.0

## Análise da Situação Atual vs. Requisitos

### Status Atuais no Banco (Enum `status_sinistro`)
```
aguardando_parecer, aguardando_vistoria, aprovado, cancelado, comunicado,
documentacao_pendente, em_analise, em_regulacao, em_reparo, em_sindicancia,
em_vistoria, encerrado, indenizado, negado, pago, reprovado
```

### Gaps Identificados

| Fase do Fluxo | Status Necessário | Status Atual | Ação |
|---------------|-------------------|--------------|------|
| 1. Comunicado | `comunicado` | Existe | OK |
| 2. Abertura | `em_analise` | Existe | OK |
| 3. Vistoria | `aguardando_vistoria`, `em_vistoria` | Existem | OK |
| 4. Parecer | `aguardando_parecer` | Existe | OK |
| 5. Sindicância | `em_sindicancia` | Existe | Completar lógica |
| 5b. Perícia | `em_pericia` | **NÃO EXISTE** | Criar |
| 5c. Suspenso | `suspenso` | **NÃO EXISTE** | Criar |
| 5d. Análise Interna | `analise_interna` | **NÃO EXISTE** | Criar |
| 6. Aprovado | `aprovado` | Existe | OK |
| 6b. Negado | `negado` | Existe | OK |
| 7. Regulação | `em_regulacao` | Existe | OK |
| 8. Em Reparo | `em_reparo` | Existe | Integrar com OS |
| 9. Aguard. Cota | `aguardando_cota` | **NÃO EXISTE** | Criar |
| 10. Aguard. Termo | `aguardando_termo` | **NÃO EXISTE** | Criar |
| 11. Pago/Indenizado | `pago`, `indenizado` | Existem | OK |
| 12. Em Garantia | `em_garantia` | **NÃO EXISTE** | Criar |
| 13. Encerrado | `encerrado` | Existe | OK |
| 14. Em Recuperação | `em_recuperacao` | **NÃO EXISTE** | Criar (Roubo/Furto) |

### Regras de Negócio Faltantes

1. **Prazo de Comunicado**: 30 dias (imediato para Roubo/Furto)
2. **Carência Vidros**: 120 dias
3. **Cota de Participação**: R$ 750 padrão
4. **Regra 75% FIPE**: Parcial (<75%) vs Perda Total (≥75%)
5. **Documentos por Local**: Rodovia Federal, Estadual, Urbana

---

## Alterações Propostas

### 1. Migração SQL — Novos Status e Campos

```sql
-- Adicionar novos valores ao enum
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_pericia';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'suspenso';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'analise_interna';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_cota';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_termo';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_garantia';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_recuperacao';

-- Novos campos na tabela sinistros
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  tipo_local_evento VARCHAR(50); -- 'rodovia_federal', 'rodovia_estadual', 'urbana'

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  condutor_nome VARCHAR(255);

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  condutor_cnh VARCHAR(20);

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  condutor_relacao VARCHAR(50); -- 'associado', 'terceiro_autorizado', 'terceiro'

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  condutor_embriaguez BOOLEAN DEFAULT false;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  condutor_cnh_vencida BOOLEAN DEFAULT false;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  prazo_comunicado_dias INTEGER;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  valor_cota_participacao NUMERIC(10,2) DEFAULT 750.00;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  cota_paga BOOLEAN DEFAULT false;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  cota_paga_em TIMESTAMP WITH TIME ZONE;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  termo_anuencia_assinado BOOLEAN DEFAULT false;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  termo_anuencia_url TEXT;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  termo_anuencia_assinado_em TIMESTAMP WITH TIME ZONE;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  tipo_dano VARCHAR(20) DEFAULT 'parcial'; -- 'parcial', 'perda_total'

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  percentual_fipe NUMERIC(5,2);

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  veiculo_recuperado BOOLEAN DEFAULT false;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  veiculo_recuperado_em TIMESTAMP WITH TIME ZONE;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  data_prazo_documentos TIMESTAMP WITH TIME ZONE;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  data_prazo_cota TIMESTAMP WITH TIME ZONE;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  data_garantia_inicio DATE;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  data_garantia_fim DATE;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  motivo_analise_interna TEXT;

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  sindicante_id UUID REFERENCES profiles(id);

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  perito_id UUID REFERENCES profiles(id);

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  resultado_sindicancia VARCHAR(50); -- 'regular', 'irregular', 'inconclusivo'

ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS
  resultado_pericia TEXT;
```

### 2. Atualizar Types — `src/types/sinistros.ts`

```typescript
export type StatusSinistro = 
  | 'comunicado'
  | 'em_analise'
  | 'documentacao_pendente'
  | 'aguardando_vistoria'
  | 'em_vistoria'
  | 'aguardando_parecer'
  | 'em_sindicancia'
  | 'em_pericia'
  | 'analise_interna'
  | 'suspenso'
  | 'aprovado'
  | 'negado'
  | 'em_regulacao'
  | 'aguardando_termo'
  | 'aguardando_cota'
  | 'em_reparo'
  | 'em_recuperacao'
  | 'aguardando_pagamento'
  | 'pago'
  | 'indenizado'
  | 'em_garantia'
  | 'encerrado'
  | 'cancelado';

export type TipoLocalEvento = 'rodovia_federal' | 'rodovia_estadual' | 'urbana';
export type TipoDano = 'parcial' | 'perda_total';
export type ResultadoSindicancia = 'regular' | 'irregular' | 'inconclusivo';
```

### 3. Workflow Completo — Fluxo de Transições

```typescript
export const WORKFLOW_SINISTRO_COMPLETO: Record<StatusSinistro, StatusSinistro[]> = {
  // FASE 1: ENTRADA
  comunicado: ['em_analise', 'cancelado'],
  
  // FASE 2: ABERTURA/DOCUMENTAÇÃO
  em_analise: [
    'documentacao_pendente', 
    'aguardando_vistoria', 
    'em_sindicancia', 
    'analise_interna',
    'aprovado', 
    'negado', 
    'cancelado'
  ],
  documentacao_pendente: ['em_analise', 'cancelado'],
  
  // FASE 3: VISTORIA
  aguardando_vistoria: ['em_vistoria', 'cancelado'],
  em_vistoria: ['aguardando_parecer', 'em_sindicancia', 'cancelado'],
  aguardando_parecer: ['aprovado', 'negado', 'em_sindicancia'],
  
  // FASE 4: ANÁLISES ESPECIAIS
  em_sindicancia: ['em_analise', 'aprovado', 'negado', 'suspenso', 'cancelado'],
  em_pericia: ['em_sindicancia', 'aprovado', 'negado'],
  analise_interna: ['em_analise', 'aprovado', 'negado'],
  suspenso: ['em_analise', 'em_sindicancia', 'cancelado'],
  
  // FASE 5: DECISÃO
  aprovado: ['em_regulacao', 'em_recuperacao'], // Recuperação para Roubo/Furto
  negado: ['encerrado'],
  
  // FASE 6: EXECUÇÃO (REPAROS)
  em_regulacao: ['aguardando_termo', 'aguardando_cota', 'em_reparo', 'pago'], 
  aguardando_termo: ['aguardando_cota', 'cancelado'],
  aguardando_cota: ['em_reparo', 'cancelado'],
  em_reparo: ['em_garantia', 'pago'],
  em_garantia: ['encerrado'],
  
  // FASE 6B: RECUPERAÇÃO (ROUBO/FURTO)
  em_recuperacao: ['em_regulacao', 'pago', 'encerrado'], // Recuperado = vai para regulação ou encerra
  
  // FASE 7: PAGAMENTO
  aguardando_pagamento: ['pago', 'indenizado'],
  pago: ['encerrado'],
  indenizado: ['encerrado'],
  
  // FINAIS
  encerrado: [],
  cancelado: [],
};
```

### 4. Regras de Validação — Edge Function `criar-sinistro`

Atualizar para incluir:

**a) Verificação de Prazo de Comunicado**
```typescript
// Roubo/Furto: deve ser imediato (tolerância 3 dias)
// Outros: 30 dias corridos
const diasDesdeEvento = differenceInDays(new Date(), new Date(payload.data_evento));
const isRouboFurto = ['roubo', 'furto'].includes(payload.tipo_sinistro);

if (isRouboFurto && diasDesdeEvento > 3) {
  // Aceitar mas marcar alerta
  alertas.push('Comunicado de roubo/furto fora do prazo recomendado (imediato)');
}
if (!isRouboFurto && diasDesdeEvento > 30) {
  // Aceitar mas marcar alerta
  alertas.push('Comunicado fora do prazo de 30 dias');
}
```

**b) Verificação de Carência para Vidros/Faróis**
```typescript
if (payload.tipo_sinistro === 'vidros') {
  const diasAtivacao = differenceInDays(new Date(), new Date(veiculo.data_ativacao));
  if (diasAtivacao < 120) {
    return Response.json({
      success: false,
      error: `Veículo em período de carência para vidros. Carência de 120 dias - Faltam ${120 - diasAtivacao} dias.`
    }, { status: 400 });
  }
}
```

**c) Documentos por Tipo de Local**
```typescript
const DOCUMENTOS_POR_LOCAL: Record<string, Record<string, string[]>> = {
  rodovia_federal: {
    sem_vitima: ['cst_prf'],
    com_vitima: ['lpst', 'raph', 'bam', 'certidao_cbmerj']
  },
  rodovia_estadual: {
    sem_vitima: ['ebrat_pmerj'],
    com_vitima: ['brat_bopm', 'raph', 'bam', 'certidao_cbmerj']
  },
  urbana: {
    sem_vitima: ['ebrat'],
    com_vitima: ['brat', 'documentos_medicos']
  },
  sp_outros: {
    sem_vitima: ['bo'],
    com_vitima: ['bo', 'documentos_medicos']
  }
};
```

### 5. Nova Página — `SinistroAnaliseCompleta.tsx`

Aprimorar a página de análise existente com:

**Seções Adicionais:**

1. **Dados do Condutor** (separado do associado)
   - Nome, CNH, Relação com associado
   - Alertas: CNH vencida, embriaguez, recusa bafômetro

2. **Validações Automáticas** (Card de Checklist Expandido)
   - Condutor = Associado? 
   - CNH válida na data do evento?
   - Veículo em carência?
   - Prazo de comunicado OK?
   - Status plataforma OK?

3. **Ações por Fase:**
   ```
   COMUNICADO → [Iniciar Análise] [Cancelar]
   EM ANÁLISE → [Solicitar Docs] [Agendar Vistoria] [Encaminhar Sindicância] [Aprovar] [Negar]
   AGUARDANDO VISTORIA → [Iniciar Vistoria] [Cancelar]
   EM VISTORIA → [Registrar Parecer]
   EM SINDICÂNCIA → [Registrar Resultado] [Encaminhar Perícia]
   APROVADO → [Iniciar Regulação] [Recuperação (R/F)]
   EM REGULAÇÃO → [Gerar Termo Anuência] [Cobrar Cota] [Criar OS Oficina]
   EM REPARO → [Concluir Reparo] [Iniciar Garantia]
   ```

4. **Painel de Valores** (para Perda Total)
   - Valor FIPE
   - Valor Orçamento
   - Percentual = Orçamento/FIPE × 100
   - Classificação automática: < 75% = Parcial, ≥ 75% = Perda Total

### 6. Dialogs de Ação — Novos Componentes

| Componente | Função |
|------------|--------|
| `EncaminharSindicanciaDialog.tsx` | Selecionar sindicante, prazo 30 dias, motivo |
| `EncaminharPericiaDialog.tsx` | Selecionar perito, tipo perícia (técnica) |
| `RegistrarParecerVistoriaDialog.tsx` | Laudo, fotos, valor estimado danos |
| `IniciarRecuperacaoDialog.tsx` | Para Roubo/Furto, período monitoramento |
| `RegistrarRecuperacaoDialog.tsx` | Veículo recuperado, estado, localização |
| `GerarTermoAnuenciaDialog.tsx` | Gerar PDF, enviar para assinatura |
| `CobrarCotaParticipacaoDialog.tsx` | Gerar cobrança Asaas, valor R$ 750 |
| `CriarOSOficinaDialog.tsx` | Selecionar oficina, vincular sinistro |
| `ConcluirReparoDialog.tsx` | Fotos entrega, iniciar garantia 90 dias |

### 7. Integração com Oficinas

**Novo fluxo:**
```
APROVADO (tipo_dano = parcial)
     ↓
EM REGULAÇÃO (orçamentos, negociação)
     ↓
AGUARDANDO TERMO (gerar PDF, assinatura digital)
     ↓
AGUARDANDO COTA (cobrar R$ 750 via Asaas)
     ↓
EM REPARO (criar OS vinculada ao sinistro)
     ↓
[Oficina executa...]
     ↓
EM GARANTIA (90 dias pós-entrega)
     ↓
ENCERRADO
```

**Campos em `ordens_servico`:**
- `sinistro_id` já existe
- Adicionar: `tipo_origem` = 'sinistro' ou 'avulso'

### 8. Fluxo Roubo/Furto — Recuperação

```
COMUNICADO (imediato)
     ↓
EM ANÁLISE (sem vistoria, análise rastreador)
     ↓
[30 dias monitoramento]
     ↓
EM SINDICÂNCIA (se suspeita)
     ↓
APROVADO
     ↓
EM RECUPERAÇÃO (tentativa localização)
     ↓
[Recuperado?]
  ├─ NÃO → INDENIZAÇÃO (Perda Total)
  ├─ SIM, sem dano → ENCERRADO (ABP desonerada)
  ├─ SIM, dano <75% → EM REGULAÇÃO → REPAROS
  └─ SIM, dano ≥75% → INDENIZAÇÃO
```

### 9. Notificações WhatsApp por Status

Atualizar `notificar-sinistro` com templates para novos status:

```typescript
const TEMPLATES_NOVOS = {
  aguardando_vistoria: {
    titulo: '📋 Vistoria Agendada',
    mensagem: 'Sua vistoria foi agendada para o sinistro {protocolo}...'
  },
  em_sindicancia: {
    titulo: '🔍 Em Análise Especial',
    mensagem: 'Seu sinistro {protocolo} está em análise detalhada...'
  },
  aguardando_termo: {
    titulo: '📝 Termo de Anuência',
    mensagem: 'Para prosseguir com o reparo do sinistro {protocolo}, assine o termo...'
  },
  aguardando_cota: {
    titulo: '💰 Cota de Participação',
    mensagem: 'Para iniciar o reparo, efetue o pagamento da cota de R$ 750...'
  },
  em_garantia: {
    titulo: '✅ Garantia Ativa',
    mensagem: 'Seu veículo foi entregue. Garantia válida por 90 dias...'
  },
  em_recuperacao: {
    titulo: '🔎 Buscando Veículo',
    mensagem: 'Estamos monitorando e buscando seu veículo...'
  }
};
```

### 10. Prazos e Automações

**Regras de timeout:**
- Documentos pendentes: 30 dias → Encerra
- Cota não paga: 30 dias → Encerra
- Termo não assinado: 30 dias → Encerra
- Reparo em oficina: 90 dias úteis → Alerta

**Edge Function `cron-verificar-prazos-sinistros`:**
```typescript
// Executar diariamente
// 1. Buscar sinistros com prazos vencidos
// 2. Atualizar status para cancelado/encerrado
// 3. Notificar associado e equipe
```

---

## Resumo de Arquivos

### Criar
| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/XXX_novos_status_sinistros.sql` | Novos enums e campos |
| `src/components/sinistros/EncaminharSindicanciaDialog.tsx` | Dialog sindicância |
| `src/components/sinistros/RegistrarParecerVistoriaDialog.tsx` | Parecer técnico |
| `src/components/sinistros/GerarTermoAnuenciaDialog.tsx` | Gerar termo PDF |
| `src/components/sinistros/CobrarCotaDialog.tsx` | Integração Asaas |
| `src/components/sinistros/CriarOSDialog.tsx` | Vincular a oficina |
| `src/components/sinistros/IniciarRecuperacaoDialog.tsx` | Fluxo roubo/furto |
| `supabase/functions/cron-verificar-prazos-sinistros/index.ts` | Automação prazos |

### Modificar
| Arquivo | Alteração |
|---------|-----------|
| `src/types/sinistros.ts` | Novos types e workflow |
| `supabase/functions/criar-sinistro/index.ts` | Validações prazo, carência |
| `supabase/functions/notificar-sinistro/index.ts` | Novos templates |
| `src/pages/eventos/SinistroAnalise.tsx` | Ações por fase |
| `src/components/eventos/AtualizarStatusModal.tsx` | Novo fluxo transições |
| `src/pages/eventos/SinistrosList.tsx` | Novos filtros status |
| `src/pages/eventos/SinistroDetalhe.tsx` | Novos cards info |

---

## Complexidade e Priorização

**Fase 1 (Crítica):**
- Migração SQL com novos status
- Atualizar types e workflow
- Validação prazo comunicado
- Validação carência vidros

**Fase 2 (Importante):**
- Dialogs de sindicância/perícia
- Fluxo termo + cota
- Integração OS oficina

**Fase 3 (Complementar):**
- Fluxo recuperação roubo/furto
- Automação prazos (cron)
- Garantia pós-reparo
