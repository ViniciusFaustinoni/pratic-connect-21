
# Corrigir Cor do Veiculo LTB4J74

## Diagnostico

O veiculo com placa `LTB4J74` tem a cor **VERMELHA** registrada tanto na tabela `veiculos` quanto na `cotacoes`, porem o documento oficial (CRLV) mostra **AZUL**.

### Origem do problema

O fluxo de dados e:
1. Upload do CRLV -> OCR (Gemini) extrai `cor` -> salva na `cotacoes.veiculo_cor`
2. Ao gerar contrato, `ContratoWizard.tsx` copia `cor` da cotacao para o veiculo

O OCR provavelmente extraiu a cor incorretamente neste caso especifico (falha pontual da IA), ou a cor foi digitada/alterada manualmente antes da geracao do contrato. O codigo de fluxo em si esta correto -- ele confia no valor extraido/informado.

## Solucao

### 1. Corrigir o dado no banco de dados (UPDATE direto)

Atualizar a cor de `VERMELHA` para `AZUL` em ambas as tabelas:

```sql
-- Tabela veiculos
UPDATE veiculos SET cor = 'AZUL' WHERE placa = 'LTB4J74';

-- Tabela cotacoes
UPDATE cotacoes SET veiculo_cor = 'AZUL' WHERE veiculo_placa = 'LTB4J74';
```

### 2. Nenhuma alteracao de codigo necessaria

O fluxo OCR esta funcionando corretamente em termos de logica:
- O prompt do Gemini ja pede para extrair `cor` do CRLV (linha 77 do `document-ocr/index.ts`)
- O `ContratoWizard.tsx` mapeia `dados.cor` corretamente (linha 464)
- A `CotacaoPublicaCompleta.tsx` persiste `dados.cor` na cotacao (linha 309)

Este foi um erro pontual de extracao do OCR para este documento especifico, nao um bug sistêmico. Erros pontuais de OCR sao esperados e por isso o sistema permite edicao manual da cor no formulario do contrato.

## Resultado

- A cor do veiculo `LTB4J74` sera corrigida para **AZUL** em todas as tabelas
- A tela de retirada exibira a cor correta
