

# Exibir Documentos do Veiculo na Tela de Vistoria do Regulador

## Problema

Na tela de vistoria do regulador (`/regulador/vistoria/:id`), a secao "Documentos" mostra apenas o B.O. (numero, resumo e link). Os documentos do veiculo (CRLV, laudo de vistoria, etc.) armazenados na tabela `documentos` nao sao exibidos, impedindo o regulador de consulta-los durante a vistoria.

## Solucao

Buscar os documentos do veiculo na tabela `documentos` e exibi-los na secao "Documentos" do componente `VistoriaEventoDados`, com links para visualizacao.

## Alteracoes

### Arquivo 1: `src/hooks/useVistoriaEventoDetalhe.ts`

- Adicionar query para buscar documentos do veiculo na tabela `documentos` (filtrado por `veiculo_id` e/ou `associado_id` do sinistro)
- Retornar os documentos no objeto de retorno do hook

### Arquivo 2: `src/components/regulador/VistoriaEventoDados.tsx`

- Receber a nova prop `documentosVeiculo` (array de documentos)
- Na secao "Documentos", apos o B.O., renderizar a lista de documentos do veiculo
- Cada documento exibido como um card/link clicavel com:
  - Icone de arquivo
  - Nome do tipo (ex: "CRLV", "Laudo de Vistoria")
  - Badge de status (aprovado, pendente, etc.)
  - Link "Visualizar" que abre o arquivo em nova aba
- Para imagens (jpg, png), exibir thumbnail clicavel
- Para PDFs, exibir link para abrir em nova aba

### Arquivo 3: `src/pages/regulador/ExecutarVistoriaEvento.tsx`

- Passar a prop `documentosVeiculo` ao componente `VistoriaEventoDados`

## Mapeamento de tipos de documento

| Tipo no banco | Label exibido |
|---|---|
| crlv | CRLV - Documento do Veiculo |
| laudo_vistoria | Laudo de Vistoria |
| cnh | CNH |
| comprovante_residencia | Comprovante de Residencia |
| outros | Nome do arquivo original |

## Detalhes tecnicos

- A query busca em `documentos` filtrando por `veiculo_id` obtido do sinistro
- Tambem inclui documentos do `associado_id` para capturar CNH e comprovantes
- Os documentos sao exibidos abaixo do B.O. existente, agrupados visualmente
- Arquivos de imagem serao identificados pela extensao da URL (jpg, png, webp) para exibir thumbnail
- PDFs e outros formatos terao um botao "Visualizar" que abre em nova aba

