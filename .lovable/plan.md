

# Adicionar Vídeo 360° na Autovistoria do Link Público (CotacaoPublicaCompleta)

## Problema

O fluxo de autovistoria em `CotacaoPublicaCompleta.tsx` exige apenas fotos (18 itens via `FOTOS_VISTORIA_CONFIG`). O vídeo 360° não é solicitado, diferente do fluxo em `CotacaoContratacao.tsx` que já usa o componente `Autovistoria` com vídeo integrado.

## Solução

Adicionar captura de vídeo 360° após a grade de fotos no step de vistoria auto, reutilizando o componente `VideoCapture` já existente.

### Mudanças em `src/pages/public/CotacaoPublicaCompleta.tsx`

1. **Novo estado**: `videoVistoriaUrl` e `uploadingVideo` para controlar o vídeo.

2. **Handler de upload**: Reutilizar `useUploadFotoVistoria` com tipo `video_360` para fazer upload do vídeo para o mesmo bucket `cotacoes-docs`.

3. **UI**: Após a grade de fotos (linha ~1053), adicionar o componente `VideoCapture` com label "Vídeo 360° (obrigatório)".

4. **Validação**: Alterar a condição do botão "Concluir Vistoria" de `fotos >= 10` para `fotos >= 10 && videoUrl presente`. Mesma verificação no `handleConcluirVistoria`.

5. **Contador**: Atualizar o texto do Alert para incluir status do vídeo: "X de 18 fotos • Vídeo: ✓/pendente".

6. **Reidratação**: Se o usuário voltar à página, verificar nas `fotosExistentes` se já há um registro com tipo `video_360` e restaurar o estado.

| Arquivo | Ação |
|---------|------|
| `src/pages/public/CotacaoPublicaCompleta.tsx` | Import VideoCapture, estados de vídeo, handler, UI, validação |

Nenhuma mudança de banco necessária — o upload usa a mesma tabela `cotacoes_publicas_fotos` com tipo `video_360`.

