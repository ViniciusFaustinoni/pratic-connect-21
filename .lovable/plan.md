
# Plano: Adicionar Vídeo 360° nos Detalhes da Instalação e Corrigir Legenda

## Problemas Identificados

### 1. Vídeo 360° não aparece na página de detalhes
A instalação tem um vídeo 360° gravado pelo vistoriador (`video_360_url` na tabela `vistorias`), mas ele não é exibido na página de detalhes.

### 2. Legenda incorreta "Fotos da Autovistoria"
Quando a vistoria foi realizada pelo vistoriador (modalidade `presencial`), a legenda deveria ser **"Fotos da Vistoria"**, não "Fotos da Autovistoria".

| Modalidade | Legenda Correta |
|------------|-----------------|
| `autovistoria` | Fotos da Autovistoria |
| `presencial` | Fotos da Vistoria |

## Solução Proposta

### 1. Modificar `src/hooks/useFotosAutovistoria.ts`

Atualizar o hook para também retornar:
- `video_360_url`: URL do vídeo 360° (se existir)
- `modalidade`: Indica se foi autovistoria ou presencial

```
// Antes
.select('id, status, modalidade')

// Depois
.select('id, status, modalidade, video_360_url')
```

```
// Retornar adicionalmente
return {
  fotos: fotos as FotoAutovistoria[],
  vistoriaId: vistoria.id,
  origem: 'vistoria_fotos',
  video360Url: vistoria.video_360_url,  // NOVO
  modalidade: vistoria.modalidade,       // NOVO
};
```

### 2. Modificar `src/pages/monitoramento/InstalacaoDetalhe.tsx`

#### a) Corrigir legenda com base na modalidade

```
// Antes (linha 456)
Fotos da Autovistoria ({totalFotos})

// Depois
{fotosData?.modalidade === 'presencial' 
  ? 'Fotos da Vistoria' 
  : 'Fotos da Autovistoria'} ({totalFotos})
```

#### b) Adicionar seção de Vídeo 360°

Adicionar o componente `Video360Card` acima da seção de fotos:

```
import { Video360Card } from '@/components/cadastro/Video360Card';

// Antes da seção de fotos, adicionar:
{fotosData?.video360Url && (
  <Video360Card videoUrl={fotosData.video360Url} />
)}
```

## Arquivos a Modificar

1. **`src/hooks/useFotosAutovistoria.ts`**
   - Adicionar `video_360_url` ao SELECT da vistoria
   - Retornar `video360Url` e `modalidade` no objeto de resultado
   - Atualizar tipo do retorno

2. **`src/pages/monitoramento/InstalacaoDetalhe.tsx`**
   - Importar `Video360Card`
   - Adicionar seção de vídeo 360°
   - Corrigir legenda "Fotos da Autovistoria" para usar lógica baseada na modalidade

## Fluxo Visual Atualizado

```text
┌──────────────────────────────────────────────────────────┐
│  Detalhes da Instalação #xxxx                            │
├──────────────────────────────────────────────────────────┤
│  [Cards existentes: Cliente, Veículo, Endereço, etc.]    │
├──────────────────────────────────────────────────────────┤
│  📹 Vídeo 360° do Veículo          ← NOVO                │
│  ┌─────────────────────────────────────────┐             │
│  │    [Player de Vídeo com controles]     │             │
│  └─────────────────────────────────────────┘             │
├──────────────────────────────────────────────────────────┤
│  📷 Fotos da Vistoria (33)     ← CORRIGIDA (era "Autovistoria")
│    ▸ Identificação                                       │
│    ▸ Exterior                                            │
│    ▸ Interior                                            │
│    ▸ Outros                                              │
├──────────────────────────────────────────────────────────┤
│  📄 Documentação (x)                                     │
└──────────────────────────────────────────────────────────┘
```

## Comportamento Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Vídeo 360° gravado | Não exibido | Card com player de vídeo |
| Vistoria presencial | "Fotos da Autovistoria" | "Fotos da Vistoria" |
| Autovistoria | "Fotos da Autovistoria" | "Fotos da Autovistoria" (mantém) |
| Sem vídeo 360° | - | Seção não exibida |

## Testes Recomendados

1. Abrir a instalação `2e3e8821-8a17-41e3-822b-b68011c73ec7` que tem vídeo 360°
2. Verificar se o vídeo é exibido com player funcional
3. Verificar se a legenda mudou para "Fotos da Vistoria"
4. Testar uma instalação com autovistoria para garantir que continua com "Fotos da Autovistoria"
