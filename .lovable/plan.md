
# Plano: Redesign Completo da Página de Análise de Proposta

## Problema Identificado

A página atual de "Análise de Proposta" possui os seguintes problemas de UX/UI:

| Problema | Impacto |
|----------|---------|
| Falta de hierarquia visual | Difícil identificar informações mais importantes |
| Cards muito semelhantes | Sem diferenciação clara entre seções |
| Status escondido na lateral | O elemento mais importante está pequeno |
| Muita rolagem necessária | Informações espalhadas em cards separados |
| Ações distantes do contexto | Botões de ação estão no final da coluna direita |
| Fotos da vistoria ocupam muito espaço | Lista longa sem condensação |

---

## Nova Arquitetura Visual

### Layout Proposto: 3 Zonas Hierárquicas

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ZONA 1: HEADER HERO (Status + Resumo + Ações Principais)                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ← Voltar    #CTR-20260206202652                           [Próxima →]  ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │  🟡 AGUARDANDO ANÁLISE                                                  ││
│  │                                                                          ││
│  │  Marcus Vinicius Faustinoni de Freitas                                  ││
│  │  Toyota Corolla Xei 2013 • LTB4J74 • Azul                               ││
│  │                                                                          ││
│  │  [✓ Aprovar]  [📄 Solicitar Docs]  [✕ Reprovar]                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ZONA 2: EVIDÊNCIAS VISUAIS (Grid de Mídia)                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│  │  📹 Vídeo 360°       │  │  📸 33 Fotos         │  │  ✍️ Assinatura     │ │
│  │  [Thumbnail/Play]    │  │  [Grid 4 thumbs]     │  │  [Preview]         │ │
│  │                      │  │  + Ver todas →       │  │                    │ │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ZONA 3: DETALHES (Tabs Organizadas)                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [Cliente]  [Veículo]  [Documentos]  [Instalação]  [Contrato]          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  Conteúdo da aba selecionada (compacto, dados lado a lado)              ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes a Criar/Modificar

### 1. Novo: `PropostaHeroHeader`

Card principal no topo com:
- Status grande e destacado (badge colorido)
- Nome do cliente + dados resumidos do veículo
- Botões de ação principais (aprovar/solicitar/reprovar) inline
- Navegação rápida (voltar/próxima)

### 2. Novo: `PropostaMidiaGrid`

Grid horizontal com 3 cards de mídia:
- **Vídeo 360°**: Thumbnail com botão play, destaque roxo
- **Galeria de Fotos**: Grid 2x2 com thumbnails, badge de contagem, expandir
- **Assinatura**: Preview da assinatura com badge de validação

### 3. Novo: `PropostaDetalhesTabs`

Organização em abas para reduzir rolagem:
- **Cliente**: Nome, CPF, telefone, email, endereço
- **Veículo**: Marca, modelo, ano, placa, cor, RENAVAM, chassi
- **Documentos**: Lista de documentos anexados com status
- **Instalação**: Dados do rastreador, instalador, data
- **Contrato**: Número, plano, valor, data assinatura, vendedor

---

## Detalhes Técnicos

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/cadastro/proposta/PropostaHeroHeader.tsx` | Header hero com status e ações |
| `src/components/cadastro/proposta/PropostaMidiaGrid.tsx` | Grid de evidências visuais |
| `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` | Tabs de detalhes organizados |
| `src/components/cadastro/proposta/GaleriaFotosModal.tsx` | Modal fullscreen para galeria |

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/cadastro/PropostaAnalise.tsx` | Refatorar para usar novos componentes |

---

## Redesign do Header Hero

```typescript
// PropostaHeroHeader.tsx
interface PropostaHeroHeaderProps {
  proposta: PropostaPendente;
  onAprovar: () => void;
  onSolicitarDocs: () => void;
  onReprovar: () => void;
  onVoltar: () => void;
  onProxima?: () => void;
  isLoading?: boolean;
}
```

Visual:
- Background gradiente sutil baseado no status
- Status em badge grande centralizado
- Dados do cliente/veículo em tipografia clara
- Botões de ação com ícones e cores semânticas

---

## Redesign do Grid de Mídia

Layout responsivo 3 colunas (desktop) / stack (mobile):

**Card Vídeo 360°:**
- Thumbnail do primeiro frame ou placeholder
- Overlay com ícone play
- Borda roxa destacada
- Click abre modal de vídeo

