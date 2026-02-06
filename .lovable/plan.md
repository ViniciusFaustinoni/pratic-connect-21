
# Plano: Incluir Vídeo 360° na Documentação da Instalação

## Problema Identificado

O vídeo 360° é capturado pelo vistoriador/instalador e armazenado corretamente na coluna `video_360_url` da tabela `vistorias`, porém **não é incluído no laudo PDF gerado** pela Edge Function `gerar-laudo-vistoria`.

### Causa Raiz

A Edge Function `gerar-laudo-vistoria`:
1. **Não busca o campo `video_360_url`** no SELECT da vistoria (linhas 194-220)
2. **Não tem lógica para referenciar o vídeo** no PDF gerado
3. Busca apenas fotos da tabela `vistoria_fotos`

### Desafio Técnico

PDFs não suportam vídeos embutidos. A solução será incluir um **QR Code** ou **link clicável** para o vídeo 360° no laudo PDF.

## Solução Proposta

### 1. Modificar a Edge Function `gerar-laudo-vistoria`

**Arquivo:** `supabase/functions/gerar-laudo-vistoria/index.ts`

#### a) Adicionar `video_360_url` ao SELECT da vistoria

```text
// Linha 197: Adicionar campo video_360_url
.select(`
  id,
  protocolo,
  created_at,
  km_atual,
  observacoes,
  status,
  video_360_url,  // NOVO
  endereco_logradouro,
  ...
`)
```

#### b) Adicionar seção de Vídeo 360° no PDF (com link)

Após a seção de observações e antes das fotos, adicionar:

```text
// Verificar se existe vídeo 360°
if (vistoria.video_360_url) {
  if (y < 150) {
    page = addPage();
    y = PAGE_HEIGHT - MARGIN - 30;
  }

  page.drawText('VÍDEO 360° DO VEÍCULO', {
    x: MARGIN,
    y,
    size: 12,
    font: fontBold,
    color: PRIMARY_COLOR,
  });

  y -= 18;

  page.drawText('Link para visualização:', {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: TEXT_COLOR,
  });

  y -= 14;

  // Desenhar o link (PDFs suportam links clicáveis)
  page.drawText(vistoria.video_360_url, {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: rgb(0, 0.4, 0.8), // Azul para indicar link
  });

  y -= 30;
}
```

### 2. Alternativa: Adicionar QR Code para o Vídeo (Opcional - Mais Elegante)

Para uma experiência melhor, podemos gerar um QR Code que aponta para o vídeo:

```text
// Usar biblioteca de QR Code para Deno
import QRCode from "https://esm.sh/qrcode@1.5.3";

// Gerar QR Code como Data URL
const qrDataUrl = await QRCode.toDataURL(vistoria.video_360_url, { 
  width: 120,
  margin: 1 
});

// Converter para bytes e embutir no PDF
const qrBytes = Uint8Array.from(atob(qrDataUrl.split(',')[1]), c => c.charCodeAt(0));
const qrImage = await pdfDoc.embedPng(qrBytes);

page.drawImage(qrImage, {
  x: MARGIN,
  y: y - 120,
  width: 100,
  height: 100,
});

page.drawText('Escaneie para assistir', {
  x: MARGIN + 110,
  y: y - 60,
  size: 9,
  font,
  color: MUTED_COLOR,
});
```

## Arquivos a Modificar

1. **`supabase/functions/gerar-laudo-vistoria/index.ts`**
   - Adicionar `video_360_url` no SELECT da vistoria (linha ~197)
   - Adicionar seção "Vídeo 360°" no PDF com link clicável
   - Opcionalmente: gerar QR Code para o vídeo

## Fluxo Atualizado

```text
1. Instalador grava vídeo 360° → Salvo em vistorias.video_360_url
2. Cliente assina → Trigger chama gerar-laudo-vistoria
3. Edge Function busca video_360_url junto com demais dados
4. PDF é gerado com seção "Vídeo 360°" contendo link clicável
5. Laudo é salvo no bucket 'documentos' e registrado
```

## Comportamento Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Vídeo 360° capturado | Não aparece no laudo | Link/QR Code no laudo |
| Sem vídeo 360° | - | Seção não exibida |

## Testes Recomendados

1. Concluir uma instalação com vídeo 360° capturado
2. Verificar se o laudo PDF gerado contém a seção de vídeo
3. Clicar no link ou escanear QR Code e verificar se abre o vídeo

## Observações Técnicas

- A solução usa link clicável em vez de embutir o vídeo (impossível em PDF)
- O QR Code é opcional mas oferece melhor UX para visualização mobile
- A biblioteca qrcode para Deno é leve e bem suportada
