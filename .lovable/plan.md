

# Corrigir Upload de Vídeo na Autovistoria + Botão "Seguir para Fotos"

## Problemas

1. **Upload de vídeo falha** — O bucket `cotacoes-vistoria` só permite `image/jpeg, image/png, image/webp` com limite de 5MB. Vídeos `video/webm` (ou `video/mp4`) são rejeitados pelo Storage.

2. **Sem botão para avançar após vídeo** — Quando o vídeo é enviado com sucesso, o `videoUrl` é setado e a tela automaticamente muda para a etapa de fotos (linha 262: `if (!videoUrl)`). Porém, como o upload falha, o usuário fica preso na etapa 1 sem conseguir avançar. Mesmo que funcionasse, não há feedback visual claro de "avançar" — a transição é automática.

## Correções

### 1. Migração SQL — Atualizar bucket para aceitar vídeos
Alterar o bucket `cotacoes-vistoria` para:
- Adicionar mime types: `video/mp4`, `video/webm`, `video/quicktime`
- Aumentar `file_size_limit` de 5MB para 50MB (vídeos de até 2 min)

```sql
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
  file_size_limit = 52428800
WHERE id = 'cotacoes-vistoria';
```

### 2. `src/components/cotacao-publica/AutovistoriaCotacao.tsx`
Na etapa 1 (vídeo, linhas 262-344), após o componente `<VideoCapture>`, adicionar um botão "Seguir para Fotos" que aparece quando `videoUrl` está preenchido (após upload bem-sucedido). Isso dá feedback visual claro antes da transição automática.

Na verdade, revisando o código: quando `videoUrl` é setado, o componente re-renderiza e `if (!videoUrl)` na linha 262 já faz a troca automática para a etapa 2. Isso funciona corretamente — o problema real é **apenas** o upload falhando. Uma vez que o bucket aceite vídeos, o fluxo já funciona.

Porém, para melhor UX, podemos adicionar um estado intermediário: após o vídeo ser enviado, mostrar um botão "Continuar para as Fotos" em vez de transicionar automaticamente.

**Alteração**: Adicionar estado `videoConfirmado` separado de `videoUrl`. Quando o vídeo é enviado, `videoUrl` é setado mas a tela de vídeo ainda aparece com o botão "Continuar para Fotos". Ao clicar, seta `videoConfirmado = true` e aí sim vai para etapa 2.

- Trocar a condição da linha 262 de `if (!videoUrl)` para `if (!videoConfirmado)`
- Dentro da etapa de vídeo, quando `videoUrl` existe, mostrar o botão "Continuar para as Fotos →"
- Ao reidratar vídeo existente, setar `videoConfirmado = false` para que o usuário confirme

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Nova migração SQL | Atualizar bucket para aceitar vídeos (50MB, mp4/webm/quicktime) |
| `src/components/cotacao-publica/AutovistoriaCotacao.tsx` | Adicionar botão "Continuar para Fotos" após vídeo enviado |

