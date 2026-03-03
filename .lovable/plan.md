

# Plano: Regulador envia PDF e IA preenche o orcamento automaticamente

## Situacao atual
- Ja existe a edge function `extract-orcamento-pdf` que usa Gemini para extrair pecas/servicos de PDFs
- Ja existe o `ImportarOrcamentoPDFModal` com upload, preview editavel e importacao em lote
- Porem, o fluxo atual exige que o regulador primeiro crie o orcamento (tipo cotacao_separada) e depois clique em "Importar PDF" como acao secundaria
- O regulador tambem precisa informar **etapas necessarias** manualmente (isso nao muda)

## Mudanca proposta
Tornar o upload de PDF o **fluxo principal** para o regulador criar o orcamento. Quando o regulador (canEdit=true, nao e diretor/analista) clica em "Criar Orcamento":

1. Em vez de mostrar `EscolhaTipoOrcamentoModal`, mostrar diretamente o modal de upload de PDF
2. Ao importar os itens extraidos, o sistema automaticamente cria o orcamento (tipo `cotacao_separada`) e insere todos os itens de uma vez
3. O botao "Importar PDF" continua disponivel para re-importar ou complementar depois
4. Etapas necessarias continuam manuais (sem alteracao)

## Ajustes no CardOrcamentoReparo.tsx

Quando `canEdit && !canChooseType` (regulador) e nao existe orcamento:
- Mostrar botao "Enviar Orcamento (PDF)" em vez de "Criar Orcamento"
- Ao clicar, abrir `ImportarOrcamentoPDFModal` com uma variante que cria o orcamento automaticamente antes de importar os itens

## Ajustes no ImportarOrcamentoPDFModal.tsx

Adicionar prop opcional `sinistroId` + `autoCreate`:
- Se `autoCreate=true` e `sinistroId` fornecido, o modal cria o orcamento (`cotacao_separada`) no momento da importacao, antes de inserir os itens
- Sem mudancas na UX de preview — regulador ainda revisa/edita antes de confirmar

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/components/orcamento/CardOrcamentoReparo.tsx` | Mostrar botao PDF para regulador, fluxo direto |
| `src/components/orcamento/ImportarOrcamentoPDFModal.tsx` | Adicionar modo `autoCreate` que cria orcamento + importa itens |

## Sem mudancas em
- Edge function `extract-orcamento-pdf` (ja funciona)
- Etapas de reparo (continuam manuais)
- Fluxo do diretor/analista (continua com EscolhaTipoOrcamentoModal)

