
# Adicionar EventoLinkCard na tela de Analise de Sinistro

## Problema

O analista de eventos precisa voltar a tela de detalhe do sinistro para gerar e enviar o link de auto-vistoria. Isso quebra o fluxo de trabalho.

## Solucao

Adicionar o componente `EventoLinkCard` (ja existente) na coluna direita da pagina `SinistroAnalise.tsx`, logo abaixo do card de Acoes. O componente ja recebe todas as props necessarias e o hook `useSinistroAnalise` ja retorna os dados do associado e do sinistro.

## Arquivo a modificar

**`src/pages/eventos/SinistroAnalise.tsx`**

1. Importar `EventoLinkCard` de `@/components/eventos/EventoLinkCard`
2. Adicionar o componente na coluna direita (apos o card de Acoes, ~linha 680-681), passando as props:
   - `sinistroId={id!}`
   - `sinistroProtocolo={sinistro.protocolo}`
   - `associadoWhatsapp={associado?.whatsapp || associado?.telefone}`
   - `associadoNome={associado?.nome}`
   - `sinistroTipo={sinistro.tipo}`

Nenhum arquivo novo precisa ser criado. O componente e os hooks ja existem.
