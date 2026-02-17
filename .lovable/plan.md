
# Exibir Fotos da Vistoria de Instalacao na Tela de Analise de Sinistros

## Problema

A tela de analise de sinistros (`SinistroAnalise.tsx`) tenta exibir fotos da tabela `instalacao_fotos`, mas nesse caso nao ha registros nessa tabela. As fotos da vistoria de instalacao/adesao estao armazenadas em outro caminho: `contratos -> vistorias -> vistoria_fotos`. O hook `useFotosVistoriaPorVeiculo` ja faz essa busca e funciona corretamente na tela do analista de eventos (`EventoAnaliseDetalhe.tsx`), mas nao esta sendo usado na tela principal de analise.

## Solucao

Adicionar a busca de fotos de vistoria de adesao/instalacao na tela `SinistroAnalise.tsx` usando o hook existente `useFotosVistoriaPorVeiculo`, e exibir em um Card separado e sempre visivel (mesmo quando vazio, mostrando mensagem informativa).

## Alteracoes

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

1. **Importar o hook e helper existentes**:
   - Adicionar import de `useFotosVistoriaPorVeiculo` e `formatarTipoFotoVeiculo` de `@/hooks/useVeiculoDetalhes`

2. **Chamar o hook** apos os outros hooks existentes:
   - `const { data: fotosVistoriaAdesao } = useFotosVistoriaPorVeiculo(sinistro?.veiculo?.id);`

3. **Adicionar novo Card** na area de documentos/fotos (proximo ao card de instalacao existente, por volta da linha 824):
   - Titulo: "Fotos da Vistoria de Instalacao / Adesao"
   - Subtitulo: "Estado do veiculo registrado na vistoria de adesao para comparacao"
   - Grid 3 colunas com as fotos, exibindo o tipo formatado
   - Se vazio, exibir mensagem "Nenhuma foto de vistoria de adesao encontrada"
   - Lightbox para zoom ao clicar

4. **Manter o card existente** de `instalacaoFotos` (tabela `instalacao_fotos`) como esta, pois pode ter dados em outros sinistros. Os dois cards sao complementares.
