

# Exibir Documentação do Associado na Aprovação de Associados

## Problema

A página de detalhe da aprovação (`/monitoramento/aprovacao-associados/:id`) mostra apenas fotos da instalação, dados do associado/veículo e rastreador. Não exibe os **documentos anexados** do associado (CNH, CRLV, contrato assinado, comprovante de endereço, etc.) que estão na tabela `documentos`.

O monitoramento precisa ver toda a documentação para tomar a decisão de aprovação.

## Solução

Adicionar uma seção de **Documentos do Associado** na página `AprovacaoInstalacaoDetalhe.tsx`, buscando da tabela `documentos` pelo `associado_id` e exibindo com status, tipo e link para visualização.

## Alterações

### 1. `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`

**No hook `useServicoDetalheAprovacao`:**
- Adicionar busca na tabela `documentos` filtrando por `associado_id` do serviço
- Retornar os documentos junto com os dados existentes

**Na UI (entre a seção de Rastreador e Fotos):**
- Adicionar card "Documentação do Associado" com grid mostrando cada documento:
  - Tipo (CNH, CRLV, Contrato, etc.)
  - Status (aprovado/pendente/reprovado) com badge colorido
  - Miniatura clicável (abre no lightbox existente ou nova aba para PDFs)
  - Data de envio
- Exibir alerta se houver documentos pendentes ou reprovados (ajuda o monitoramento a decidir)

Nenhuma tabela nova, nenhuma migration. Apenas leitura de dados já existentes.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` | Buscar documentos do associado + renderizar seção |

