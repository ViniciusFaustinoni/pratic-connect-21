

# Plano de Revisao do Modulo Marketing

## Analise Comparativa: PDF vs Codigo Atual

Apos revisar detalhadamente o documento "PRD COMPLETO - MODULO MARKETING" (50 paginas) e comparar com o codigo existente, identifiquei os gaps e melhorias necessarias para alinhar o modulo com as especificacoes do PDF.

---

## RESUMO EXECUTIVO

### Status Atual por Area

| Area | Conformidade | Gaps Principais |
|------|--------------|-----------------|
| Dashboard | 85% | Falta card ROI detalhado, grafico funil, secao ultimas atividades |
| Campanhas | 90% | Falta objetivo, tipo de anuncio, segmentacao, regioes |
| Fontes de Leads | 85% | Falta categoria (Pago/Organico/Referral), utm_source padrao |
| Landing Pages | 0% | Modulo NAO implementado - tabela existe mas sem UI |
| Programa Indicacoes | 90% | Falta link personalizado por associado, evolucao mensal |
| Materiais e Criativos | 40% | Falta pagina dedicada com biblioteca, pastas, upload |
| Comunicacao em Massa | 0% | Modulo NAO implementado |
| Redes Sociais | 0% | Modulo NAO implementado |
| UTMs | 90% | Completo, ajustar labels e adicionar shortener |
| Relatorios | 85% | Falta comparativo de canais, recomendacoes automaticas |

---

## FASE 1 - ESSENCIAL (Implementar Primeiro)

### 1.1 Dashboard Marketing - Melhorias

**Arquivo:** `src/pages/marketing/MarketingDashboard.tsx`

| Item PDF | Status | Acao |
|----------|--------|------|
| Card ROI detalhado (formula correta) | Parcial | Corrigir calculo |
| Grafico Funil de Conversao | Ausente | Adicionar recharts funnel |
| Secao "Ultimas Atividades" | Ausente | Timeline de eventos recentes |
| Sub-info em cards (Pendentes, Hoje, Amanha) | Parcial | Expandir |
| Budget vs Gasto em card Investimento | Parcial | Adicionar barra progresso |

**Implementacao:**
- Adicionar calculo correto de ROI: `((Receita - Investimento) / Investimento) * 100`
- Criar componente `GraficoFunilMarketing` com as etapas: Leads → Qualificados → Cotacoes → Negociacao → Convertidos
- Adicionar timeline de ultimas atividades (leads, indicacoes, campanhas)
- Expandir card Investimento com progresso Budget vs Gasto

### 1.2 Landing Pages (NOVO MODULO)

**Criar:** `src/pages/marketing/LandingPages.tsx`

A tabela `landing_pages` ja existe no banco de dados mas nao ha interface.

**Campos existentes na tabela:**
- id, nome, slug, url, descricao
- campanha_id, template_id
- titulo_seo, descricao_seo
- visitas, leads_gerados, taxa_conversao
- status, ativo, publicada_em
- created_at, updated_at, criado_por

**UI a implementar:**
- Lista de Landing Pages em cards
- KPIs: Visitas total, Leads total, Taxa media conversao
- Cada card mostra: Titulo, URL, Visitas, Leads, Taxa, Status
- Acoes: Preview, Metricas, Editar, Duplicar
- Botao "+ Nova Landing Page"

**Hook a criar:** `useLandingPages()`

### 1.3 Materiais e Criativos (NOVO MODULO)

**Criar:** `src/pages/marketing/Materiais.tsx`

A tabela `materiais_marketing` ja existe no banco de dados, mas so e exibida na aba de detalhes de campanha.

**UI a implementar:**
- Biblioteca centralizada de materiais
- Sistema de pastas para organizacao
- Upload de arquivos (imagens, videos, PDFs)
- Grid de thumbnails com nome, tipo, dimensoes
- Filtros por tipo, pasta, campanha
- Vinculacao com campanhas

**Componentes:**
- `MateriaisGrid.tsx` - Grid de materiais
- `UploadMaterialModal.tsx` - Modal de upload
- `MaterialCard.tsx` - Card do material

---

## FASE 2 - IMPORTANTE

### 2.1 Comunicacao em Massa (NOVO MODULO)

