
# Sistema de Cobrança Pós-Pago com Rateio por Cotas

## Resumo Executivo

Este plano detalha a implementação de um sistema completo de cobrança mutualista pós-pago, onde cada associado paga proporcionalmente à sua quota de veículo. O sistema automatizará o fechamento mensal no dia 25, calculará rateios por benefício e gerará cobranças compostas (Taxa Admin + Rateio + Adicionais).

OBSERVAÇÃO IMPORTANTE. O SISTEMA DEVE, AO GERAR PRÓXIMAS FATURAS, EXIBI-LAS ANEXADAS NOS BOLETOS (SESSÃO) DOS ASSOCIADOS REFERENTES COM OPÇÃO DE "ENVIAR", QUE USA A IA DO SISTEMA PARA ENVIAR LINK DA COBRANÇA (ASAAS)

---

## 1. Análise do Estado Atual

### O que já existe:
- **Tabela `faixas_cotas`**: Define quantidade de cotas por faixa FIPE (ex: R$ 20-25k = 4 cotas)
- **Tabela `faixas_taxa_administrativa`**: Taxa fixa por faixa FIPE
- **Tabela `rateios`**: Armazena cálculos mensais com `valor_rateio_por_cota`
- **Tabela `rateios_detalhes_faixas`**: Detalhamento por faixa com ajustes
- **Função SQL `fn_calcular_rateio_por_cotas`**: Calcula rateio distribuído por faixa
- **Função SQL `fn_calcular_total_cotas_ativos`**: Soma todas as cotas ativas
- **Edge function `gerar-cobrancas-mensais`**: Gera boletos simples (sem rateio)
- **Tabela `asaas_cobrancas`**: Armazena cobranças com integração ASAAS

### O que falta implementar:
1. Fechamento mensal automatizado (dia 25)
2. Apuração de despesas por tipo de benefício
3. Cálculo de rateio proporcional por benefício
4. Composição da fatura (Taxa + Rateio + Adicionais)
5. Cobrança pró-rata para entradas/saídas
6. Workflow de aprovação antes da geração de boletos
7. Interface para acompanhar o fechamento

---

## 2. Arquitetura da Solução

```text
                         FLUXO MENSAL DE COBRANÇA
                         ========================

    DIA 25                    DIA 26-28                   DIA 29-30
    ──────                    ────────                    ────────
       │                          │                           │
       ▼                          ▼                           ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  FECHAMENTO  │          │   CÁLCULO    │          │   GERAÇÃO    │
│              │          │   RATEIO     │          │   BOLETOS    │
│ • Apura      │          │              │          │              │
│   sinistros  │────────▶ │ • Por benefício────────▶│ • Composição │
│ • Agrupa por │          │ • Por cota   │          │   da fatura  │
│   benefício  │          │ • Ajustes    │          │ • ASAAS API  │
│ • Status:    │          │ • Aprovação  │          │ • WhatsApp   │
│   "fechado"  │          │              │          │              │
└──────────────┘          └──────────────┘          └──────────────┘
```

---

## 3. Modelagem de Dados

### 3.1 Nova Tabela: `fechamentos_mensais`

Registra o fechamento de cada período com totais apurados.

```sql
CREATE TABLE fechamentos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  data_fechamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'aberto', -- aberto, fechado, aprovado, processado
  
  -- Totais apurados
  total_associados_ativos INTEGER,
  total_cotas_ativas NUMERIC,
  total_despesas_rateio NUMERIC DEFAULT 0,
  total_taxa_administrativa NUMERIC DEFAULT 0,
  total_adicionais NUMERIC DEFAULT 0,
  total_geral NUMERIC DEFAULT 0,
  
  -- Auditoria
  fechado_por UUID REFERENCES profiles(id),
  fechado_em TIMESTAMP WITH TIME ZONE,
  aprovado_por UUID REFERENCES profiles(id),
  aprovado_em TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(mes, ano)
);
```

### 3.2 Nova Tabela: `despesas_rateio`

