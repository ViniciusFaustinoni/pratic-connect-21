
## Problema: Vídeo 360° Não Aparece para o Analista de Cadastro

### Diagnóstico

Ao analisar o código, identifiquei dois problemas:

1. **O vídeo 360° é salvo corretamente** pelo hook `useUploadVideo360` (em `src/hooks/useVistoriaCompleta.ts` linhas 283-339), que faz upload para o bucket `vistoria-videos` e atualiza o campo `video_360_url` na tabela `vistorias`.

2. **O vídeo NÃO é exibido para o analista** porque:
   - A interface `VistoriaInfo` (linha 27-35 de `usePropostasPendentes.ts`) não possui o campo `video_360_url`
   - A query de busca de vistorias (linha 276) não inclui o campo `video_360_url` no SELECT
   - O componente `VistoriaFotosCard` não renderiza o vídeo 360°

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL (COM PROBLEMA)                                                  │
├────────────────────────────────────────────────────────────────────────────┤
│ Instalador grava vídeo 360° → Upload para bucket "vistoria-videos"          │
│         ↓                                                                  │
│ Campo "video_360_url" salvo na tabela "vistorias"  ✓                        │
│         ↓                                                                  │
│ Hook "usePropostasPendentes" busca vistoria SEM campo video_360_url  ✗     │
│         ↓                                                                  │
│ Tela "PropostaAnalise.tsx" não recebe dados do vídeo                       │
│         ↓                                                                  │
│ Analista não vê o vídeo 360°                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

### Solução Proposta

Adicionar o campo `video_360_url` em toda a cadeia de dados e criar um componente para exibir o vídeo 360° para o analista:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ FLUXO CORRIGIDO                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Instalador grava vídeo 360° → Upload para bucket "vistoria-videos"          │
│         ↓                                                                  │
│ Campo "video_360_url" salvo na tabela "vistorias"  ✓                        │
│         ↓                                                                  │
│ Hook "usePropostasPendentes" busca vistoria COM campo video_360_url  ✓     │
│         ↓                                                                  │
│ Interface "VistoriaInfo" inclui campo video_360_url  ✓                     │
│         ↓                                                                  │
│ Tela "PropostaAnalise.tsx" exibe vídeo 360° em novo card  ✓                │
└────────────────────────────────────────────────────────────────────────────┘
```

### Implementação

#### 1. Atualizar Interface VistoriaInfo

**Arquivo:** `src/hooks/usePropostasPendentes.ts`

Adicionar o campo `video_360_url` na interface:

```typescript
export interface VistoriaInfo {
  id: string;
  status: string;
  tipo: string;
  modalidade?: string;
  fotos: VistoriaFotoInfo[];
  observacoes?: string | null;
  km_atual?: number | null;
  video_360_url?: string | null;  // NOVO CAMPO
}
```

#### 2. Atualizar Query de Busca

**Arquivo:** `src/hooks/usePropostasPendentes.ts`

Modificar a query para incluir `video_360_url` (linha 276):

```typescript
// Antes:
.select('id, status, modalidade, observacoes, km_atual')

// Depois:
.select('id, status, modalidade, observacoes, km_atual, video_360_url')
```

E garantir que o campo seja passado para a interface (linha 291-299):

```typescript
vistoria = {
  id: vistoriaData.id,
  status: vistoriaData.status || 'pendente',
  tipo: vistoriaData.modalidade === 'autovistoria' ? 'autovistoria' : 'agendada',
  modalidade: vistoriaData.modalidade || undefined,
  fotos: fotosVistoria as VistoriaFotoInfo[],
  observacoes: vistoriaData.observacoes,
  km_atual: vistoriaData.km_atual,
  video_360_url: vistoriaData.video_360_url,  // NOVO CAMPO
};
```

#### 3. Criar Componente Video360Card

**Arquivo:** `src/components/cadastro/Video360Card.tsx` (NOVO)

Componente para exibir o vídeo 360° para o analista:

```typescript
interface Video360CardProps {
  videoUrl: string;
}

export function Video360Card({ videoUrl }: Video360CardProps) {
  // Card com player de vídeo nativo HTML5
  // Controles de play/pause, volume, fullscreen
  // Badge "Vídeo 360° do Veículo"
}
```

#### 4. Integrar na Tela de Análise

**Arquivo:** `src/pages/cadastro/PropostaAnalise.tsx`

Adicionar o card de vídeo 360° abaixo das fotos da vistoria (após linha 752):

```typescript
{/* Vídeo 360° da Vistoria */}
{proposta.vistoria?.video_360_url && (
  <Video360Card videoUrl={proposta.vistoria.video_360_url} />
)}
```

### Arquivos a Modificar/Criar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/usePropostasPendentes.ts` | Adicionar `video_360_url` na interface e query (linhas 27-35 e 276) |
| `src/components/cadastro/Video360Card.tsx` | CRIAR: Componente para exibir vídeo 360° |
| `src/pages/cadastro/PropostaAnalise.tsx` | Adicionar card de vídeo após fotos (linha ~752) |

### Layout do Novo Card

```text
┌──────────────────────────────────────────────────────────────┐
│ 🎬 Vídeo 360° do Veículo                                     │
│ ┌────────────────────────────────────────────────────────┐   │
│ │                                                        │   │
│ │            [Player de Vídeo HTML5]                     │   │
│ │            com controles nativos                       │   │
│ │                                                        │   │
│ └────────────────────────────────────────────────────────┘   │
│ Gravado pelo vistoriador - Volta completa no veículo         │
└──────────────────────────────────────────────────────────────┘
```

### Detalhes Técnicos

- O bucket `vistoria-videos` já existe e é público (URL acessível)
- O campo `video_360_url` já existe na tabela `vistorias` (confirmado nos types)
- Player HTML5 nativo é suficiente para reproduzir arquivos `.webm`
- Nenhuma migração de banco é necessária
