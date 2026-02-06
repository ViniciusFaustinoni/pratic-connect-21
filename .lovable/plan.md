
# Plano: Incluir Vídeo 360° na Lista de Documentos Anexados

## Problema Identificado

Na tela de análise de propostas pendentes, o vídeo 360° é exibido em um card separado (`Video360Card`), mas **não aparece na lista de documentos anexados** (`DocumentosAnexadosCard`). O usuário deseja que o vídeo 360° também seja listado junto aos demais documentos para facilitar a análise consolidada.

### Situação Atual

| Componente | O que exibe |
|------------|-------------|
| `DocumentosAnexadosCard` | CNH, CRLV, Comprovante, Laudo de Vistoria, Contrato |
| `Video360Card` | Vídeo 360° (separado) |

### Objetivo

Incluir o vídeo 360° na lista de documentos anexados, mantendo a visualização inline do vídeo quando clicado.

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/cadastro/DocumentosAnexadosCard.tsx` | Adicionar prop para vídeo 360° e renderizar como item especial |
| `src/pages/cadastro/PropostaAnalise.tsx` | Passar o vídeo 360° para o `DocumentosAnexadosCard` |

---

## Solução Proposta

### 1. Modificar `DocumentosAnexadosCard.tsx`

Adicionar uma nova prop opcional `video360Url` e renderizar o vídeo como um documento especial na lista:

```typescript
// Adicionar ao TIPO_DOC_CONFIG
const TIPO_DOC_CONFIG = {
  // ... configs existentes ...
  video_360: { 
    label: 'Vídeo 360° do Veículo', 
    icon: Video, 
    highlight: true 
  },
};

interface DocumentosAnexadosCardProps {
  documentos: DocumentoAnexado[];
  video360Url?: string | null; // NOVO
}
```

Criar um item especial para o vídeo 360° no início ou final da lista de documentos:

```typescript
// Se tiver vídeo 360, adicionar como primeiro item destacado
{video360Url && (
  <div
    className="flex items-center justify-between p-3 rounded-lg border 
               border-purple-500/50 bg-purple-500/5 ring-1 ring-purple-500/30 
               hover:bg-purple-500/10 cursor-pointer group"
    onClick={() => setSelectedVideo360(true)}
  >
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-purple-500/10">
        <Video className="h-4 w-4 text-purple-500" />
      </div>
      <div>
        <p className="font-medium text-sm text-foreground">
          Vídeo 360° do Veículo
        </p>
        <p className="text-xs text-muted-foreground">
          Gravado pelo vistoriador
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
        <Play className="h-3 w-3 mr-1" />
        360°
      </Badge>
    </div>
  </div>
)}
```

### 2. Adicionar Dialog de Visualização do Vídeo

Incluir um Dialog específico para reprodução do vídeo 360° quando clicado na lista:

```typescript
const [selectedVideo360, setSelectedVideo360] = useState(false);

// Dialog para Vídeo 360
<Dialog open={selectedVideo360} onOpenChange={setSelectedVideo360}>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Video className="h-5 w-5 text-purple-500" />
        Vídeo 360° do Veículo
      </DialogTitle>
    </DialogHeader>
    <div className="rounded-lg overflow-hidden bg-muted/50 border border-border">
      <video
        src={video360Url}
        controls
        className="w-full aspect-video object-contain bg-black"
        preload="metadata"
        playsInline
        autoPlay
      >
        Seu navegador não suporta a reprodução de vídeos.
      </video>
    </div>
  </DialogContent>
</Dialog>
```

### 3. Modificar `PropostaAnalise.tsx`

Passar o vídeo 360° para o componente de documentos:

```typescript
{/* Documentos Anexados - ANTES */}
<DocumentosAnexadosCard documentos={proposta.documentos || []} />

{/* Documentos Anexados - DEPOIS */}
<DocumentosAnexadosCard 
  documentos={proposta.documentos || []} 
  video360Url={proposta.vistoria?.video_360_url}
/>

{/* REMOVER o Video360Card separado (opcional - manter ambos pode ser útil) */}
```

---

## Fluxo de Visualização

```text
┌─────────────────────────────────────────────────────────────┐
│  Documentos Anexados                                    [5] │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🎥 Vídeo 360° do Veículo              [360°] NOVO   │   │
│  │     Gravado pelo vistoriador                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📄 Contrato Assinado             [Validado por IA]  │   │
│  │     06/02/2026 às 20:29                             │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📋 Laudo de Vistoria                                │   │
│  │     06/02/2026 às 20:40                             │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🆔 CNH                           [Validado por IA]  │   │
│  │     06/02/2026 às 20:20                             │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🚗 CRLV                                             │   │
│  │     06/02/2026 às 20:25                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Vídeo 360° em card separado | Vídeo 360° na lista de documentos |
| Precisa rolar para ver o vídeo | Vídeo destacado no topo da lista |
| Visualização isolada | Análise consolidada de todos os anexos |

---

## Testes Recomendados

1. Acessar uma proposta pendente que tenha vídeo 360°
2. Verificar que o vídeo aparece na lista de documentos com destaque roxo
3. Clicar no item do vídeo e confirmar que abre o player
4. Verificar que o badge "360°" aparece corretamente
5. Testar em propostas SEM vídeo 360° para garantir que não quebra

---

## Detalhes Técnicos

### Imports Necessários

No `DocumentosAnexadosCard.tsx`:
```typescript
import { Video, Play } from 'lucide-react';
```

### Contagem de Documentos

Ajustar a contagem no badge para incluir o vídeo 360°:
```typescript
<Badge variant="secondary" className="ml-2">
  {documentos.length + (video360Url ? 1 : 0)}
</Badge>
```