**Criar:** `src/pages/marketing/ComunicacaoMassa.tsx`

Modulo completamente novo conforme PDF.

**Estrutura:**
- Tabs: Email | WhatsApp | SMS
- Lista de campanhas de comunicacao recentes
- KPIs: Enviados, Entregues, Abertos, Cliques
- Cada campanha mostra metricas de disparo

**Campos da campanha de comunicacao:**
| Campo | Descricao |
|-------|-----------|
| Nome | Titulo da campanha |
| Tipo | Email, WhatsApp, SMS |
| Assunto (email) | Subject do email |
| Template | Template de mensagem |
| Segmento | Associados ativos, inadimplentes, leads, etc |
| Status | Rascunho, Agendada, Enviando, Concluida |
| Data/hora agendamento | Quando disparar |

**Metricas de disparo:**
| Metrica | Email | WhatsApp | SMS |
|---------|-------|----------|-----|
| Enviados | Sim | Sim | Sim |
| Entregues | Sim | Sim | Sim |
| Bounces | Sim | Sim | Sim |
| Abertos | Sim | - | - |
| Cliques | Sim | Sim | - |
| Descadastros | Sim | - | - |
| Respostas | - | Sim | - |

**Tabelas a criar:**
```sql
CREATE TABLE campanhas_comunicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20),
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- email, whatsapp, sms
  assunto VARCHAR(500),
  template_id UUID,
  segmento VARCHAR(100),
  total_destinatarios INTEGER DEFAULT 0,
  data_agendamento TIMESTAMP,
  status VARCHAR(50) DEFAULT 'rascunho',
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE disparos_comunicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID REFERENCES campanhas_comunicacao(id),
  contato_id UUID,
  contato_tipo VARCHAR(20), -- associado, lead
  telefone VARCHAR(20),
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, enviado, entregue, falha, aberto, clicado
  erro_mensagem TEXT,
  enviado_em TIMESTAMP,
  entregue_em TIMESTAMP,
  aberto_em TIMESTAMP,
  clicado_em TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 Redes Sociais (NOVO MODULO)

**Criar:** `src/pages/marketing/RedesSociais.tsx`

Modulo completamente novo conforme PDF.

**Estrutura:**
- Cards de contas conectadas (Facebook, Instagram, LinkedIn)
- Status de conexao
- Metricas do mes (Alcance, Engajamento, Seguidores, Publicacoes)
- Botao "Conectar Conta"

**Observacao:** Este modulo depende de integracao com APIs externas (Meta Graph API, LinkedIn API). Na fase inicial, pode ser implementado apenas para exibicao manual de metricas.

**Tabelas a criar:**
```sql
CREATE TABLE redes_sociais_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma VARCHAR(50) NOT NULL, -- facebook, instagram, linkedin, tiktok
  nome_conta VARCHAR(255),
  username VARCHAR(100),
  access_token TEXT,
  refresh_token TEXT,
  token_expira_em TIMESTAMP,
  seguidores INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'conectado',
  ultima_sincronizacao TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE redes_sociais_metricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID REFERENCES redes_sociais_contas(id),
  periodo DATE NOT NULL,
  alcance INTEGER DEFAULT 0,
  impressoes INTEGER DEFAULT 0,
  engajamento INTEGER DEFAULT 0,
  novos_seguidores INTEGER DEFAULT 0,
  publicacoes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conta_id, periodo)
);
```

### 2.3 Formulario de Campanha - Campos Expandidos

**Arquivo:** `src/pages/marketing/CampanhaForm.tsx`

| Item PDF | Status | Acao |
|----------|--------|------|
| Campo Objetivo | Ausente | Adicionar select |
| Tipo de Anuncio | Ausente | Adicionar select |
| Segmentacao (publico-alvo) | Parcial | Expandir campo |
| Regioes (multi-select) | Ausente | Adicionar |
| Orcamento diario | Parcial | Ja existe |

**Novos valores para campos:**

Objetivo:
- geracao_leads (Geracao de Leads)
- branding (Branding/Awareness)
- remarketing (Remarketing)
- institucional (Institucional)

Tipo de Anuncio:
- search (Search)
- display (Display)
- video (Video)
- stories (Stories)
- feed (Feed)
- carrossel (Carrossel)
- shopping (Shopping)

---

## FASE 3 - MELHORIAS

### 3.1 Canais de Marketing

**Arquivo:** `src/pages/marketing/Canais.tsx`

| Item PDF | Acao |
|----------|------|
| Categoria (Pago/Organico/Referral) | Ja existe como "tipo" |
| utm_source padrao | Adicionar campo |
| Leads do mes | Ja existe |
| Status ativo/inativo | Ja existe |

### 3.2 Programa de Indicacoes - Melhorias

**Arquivo:** `src/pages/marketing/Indicacoes.tsx`

| Item PDF | Status | Acao |
|----------|--------|------|
| Link personalizado por associado | Ausente | Gerar link unico |
| Grafico evolucao indicacoes (12 meses) | Ausente | Adicionar recharts |
| Configuracoes avancadas | Parcial | Expandir modal |
| Regras de premiacao (adimplencia, carencia) | Parcial | Exibir no modal |

**Novo campo para gerar link:**
```
Link personalizado: sgapratic.com.br/i/{codigo-associado}
```

### 3.3 Relatorios - Melhorias

**Arquivo:** `src/pages/marketing/RelatoriosMarketing.tsx`

| Item PDF | Status | Acao |
|----------|--------|------|
| Relatorio Comparativo de Canais | Ausente | Nova aba |
| Recomendacoes automaticas | Ausente | Logica baseada em ROI |
| Tabela ROI por Campanha | Parcial | Expandir dados |
| Indicadores coloridos (verde/amarelo/vermelho) | Ausente | Adicionar |

**Logica de recomendacoes:**
- ROI > 200%: "AUMENTAR investimento"
- ROI 100-200%: "MANTER investimento"
- ROI 50-100%: "OTIMIZAR criativos"
- ROI < 50%: "PAUSAR campanha"

---

## COMPONENTES A CRIAR

| Componente | Descricao |
|------------|-----------|
| `src/pages/marketing/LandingPages.tsx` | Pagina lista landing pages |
| `src/pages/marketing/Materiais.tsx` | Biblioteca de materiais |
| `src/pages/marketing/ComunicacaoMassa.tsx` | Disparos em massa |
| `src/pages/marketing/RedesSociais.tsx` | Gestao redes sociais |
| `src/components/marketing/LandingPageCard.tsx` | Card de LP |
| `src/components/marketing/LandingPageFormModal.tsx` | CRUD LP |
| `src/components/marketing/MaterialCard.tsx` | Card de material |
| `src/components/marketing/UploadMaterialModal.tsx` | Upload material |
| `src/components/marketing/CampanhaComunicacaoModal.tsx` | Criar campanha disparo |
| `src/components/marketing/GraficoFunilMarketing.tsx` | Funil de conversao |
| `src/components/marketing/TimelineAtividades.tsx` | Timeline dashboard |

---

## ARQUIVOS A MODIFICAR

| Arquivo | Modificacoes |
|---------|-------------|
| `src/pages/marketing/MarketingDashboard.tsx` | Funil, timeline, ROI corrigido |
| `src/pages/marketing/CampanhaForm.tsx` | Objetivo, tipo anuncio, segmentacao |
| `src/pages/marketing/Indicacoes.tsx` | Link personalizado, grafico evolucao |
| `src/pages/marketing/RelatoriosMarketing.tsx` | Comparativo canais, recomendacoes |
| `src/hooks/useMarketing.ts` | Hooks para novos modulos |
| `src/App.tsx` | Novas rotas |

---

## NOVAS TABELAS SUPABASE

### campanhas_comunicacao
```sql
CREATE TABLE campanhas_comunicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20),
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('email', 'whatsapp', 'sms')),
  assunto VARCHAR(500),
  conteudo TEXT,
  template_id UUID,
  segmento VARCHAR(100),
  filtros JSONB,
  total_destinatarios INTEGER DEFAULT 0,
  enviados INTEGER DEFAULT 0,
  entregues INTEGER DEFAULT 0,
  abertos INTEGER DEFAULT 0,
  clicados INTEGER DEFAULT 0,
  falhas INTEGER DEFAULT 0,
  data_agendamento TIMESTAMP,
  iniciado_em TIMESTAMP,
  concluido_em TIMESTAMP,
  status VARCHAR(50) DEFAULT 'rascunho',
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### disparos_comunicacao
```sql
CREATE TABLE disparos_comunicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID REFERENCES campanhas_comunicacao(id) ON DELETE CASCADE,
  contato_id UUID,
  contato_tipo VARCHAR(20),
  nome VARCHAR(255),
  telefone VARCHAR(20),
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pendente',
  erro_codigo VARCHAR(50),
  erro_mensagem TEXT,
  tentativas INTEGER DEFAULT 0,
  enviado_em TIMESTAMP,
  entregue_em TIMESTAMP,
  aberto_em TIMESTAMP,
  clicado_em TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### redes_sociais_contas
```sql
CREATE TABLE redes_sociais_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma VARCHAR(50) NOT NULL,
  nome_conta VARCHAR(255),
  username VARCHAR(100),
  pagina_id VARCHAR(100),
  access_token TEXT,
  refresh_token TEXT,
  token_expira_em TIMESTAMP,
  seguidores INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'conectado',
  ultima_sincronizacao TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### redes_sociais_metricas
