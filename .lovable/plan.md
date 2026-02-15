

# Corrigir exibicao de fotos, documentos e relato na tela do analista

## Problema

O backend (`salvar-etapa-evento`) salva todos os arquivos no campo `arquivos_urls` (array), mas o frontend (`SinistroAnalise.tsx`) procura por campos diferentes que nao existem:

| Etapa | Frontend espera | Banco de dados tem |
|-------|----------------|-------------------|
| Etapa 1 (fotos) | `dados_etapa1.fotos_urls` | `dados_etapa1.arquivos_urls` |
| Etapa 2 (B.O.) | `dados_etapa2.arquivo_url` (string) | `dados_etapa2.arquivos_urls` (array) |
| Etapa 3 (relato) | `dados_etapa3.texto` e `dados_etapa3.audio_url` | `dados_etapa3.relato_texto` e `dados_etapa3.arquivos_urls` |

Resultado: todos os dados aparecem vazios para o analista.

## Solucao

Atualizar o frontend em `src/pages/eventos/SinistroAnalise.tsx` para usar os nomes corretos dos campos salvos no banco.

### Alteracoes no arquivo `src/pages/eventos/SinistroAnalise.tsx`

**Etapa 1 - Fotos/Video (linhas 585-599)**
- Trocar `fotos_urls` por `arquivos_urls`
- Separar imagens de videos no array para exibir corretamente

**Etapa 2 - B.O. (linhas 608-621)**
- Trocar `arquivo_url` (string) por `arquivos_urls[0]` (primeiro item do array)

**Etapa 3 - Relato (linhas 631-640)**
- Trocar `texto` por `relato_texto`
- Trocar `audio_url` por busca no `arquivos_urls` por arquivos de audio/video (.webm, .ogg, .mp3)

### Detalhes tecnicos

Nenhuma alteracao no backend. Apenas o frontend precisa ser corrigido para ler os campos com os nomes corretos.

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/eventos/SinistroAnalise.tsx` | Linhas 585-640: corrigir nomes dos campos `fotos_urls` -> `arquivos_urls`, `arquivo_url` -> `arquivos_urls[0]`, `texto` -> `relato_texto`, `audio_url` -> filtrar audios de `arquivos_urls` |
