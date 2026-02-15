

# Mostrar documentos do link de evento na secao "Documentos" da analise

## Problema

O associado enviou documentos (fotos, B.O., audio) pelo link de auto-vistoria, mas a secao "Documentos" mostra "(0)" porque ela consulta apenas a tabela `sinistro_documentos`, que esta vazia. Os dados reais estao armazenados no campo JSON da tabela `sinistro_evento_links` (`dados_etapa1`, `dados_etapa2`, `dados_etapa3`).

Embora a secao "Fotos da Auto-Vistoria" exiba esses arquivos mais acima na pagina, a secao "Documentos" fica vazia e confusa para o analista.

## Solucao

Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

Combinar os documentos da tabela `sinistro_documentos` com os arquivos extraidos do `linkEvento` para exibir na secao "Documentos".

### Passos

1. **Criar funcao auxiliar** que extrai todos os arquivos do `linkEvento` e os converte em objetos compatíveis com a listagem de documentos:
   - `dados_etapa1.arquivos_urls` -> tipo "Foto do Veiculo" (fotos) e "Video do Veiculo" (videos)
   - `dados_etapa2.arquivos_urls` -> tipo "Boletim de Ocorrencia"
   - `dados_etapa3.arquivos_urls` -> tipo "Relato (Audio)"

2. **Mesclar com documentos existentes** da tabela `sinistro_documentos`, evitando duplicatas

3. **Atualizar o contador** no titulo do card para refletir o total real de documentos (tabela + link evento)

4. **Manter a renderizacao existente** de cada item, adaptando para suportar os campos dos documentos extraidos do link

### Detalhes tecnicos

A funcao auxiliar tera o seguinte formato:

```typescript
const extrairDocumentosDoLink = (linkEvento: any) => {
  if (!linkEvento) return [];
  const docs: any[] = [];
  
  // Etapa 1 - fotos/videos
  linkEvento.dados_etapa1?.arquivos_urls?.forEach((url: string, i: number) => {
    const isVideo = /\.(mp4|webm|mov)$/i.test(url);
    docs.push({
      id: `link-etapa1-${i}`,
      tipo: isVideo ? 'video_veiculo' : 'foto_veiculo',
      nome_arquivo: isVideo ? `Video ${i + 1}` : `Foto ${i + 1}`,
      arquivo_url: url,
      status: 'enviado',
      origem: 'link_evento',
    });
  });
  
  // Etapa 2 - B.O.
  linkEvento.dados_etapa2?.arquivos_urls?.forEach((url: string, i: number) => {
    docs.push({
      id: `link-etapa2-${i}`,
      tipo: 'boletim_ocorrencia',
      nome_arquivo: `B.O.${linkEvento.dados_etapa2.numero_bo ? ' Nº ' + linkEvento.dados_etapa2.numero_bo : ''}`,
      arquivo_url: url,
      status: 'enviado',
      origem: 'link_evento',
    });
  });
  
  // Etapa 3 - audio
  linkEvento.dados_etapa3?.arquivos_urls?.forEach((url: string, i: number) => {
    docs.push({
      id: `link-etapa3-${i}`,
      tipo: 'relato_audio',
      nome_arquivo: `Relato do Associado (Audio)`,
      arquivo_url: url,
      status: 'enviado',
      origem: 'link_evento',
    });
  });
  
  return docs;
};
```

Na secao de documentos, o array sera mesclado:

```typescript
const todosDocumentos = [...documentos, ...extrairDocumentosDoLink(linkEvento)];
// Usar todosDocumentos.length no titulo e no loop de renderizacao
```

A renderizacao tratara audios e videos de forma adequada (player de audio para `.webm/.mp3`, player de video para `.mp4`, imagem para fotos, link externo para PDFs).