**Card Galeria de Fotos:**
- Grid 2x2 com 4 thumbnails principais
- Badge com contagem total
- Categorias como chips (Exterior, Interior, etc.)
- Click abre modal galeria fullscreen

**Card Assinatura:**
- Preview da assinatura em miniatura
- Badge "Coletada na Vistoria"
- Data e responsável
- Click abre modal ampliado

---

## Redesign das Tabs de Detalhes

Usar o componente `Tabs` existente do Radix:

```typescript
<Tabs defaultValue="cliente">
  <TabsList className="grid w-full grid-cols-5">
    <TabsTrigger value="cliente">Cliente</TabsTrigger>
    <TabsTrigger value="veiculo">Veículo</TabsTrigger>
    <TabsTrigger value="documentos">
      Documentos
      <Badge className="ml-1">{totalDocs}</Badge>
    </TabsTrigger>
    <TabsTrigger value="instalacao">Instalação</TabsTrigger>
    <TabsTrigger value="contrato">Contrato</TabsTrigger>
  </TabsList>
  
  <TabsContent value="cliente">
    {/* Grid 2 colunas com dados */}
  </TabsContent>
  {/* ... outras tabs */}
</Tabs>
```

---

## Benefícios do Redesign

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Hierarquia** | Todos os cards iguais | 3 zonas com prioridades |
| **Status** | Pequeno na lateral | Grande e destacado no topo |
| **Ações** | Escondidas no final | Visíveis no header |
| **Rolagem** | Muita rolagem | Tabs condensam informação |
| **Evidências** | Espalhadas | Grid organizado |
| **Mobile** | Layout quebrado | Responsivo stack |

---

## Paleta de Cores por Status

| Status | Cor Principal | Background |
|--------|---------------|------------|
| Aguardando Análise | `warning` (amarelo) | `bg-warning/10` |
| Em Análise | `info` (azul) | `bg-info/10` |
| Aprovado | `success` (verde) | `bg-success/10` |
| Reprovado | `destructive` (vermelho) | `bg-destructive/10` |

---

## Implementação em Fases

### Fase 1: Novo Layout Base
- Criar estrutura de 3 zonas
- Implementar `PropostaHeroHeader`
- Mover botões de ação para o header

### Fase 2: Grid de Mídia
- Implementar `PropostaMidiaGrid`
- Criar `GaleriaFotosModal` com navegação
- Integrar vídeo 360° no grid

### Fase 3: Tabs de Detalhes
- Implementar `PropostaDetalhesTabs`
- Migrar conteúdo dos cards para tabs
- Condensar informações repetidas

### Fase 4: Polish
- Animações de transição
- Skeleton states aprimorados
- Testes de responsividade

---

## Wireframe Mobile

```text
┌─────────────────────────────┐
│  ← #CTR-20260206      [→]  │
├─────────────────────────────┤
│      🟡 AGUARDANDO          │
│                             │
│  Marcus Vinicius F. Freitas │
│  Corolla 2013 • LTB4J74     │
├─────────────────────────────┤
│ [Aprovar] [Docs] [Reprovar] │
├─────────────────────────────┤
│  ┌───┐  ┌───┐  ┌───┐       │
│  │360│  │📷33│ │✍️ │       │
│  └───┘  └───┘  └───┘       │
├─────────────────────────────┤
│ [Cliente][Veículo][Docs]... │
├─────────────────────────────┤
│                             │
│  Conteúdo da tab            │
│                             │
└─────────────────────────────┘
```

---

## Alertas e Reanálise

O banner de "Reanálise Necessária" será movido para dentro do `PropostaHeroHeader` como um alert destacado:

```typescript
{proposta.documentos_solicitados_enviados?.length > 0 && (
  <div className="bg-amber-500/20 border-l-4 border-amber-500 p-4 rounded-r-lg">
    <div className="flex items-center gap-2">
      <RefreshCw className="h-5 w-5 text-amber-500" />
      <span className="font-medium">Reanálise Necessária</span>
      <Badge>{proposta.documentos_solicitados_enviados.length} novo(s)</Badge>
    </div>
  </div>
)}
```

---

## Resultado Esperado

Uma página de análise mais:
- **Intuitiva**: Hierarquia clara de informações
- **Visual**: Evidências fotográficas em destaque
- **Eficiente**: Menos rolagem, ações sempre visíveis
- **Bonita**: Design moderno com gradientes e animações sutis