```sql
CREATE TABLE redes_sociais_metricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID REFERENCES redes_sociais_contas(id) ON DELETE CASCADE,
  periodo DATE NOT NULL,
  alcance INTEGER DEFAULT 0,
  impressoes INTEGER DEFAULT 0,
  engajamento INTEGER DEFAULT 0,
  novos_seguidores INTEGER DEFAULT 0,
  publicacoes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conta_id, periodo)
);
```

---

## NOVAS ROTAS

```typescript
// Marketing - Novos modulos
<Route path="/marketing/landing-pages" element={<LandingPages />} />
<Route path="/marketing/materiais" element={<Materiais />} />
<Route path="/marketing/comunicacao" element={<ComunicacaoMassa />} />
<Route path="/marketing/redes-sociais" element={<RedesSociais />} />
```

---

## DETALHES TECNICOS

### Hook useLandingPages

```typescript
export function useLandingPages() {
  return useQuery({
    queryKey: ['landing-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*, campanha:campanhas(id, nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

### Hook useCampanhasComunicacao

```typescript
export function useCampanhasComunicacao(tipo?: string) {
  return useQuery({
    queryKey: ['campanhas-comunicacao', tipo],
    queryFn: async () => {
      let query = supabase
        .from('campanhas_comunicacao')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (tipo) {
        query = query.eq('tipo', tipo);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
```

### Calculo de ROI Correto

```typescript
const calcularROI = (conversoes: number, investimento: number, ticketMedio = 500, meses = 12) => {
  const receitaEstimada = conversoes * ticketMedio * meses;
  if (investimento === 0) return 0;
  return ((receitaEstimada - investimento) / investimento) * 100;
};
```

---

## PRIORIDADES DE IMPLEMENTACAO

### Fase 1 - Essencial (Esta sessao)
1. Dashboard: Funil, timeline, ROI corrigido
2. Landing Pages: Pagina completa com CRUD
3. Materiais: Biblioteca centralizada

### Fase 2 - Modulos Novos
1. Comunicacao em Massa: Tabelas + UI
2. Redes Sociais: Tabelas + UI basica

### Fase 3 - Melhorias
1. Campanhas: Campos expandidos
2. Indicacoes: Link personalizado, grafico
3. Relatorios: Comparativo, recomendacoes

---

## INTEGRACAO ENTRE MODULOS

### Marketing -> Vendas
| Dado | Onde Aparece | Quando |
|------|--------------|--------|
| Origem do lead (UTM) | Campo "Origem" no lead | Ao criar lead |
| Campanha de origem | Campo "Campanha" no lead | Ao criar lead |
| Custo estimado do lead | Relatorio de vendas | Para calculo ROI |

### Marketing -> Financeiro
| Evento | Acao Financeiro |
|--------|-----------------|
| Premiacao indicacao | Criar conta a pagar |
| Campanha ativa | Registrar custo |

### Marketing -> App Associado
| Funcionalidade | Descricao |
|----------------|-----------|
| Minhas Indicacoes | Associado ve suas indicacoes |
| Indicar Amigo | Botao para gerar link |
| Minhas Premiacoes | Historico de premiacoes |

