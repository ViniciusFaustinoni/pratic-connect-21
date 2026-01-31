

# Plano: Gerenciador de Documentos Visual (Estilo Canva)

## Visão Geral

Este plano descreve a implementação de um **editor visual de documentos estilo Canva** integrado ao módulo de documentos existente do SGA PRATIC. O sistema permitirá criar, editar e gerenciar templates de documentos com interface drag-and-drop, vinculação automática por tipo, e geração de PDFs profissionais.

## Estado Atual do Sistema

### O que já existe:
- Tabela `documento_templates` com campos para conteúdo texto (não visual)
- Tabela `documento_categorias` com 5 categorias (Contratos, Termos, Declarações, Fichas, Comunicados)
- Tabela `documento_variaveis` com ~28 variáveis cadastradas
- Tabela `documento_gerados` para histórico
- Editor de texto simples (`TemplateEditor.tsx`) com preview markdown
- Geração de PDF via `pdf-lib` (texto puro, não visual)
- Sistema de permissões já implementado

### O que precisa ser construído:
- Tabela `document_types` (tipos fixos do sistema)
- Editor visual drag-and-drop com Fabric.js
- Sistema de vinculação template ↔ tipo
- Biblioteca de templates predefinidos
- Nova geração de PDF a partir do canvas visual
- Interface reorganizada por tipos

---

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────┐
│                    NOVA ESTRUTURA DE DOCUMENTOS                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  document_types (NOVO)      documento_templates (ATUALIZADO)    │
│  ┌──────────────────┐       ┌──────────────────────────────┐    │
│  │ code             │       │ id                           │    │
│  │ name             │◄──────│ document_type_id (FK)        │    │
│  │ required_vars[]  │       │ canvas_data (JSONB)          │    │
│  │ send_moment      │       │ is_default (boolean)         │    │
│  │ is_system        │       │ status (draft/active/default)│    │
│  └──────────────────┘       └──────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Estrutura de Dados (Banco de Dados)

### 1.1 Criar tabela `document_types`

Tipos de documento fixos do sistema (não podem ser excluídos):

| code | name | send_moment | target_audience |
|------|------|-------------|-----------------|
| `comparativo_planos` | Comparativo de Planos | Prospecção | Leads |
| `proposta_comercial` | Proposta Comercial | Negociação | Leads qualificados |
| `contrato_adesao` | Contrato de Adesão | Fechamento | Novos associados |
| `termo_vistoria` | Termo de Vistoria | Pré-adesão | Novos associados |
| `carta_boas_vindas` | Carta de Boas-Vindas | Pós-adesão | Associados |
| `certificado_cobertura` | Certificado de Cobertura | Pós-adesão | Associados ativos |
| `boleto_cobranca` | Boleto/Cobrança | Financeiro | Associados |
| `carta_cobranca` | Carta de Cobrança | Inadimplência | Inadimplentes |
| `autorizacao_servico` | Autorização de Serviço | Sinistro | Em sinistro |
| `recibo_pagamento` | Recibo de Pagamento | Financeiro | Associados |

### 1.2 Atualizar tabela `documento_templates`

Adicionar campos:
- `document_type_id` (UUID, FK para document_types)
- `canvas_data` (JSONB - estrutura do Fabric.js)
- `is_default` (boolean - template padrão do tipo)
- `status` (enum: draft, active, archived)
- `thumbnail_url` (texto - preview miniatura)

### 1.3 Criar tabela `template_versions` (versionamento)

Para manter histórico de alterações em templates críticos.

---

## Fase 2: Editor Visual (Frontend)

### 2.1 Instalar Fabric.js

```bash
npm install fabric
npm install @types/fabric --save-dev
```

### 2.2 Estrutura de Componentes

```text
src/components/documentos/
├── editor/
│   ├── CanvasEditor.tsx          # Canvas principal (Fabric.js)
│   ├── EditorToolbar.tsx         # Barra superior (salvar, desfazer, zoom)
│   ├── ElementsSidebar.tsx       # Painel esquerdo (elementos drag)
│   ├── PropertiesPanel.tsx       # Painel direito (propriedades)
│   ├── VariablesPanel.tsx        # Seletor de variáveis
│   └── elements/
│       ├── TextElement.tsx       # Elemento texto
│       ├── ShapeElement.tsx      # Formas (retângulo, círculo)
│       ├── ImageElement.tsx      # Imagens
│       ├── TableElement.tsx      # Tabelas
│       └── VariableTag.tsx       # Tag de variável {{var}}
├── templates/
│   ├── TemplatesByType.tsx       # Lista agrupada por tipo
│   ├── TemplateCard.tsx          # Card com preview miniatura
│   └── TemplateLibrary.tsx       # Biblioteca de templates
└── shared/
    └── TemplateThumbnail.tsx     # Gerador de miniatura
```