Armazena despesas a ratear agrupadas por tipo de benefício.

```sql
CREATE TABLE despesas_rateio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id UUID REFERENCES fechamentos_mensais(id) ON DELETE CASCADE,
  
  tipo_beneficio VARCHAR(50) NOT NULL, -- colisao, roubo_furto, vidros, terceiros, assistencia
  descricao TEXT,
  
  -- Valores
  valor_total NUMERIC NOT NULL,
  total_cotas_elegivel NUMERIC, -- soma de cotas dos que têm este benefício
  valor_por_cota NUMERIC, -- valor_total / total_cotas_elegivel
  
  -- Sinistros vinculados
  quantidade_eventos INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.3 Nova Tabela: `cobrancas_composicao`

Detalha os componentes de cada cobrança individual.

```sql
CREATE TABLE cobrancas_composicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id UUID REFERENCES asaas_cobrancas(id) ON DELETE CASCADE,
  
  -- Componentes
  valor_taxa_administrativa NUMERIC DEFAULT 0,
  valor_rateio_colisao NUMERIC DEFAULT 0,
  valor_rateio_roubo_furto NUMERIC DEFAULT 0,
  valor_rateio_vidros NUMERIC DEFAULT 0,
  valor_rateio_terceiros NUMERIC DEFAULT 0,
  valor_rateio_assistencia NUMERIC DEFAULT 0,
  valor_adicionais NUMERIC DEFAULT 0, -- rastreador, app, etc.
  
  -- Proporcionalidade
  fator_prorata NUMERIC DEFAULT 1.0, -- 1.0 = mês cheio, 0.5 = 15 dias
  dias_ativos INTEGER DEFAULT 30,
  
  -- Dados do veículo no momento
  valor_fipe NUMERIC,
  quantidade_cotas INTEGER,
  faixa_id UUID REFERENCES faixas_cotas(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.4 Alterações em Tabelas Existentes

**Tabela `asaas_cobrancas`** - Adicionar campos:
```sql
ALTER TABLE asaas_cobrancas
ADD COLUMN IF NOT EXISTS fechamento_id UUID REFERENCES fechamentos_mensais(id),
ADD COLUMN IF NOT EXISTS mes_referencia INTEGER,
ADD COLUMN IF NOT EXISTS ano_referencia INTEGER,
ADD COLUMN IF NOT EXISTS modelo_cobranca VARCHAR(20) DEFAULT 'rateio', -- rateio, fixo
ADD COLUMN IF NOT EXISTS composicao_detalhada JSONB;
```

**Tabela `veiculos`** - Adicionar cache de cotas:
```sql
ALTER TABLE veiculos
ADD COLUMN IF NOT EXISTS quantidade_cotas INTEGER,
ADD COLUMN IF NOT EXISTS faixa_cota_id UUID REFERENCES faixas_cotas(id);
```

---

## 4. Edge Functions

### 4.1 `fechamento-mensal` (NOVA)

Processa o fechamento do mês no dia 25.

**Responsabilidades:**
1. Apurar sinistros aprovados/indenizados no período
2. Agrupar despesas por tipo de benefício
3. Calcular soma de cotas por benefício
4. Gerar registro de fechamento
5. Bloquear edições retroativas

**Payload de entrada:**
```json
{
  "mes": 1,
  "ano": 2026,
  "forcar": false
}
```

### 4.2 `calcular-rateio-completo` (NOVA)

Calcula o rateio detalhado após fechamento.

**Responsabilidades:**
1. Buscar despesas do fechamento
2. Para cada tipo de benefício:
   - Identificar associados elegíveis (têm o benefício ativo)
   - Somar cotas desses associados
   - Calcular valor por cota = despesa / soma_cotas
3. Aplicar ajustes por faixa
4. Gerar preview para aprovação

### 4.3 `gerar-faturas-mensais` (ATUALIZAR)

Refatorar a edge function existente para:

**Novo fluxo:**
1. Verificar se fechamento está aprovado
2. Para cada associado ativo:
   - Buscar taxa administrativa (por faixa FIPE)
   - Calcular rateio por benefício contratado
   - Somar adicionais (rastreador, assistência plus)
   - Aplicar pró-rata se entrada/saída no mês
3. Compor fatura final
4. Criar cobrança no ASAAS
5. Salvar composição detalhada

### 4.4 `cron-fechamento-dia-25` (NOVA)

CRON job que executa automaticamente no dia 25.

```sql
SELECT cron.schedule(
  'fechamento-mensal-dia-25',
  '0 6 25 * *', -- Dia 25 às 06:00
  $$
  SELECT net.http_post(
    url:='https://.../functions/v1/fechamento-mensal',
    headers:='{"Authorization": "Bearer ...", "Content-Type": "application/json"}'::jsonb,
    body:='{"auto": true}'::jsonb
  );
  $$
);
```

---

## 5. Cálculo de Pró-Rata

Para associados que entraram ou saíram durante o mês:

```typescript
function calcularProRata(dataAdesao: Date, dataSaida: Date | null, mes: number, ano: number): number {
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0);
  const diasMes = fimMes.getDate();
  
  // Data efetiva de início (maior entre adesão e início do mês)
  const dataInicio = dataAdesao > inicioMes ? dataAdesao : inicioMes;
  
  // Data efetiva de fim (menor entre saída e fim do mês)
  const dataFim = dataSaida && dataSaida < fimMes ? dataSaida : fimMes;
  
  // Calcular dias ativos
  const diasAtivos = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  return Math.max(0, Math.min(1, diasAtivos / diasMes));
}
```

---

## 6. Composição da Fatura

Para cada associado, a fatura será composta assim:

```typescript
interface FaturaComposicao {
  associado_id: string;
  veiculo_id: string;
  
  // 1. Taxa Administrativa (fixa por faixa FIPE)
  taxaAdministrativa: number; // Ex: R$ 49,90
  
  // 2. Rateio por Benefício (proporcional à cota)
  rateioColisao: number;      // Ex: R$ 35,99 (se contratado)
  rateioRouboFurto: number;   // Ex: R$ 28,50 (se contratado)
  rateioVidros: number;       // Ex: R$ 8,00 (se contratado)
  rateioTerceiros: number;    // Ex: R$ 12,00 (se contratado)
  rateioAssistencia: number;  // Ex: R$ 15,00 (se contratado)
  
  // 3. Adicionais (valores fixos)
  rastreador: number;         // Ex: R$ 29,90 (se tiver)
  assistenciaPlus: number;    // Ex: R$ 19,90 (se contratado)
  
  // Subtotais
  subtotalRateio: number;
  subtotalAdicionais: number;
  
  // Pró-rata
  fatorProRata: number;       // Ex: 0.5 para meio mês
  
  // Total
  valorFinal: number;
}
```

---

## 7. Interface do Usuário

### 7.1 Nova Página: Fechamento Mensal (`/diretoria/fechamento`)

**Cards de Status:**
- Status do fechamento atual (Aberto/Fechado/Aprovado/Processado)
- Countdown para próximo fechamento automático
- Botão "Fechar Mês Manualmente"

**Resumo de Despesas:**
- Grid com despesas por tipo de benefício
- Gráfico de pizza com distribuição

**Preview do Rateio:**
- Tabela com valor por cota por benefício
- Comparativo com mês anterior
- Alerta se variação > 5%

**Ações:**
- Aprovar Fechamento
- Gerar Cobranças
- Exportar Relatório

### 7.2 Atualizar Página de Rateio Existente

Integrar com o novo sistema:
- Mostrar despesas separadas por benefício
- Exibir valor por cota por benefício
- Link para fechamento do mês

### 7.3 Atualizar Faturamento Mensal

Adaptar para usar o novo fluxo:
- Verificar se fechamento está aprovado
- Mostrar composição da fatura por associado
- Preview antes de gerar boletos

---

## 8. Workflow de Aprovação

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   ABERTO    │───▶│  FECHADO    │───▶│  APROVADO   │───▶│ PROCESSADO  │
│             │    │             │    │             │    │             │
│ Despesas    │    │ Despesas    │    │ Rateio      │    │ Boletos     │
│ acumulando  │    │ consolidadas│    │ calculado   │    │ gerados     │
│             │    │ Edição      │    │ Aguardando  │    │ WhatsApp    │
│             │    │ bloqueada   │    │ geração     │    │ enviado     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      │                  │                  │                  │
   Dia 25            Diretor            Diretor            Sistema
   (auto)            aprova             confirma
```

---

## 9. Tratamento de Benefícios

### Mapeamento de Benefícios para Rateio:

| Tipo Sinistro | Benefício Relacionado | Campo no Veículo/Contrato |
|---------------|----------------------|---------------------------|
| colisao_parcial | Colisão | `cobertura_total` |
| colisao_total | Colisão | `cobertura_total` |
| roubo | Roubo/Furto | `cobertura_roubo_furto` |
| furto | Roubo/Furto | `cobertura_roubo_furto` |
| incendio | Incêndio | `cobertura_total` |
| vidros | Vidros | Addon do plano |
| terceiros | Terceiros | Addon do plano |

### Regra de Elegibilidade:

Um associado só paga o rateio de um benefício se:
1. O veículo tem aquele benefício ativo (cobertura contratada)
2. Não estava em carência daquele benefício no período

---

## 10. Resumo de Arquivos a Criar/Modificar

### Migrations (5 arquivos):
1. `create_fechamentos_mensais.sql`
2. `create_despesas_rateio.sql`
3. `create_cobrancas_composicao.sql`
4. `alter_asaas_cobrancas.sql`
5. `alter_veiculos_cotas.sql`

### Edge Functions (4 arquivos):
1. `supabase/functions/fechamento-mensal/index.ts` (NOVA)
2. `supabase/functions/calcular-rateio-completo/index.ts` (NOVA)
3. `supabase/functions/gerar-faturas-mensais/index.ts` (REFATORAR)
4. `supabase/functions/cron-fechamento-dia-25/index.ts` (NOVA - opcional)

### Hooks (3 arquivos):
1. `src/hooks/useFechamentoMensal.ts` (NOVO)
2. `src/hooks/useCobrancasCompostas.ts` (NOVO)
3. `src/hooks/useFaixasCotas.ts` (ATUALIZAR)

### Páginas (2 arquivos):
1. `src/pages/diretoria/FechamentoMensal.tsx` (NOVA)
2. `src/pages/financeiro/FaturamentoMensal.tsx` (ATUALIZAR)

### Componentes (4 arquivos):
1. `src/components/diretoria/ResumoFechamento.tsx` (NOVO)
2. `src/components/diretoria/DespesasPorBeneficio.tsx` (NOVO)
3. `src/components/diretoria/PreviewRateio.tsx` (NOVO)
4. `src/components/financeiro/FaturaComposicaoCard.tsx` (NOVO)

---

## 11. Cronograma Sugerido de Implementação

| Fase | Descrição | Estimativa |
|------|-----------|------------|
| 1 | Migrations e modelagem de dados | 1 sessão |
| 2 | Edge function fechamento-mensal | 1 sessão |
| 3 | Edge function calcular-rateio-completo | 1 sessão |
| 4 | Refatorar gerar-faturas-mensais | 1 sessão |
| 5 | Hooks e contextos | 1 sessão |
| 6 | Página de Fechamento Mensal | 1 sessão |
| 7 | Atualizar Faturamento Mensal | 1 sessão |
| 8 | Testes e ajustes finais | 1 sessão |

**Total estimado: 8 sessões de desenvolvimento**

---

## 12. Considerações de Segurança

- RLS em todas as novas tabelas
- Apenas `diretoria` pode aprovar fechamentos
- Logs de auditoria para todas as operações
- Validação de período (não permitir reprocessar meses antigos sem flag especial)
- Proteção contra duplicação de cobranças
