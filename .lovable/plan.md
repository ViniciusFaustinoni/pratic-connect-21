

# Permitir Substituicao de Video pelo Regulador

## Problema

Quando o regulador ja enviou um video, o botao de reset do componente `VideoCapture` limpa apenas o estado local (`previewUrl`), mas o `videoUrl` vindo do servidor continua sendo exibido. Resultado: o regulador nao consegue substituir o video.

## Solucao

Adicionar uma prop `onReset` ao `VideoCapture` que notifica o componente pai para limpar o `videoUrl`, permitindo gravar/selecionar um novo video.

## Alteracoes

### Arquivo 1: `src/components/instalador/VideoCapture.tsx`

- Adicionar prop opcional `onReset?: () => void`
- No metodo `handleReset`, chamar `onReset?.()` alem de limpar o estado local

### Arquivo 2: `src/components/regulador/VistoriaEventoMidias.tsx`

- Passar `onReset={() => onVideoChange(null)}` ao componente `VideoCapture`
- Isso limpa o `videoUrl` no estado pai, permitindo que o regulador grave/selecione um novo video que sera enviado via upload normalmente

| Arquivo | Alteracao |
|---|---|
| `src/components/instalador/VideoCapture.tsx` | Adicionar prop `onReset` e chamar no `handleReset` |
| `src/components/regulador/VistoriaEventoMidias.tsx` | Passar callback `onReset` ao `VideoCapture` |