### 2.3 Estrutura do Canvas Data (Fabric.js JSON)

```typescript
interface CanvasData {
  version: string;
  objects: FabricObject[];
  background: string;
  width: number;    // 595 (A4)
  height: number;   // 842 (A4)
}

interface FabricObject {
  type: 'textbox' | 'rect' | 'circle' | 'image' | 'group';
  left: number;
  top: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  // ... propriedades do Fabric.js
  customData?: {
    variableName?: string;  // Para variáveis dinâmicas
    elementType?: string;   // Identificador custom
  };
}
```

### 2.4 Layout do Editor

```text
┌────────────────────────────────────────────────────────────────────┐
│  ← Voltar    📄 Template Proposta v2    [Salvar] [Preview] [PDF]   │
├────────┬────────────────────────────────────────────┬──────────────┤
│        │                                            │              │
│ ELEM.  │              CANVAS A4                     │ PROPRIEDADES │
│        │              (595x842)                     │              │
│ [Aa]   │         ┌──────────────────┐               │ Elemento:    │
│ Texto  │         │                  │               │ [Texto]      │
│        │         │                  │               │              │
│ [▢]    │         │   Área de        │               │ Fonte:       │
│ Formas │         │   Edição         │               │ [Inter ▼]    │
│        │         │                  │               │              │
│ [🖼️]   │         │                  │               │ Tamanho:     │
│ Imagem │         │                  │               │ [16]         │
│        │         └──────────────────┘               │              │
│ [{{}}] │                                            │ Cor:         │
│ Variav │         [−] 100% [+]                       │ [████ ▼]     │
│        │                                            │              │
└────────┴────────────────────────────────────────────┴──────────────┘
```

---

## Fase 3: Sistema de Vinculação e Tipos

### 3.1 Interface de Tipos de Documento

Nova página `/documentos/tipos` para gerenciar a vinculação:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  📋 COMPARATIVO DE PLANOS                                           │
│  ├─ Enviado para: Leads e Prospectos                                │
│  │                                                                  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │  │ ⭐ PADRÃO   │  │ Alternativo │  │     +       │               │
│  │  │ Moderno v2  │  │ Clássico    │  │   Criar     │               │
│  │  │ [Editar]    │  │ [Editar]    │  │   Novo      │               │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                      │
│  📋 PROPOSTA COMERCIAL                                              │
│  ├─ Enviado para: Leads qualificados                                │
│  │                                                                  │
│  │  ┌─────────────┐  ┌─────────────┐                                │
│  │  │ ⭐ PADRÃO   │  │     +       │                                │
│  │  │ Premium     │  │   Criar     │                                │
│  │  │ [Editar]    │  │   Novo      │                                │
│  │  └─────────────┘  └─────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Regras de Proteção

```typescript
// Ações permitidas em tipos de documento
const DOCTYPE_RULES = {
  canDelete: false,           // Nunca excluir
  canDeactivate: true,        // Pode desativar
  mustHaveDefault: true,      // Sempre deve ter um template padrão
};

// Ações permitidas em templates
const TEMPLATE_RULES = {
  deleteDefault: false,       // Não pode excluir template padrão
  archiveWithDocs: true,      // Arquiva se tem documentos gerados
  softDelete: true,           // Soft delete sempre
};
```

---

## Fase 4: Geração de PDF do Canvas

### 4.1 Nova função `useGerarPDFCanvas.ts`

```typescript
async function gerarPDFDoCanvas(
  canvasData: CanvasData,
  dados: DadosMerge
): Promise<Uint8Array> {
  // 1. Criar canvas temporário com Fabric.js
  // 2. Substituir variáveis pelos dados reais
  // 3. Renderizar canvas para imagem
  // 4. Criar PDF com jsPDF + addImage
  // 5. Retornar bytes do PDF
}
```

### 4.2 Fluxo de Geração

```text
Template (canvas_data)
       ↓
Substituir {{variáveis}} pelos dados reais
       ↓
Renderizar Fabric.js canvas → PNG/JPG
       ↓
jsPDF.addImage() → PDF A4
       ↓
Download ou Envio
```

---

## Fase 5: Biblioteca de Templates Predefinidos

### 5.1 Templates Iniciais

Criar templates profissionais para cada tipo:

| Tipo | Templates |
|------|-----------|
| Comparativo | Moderno, Clássico, Minimalista |
| Proposta | Premium, Executivo, Clean |
| Contrato | Formal, Padrão |
| Boas-Vindas | Caloroso, Institucional |
| Certificado | Elegante, Simples |

### 5.2 Estrutura da Biblioteca

```text
src/data/
└── templatesPredefinidos/
    ├── index.ts
    ├── comparativo-moderno.json
    ├── proposta-premium.json
    ├── contrato-formal.json
    └── ...
```

Cada arquivo JSON contém:
- `canvasData`: Estrutura Fabric.js
- `thumbnail`: Base64 da miniatura
- `variables`: Variáveis utilizadas

---

## Fase 6: Navegação Reorganizada

### 6.1 Nova Estrutura de Rotas

```text
/documentos
├── /visao-geral        # Dashboard com estatísticas
├── /templates
│   ├── /por-tipo       # Agrupados por tipo (padrão)
│   ├── /biblioteca     # Todos os templates
│   └── /arquivados     # Templates arquivados
├── /tipos              # Configurar tipos e vincular padrões
├── /editor/:id         # Editor visual Fabric.js
├── /gerar              # Gerar documento (existente)
└── /historico          # Documentos gerados (existente)
```

### 6.2 Menu Lateral Atualizado

```typescript
const DOCUMENTO_MENU = [
  { icon: LayoutDashboard, label: 'Visão Geral', to: '/documentos/visao-geral' },
  { icon: FileText, label: 'Templates', to: '/documentos/templates/por-tipo' },
  { icon: FolderOpen, label: 'Tipos de Documento', to: '/documentos/tipos' },
  { icon: FilePlus, label: 'Gerar Documento', to: '/documentos/gerar' },
  { icon: History, label: 'Histórico', to: '/documentos/historico' },
];
```

---

## Arquivos a Criar/Modificar

### Novos Arquivos (~25 arquivos)

| Caminho | Descrição |
|---------|-----------|
| `src/components/documentos/editor/CanvasEditor.tsx` | Canvas principal Fabric.js |
| `src/components/documentos/editor/EditorToolbar.tsx` | Toolbar do editor |
| `src/components/documentos/editor/ElementsSidebar.tsx` | Painel de elementos |
| `src/components/documentos/editor/PropertiesPanel.tsx` | Painel de propriedades |
| `src/components/documentos/editor/VariablesPanel.tsx` | Seletor de variáveis |
| `src/components/documentos/templates/TemplatesByType.tsx` | Lista por tipo |
| `src/components/documentos/templates/TemplateCardNew.tsx` | Card com miniatura |
| `src/pages/documentos/DocumentTypes.tsx` | Gerenciar tipos |
| `src/pages/documentos/VisualEditor.tsx` | Página do editor |
| `src/pages/documentos/TemplatesOverview.tsx` | Nova visão geral |
| `src/hooks/useDocumentTypes.ts` | CRUD de tipos |
| `src/hooks/useGerarPDFCanvas.ts` | Gerar PDF do canvas |
| `src/types/canvas-editor.ts` | Tipos do editor |
| `supabase/migrations/*_document_types.sql` | Migration tabela tipos |

### Arquivos a Modificar

| Caminho | Alteração |
|---------|-----------|
| `src/hooks/useDocumentoTemplates.ts` | Adicionar campos canvas_data, document_type_id |
| `src/pages/documentos/TemplateForm.tsx` | Integrar editor visual |
| `src/types/documentos.ts` | Novos tipos |
| `package.json` | Adicionar fabric |

---

## Cronograma Sugerido

| Fase | Descrição | Complexidade |
|------|-----------|--------------|
| 1 | Estrutura de Dados | Média |
| 2 | Editor Visual (Fabric.js) | Alta |
| 3 | Sistema de Vinculação | Média |
| 4 | Geração de PDF Canvas | Alta |
| 5 | Biblioteca de Templates | Baixa |
| 6 | Navegação Reorganizada | Baixa |

---

## Considerações Técnicas

### Dependências a Instalar
```bash
npm install fabric html2canvas
npm install @types/fabric --save-dev
```

### Performance
- Canvas Fabric.js é renderizado no cliente
- Miniaturas são geradas e cacheadas no Supabase Storage
- PDF é gerado via Web Worker para não bloquear UI

### Compatibilidade
- Mantém sistema atual funcionando (texto markdown)
- Templates antigos continuam válidos
- Migração gradual para templates visuais

### Segurança
- Tipos de documento são protegidos via RLS
- Validação de variáveis obrigatórias antes da geração
- Soft delete para auditoria

