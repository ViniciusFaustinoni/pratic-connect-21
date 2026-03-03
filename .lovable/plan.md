

# Documentos Visiveis na Tela Principal de Analise

## Problema
Os documentos (CNH, CRLV, Contrato Assinado, Comprovante de Residencia) ficam escondidos na aba "Docs", obrigando o analista a clicar nessa aba para visualizar, aprovar ou reprovar. Na pratica, o analista precisa alternar entre abas constantemente, o que torna o fluxo lento e propenso a erros.

## Solucao

Mover o painel `DocumentosAnexadosPanel` para **fora das tabs**, posicionando-o diretamente na pagina principal de analise (`PropostaAnalise.tsx`), entre o grid de midia e as tabs de detalhes. Assim, os documentos ficam sempre visiveis, independentemente da aba selecionada.

A aba "Docs" sera removida do `TabsList` para evitar duplicidade.

## Alteracoes

### Arquivo 1: `src/pages/cadastro/PropostaAnalise.tsx`
- Importar `DocumentosAnexadosPanel` e o tipo `DocumentoAnexadoCompleto`
- Adicionar o componente `DocumentosAnexadosPanel` entre a ZONA 2 (PropostaMidiaGrid / VistoriaObservacoesCard) e a ZONA 3 (PropostaDetalhesTabs)
- Passar as mesmas props: `documentos`, `onViewDocumento`, `onAprovarDocumento`, `onReprovarDocumento`

### Arquivo 2: `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx`
- Remover a aba "Docs" do `TabsList` (reduzir de 5 para 4 colunas: `grid-cols-4`)
- Remover o `TabsContent value="documentos"` e a importacao de `DocumentosAnexadosPanel`
- Remover props desnecessarias (`onViewDocumento`, `onAprovarDocumento`, `onReprovarDocumento`) e o import de `DocumentoAnexadoCompleto`
- Remover calculo de `totalDocumentos` e `documentosNovos` que era usado no badge da aba

## Resultado
- Documentos ficam **sempre visiveis** na pagina de analise, sem precisar clicar em nenhuma aba
- O analista pode aprovar/reprovar documentos enquanto consulta dados do cliente, veiculo ou contrato nas tabs restantes
- Tabs ficam com 4 abas: Cliente, Veiculo, Instal., Contrato

