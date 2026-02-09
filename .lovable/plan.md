

# Correcao Automatica de Dados do Veiculo e Melhoria do OCR

## Problema

Quando o OCR extrai dados incorretos (como a cor "VERMELHA" ao inves de "AZUL"), essa informacao errada se propaga para as tabelas `cotacoes` e `veiculos` e nao ha forma de corrigir sem acesso direto ao banco de dados.

## Solucao em 2 Partes

### Parte 1: Correcao Imediata dos Dados (SQL)

Executar os UPDATEs diretamente para corrigir o veiculo LTB4J74:

```sql
UPDATE veiculos SET cor = 'AZUL' WHERE placa = 'LTB4J74';
UPDATE cotacoes SET veiculo_cor = 'AZUL' WHERE veiculo_placa = 'LTB4J74';
```

### Parte 2: Tela de Edicao de Dados do Veiculo na Retirada

Permitir que o tecnico corrija dados do veiculo diretamente na tela de retirada quando identificar divergencia.

**Arquivo: `src/pages/instalador/ExecutarRetirada.tsx`**

Na secao de "Conferencia de Dados" (linhas 570-600), ao lado de cada campo (placa, chassi, modelo, cor), adicionar um botao de edicao que abre um input inline. Ao salvar, atualiza diretamente na tabela `veiculos` e `cotacoes`.

Mudancas:
1. Adicionar estado `editandoCampo` para controlar qual campo esta em edicao
2. Adicionar estado `valoresEditados` para armazenar valores temporarios
3. No campo "Cor", ao clicar no icone de editar, transformar o texto em um input editavel
4. Ao confirmar, chamar `supabase.from('veiculos').update({ cor: novoValor })` e tambem `supabase.from('cotacoes').update({ veiculo_cor: novoValor })`
5. Invalidar a query `servico-retirada` para refletir imediatamente

### Parte 3: Melhorar o Prompt do OCR para Cor

**Arquivo: `supabase/functions/document-ocr/index.ts`**

Na secao do CRLV (linhas 68-80), adicionar instrucoes mais especificas para extracao de cor:

```
- cor (ex: PRATA, PRETO, BRANCO, AZUL, VERMELHA, CINZA)
  IMPORTANTE: A cor esta geralmente no campo rotulado "COR" ou "COR PREDOMINANTE".
  NAO confunda com outros campos. Leia EXATAMENTE o que esta escrito no campo de cor.
  Se houver duvida, priorize o texto literal do campo "COR" no documento.
```

## Detalhes Tecnicos

### Fluxo de edicao na tela de retirada

```text
Tecnico ve dado errado
  -> Clica no icone de editar ao lado do campo
  -> Campo vira input editavel
  -> Tecnico digita o valor correto
  -> Clica em confirmar (check)
  -> Sistema atualiza tabela 'veiculos' (cor)
  -> Sistema atualiza tabela 'cotacoes' (veiculo_cor)
  -> UI atualiza automaticamente via invalidacao de query
  -> Toast de confirmacao
```

### Campos editaveis

Apenas o campo **cor** sera editavel pelo tecnico na tela de retirada, pois e o campo mais propenso a erros de OCR e o mais facil de verificar visualmente. Placa, chassi e modelo sao dados mais criticos que devem ser corrigidos pelo escritorio.

### Impacto

- Tecnico pode corrigir a cor do veiculo em campo, sem depender do escritorio
- Dados corrigidos refletem imediatamente na tela
- OCR tera instrucoes mais claras para evitar erros futuros de cor
- Nenhuma alteracao de banco de dados (schema) necessaria -- usa tabelas existentes
