

# Perda Total — Fluxo Universal de Indenizacao

## Analise do Estado Atual

### O que ja funciona:
- **VistoriaEventoOrcamento**: regulador pode marcar "Total (>= 75% FIPE)", mas o formulario ainda exibe campos de orcamento/pecas quando Total e selecionado (deveria ocultar)
- **EmitirParecerModal**: calcula tipo_dano automaticamente baseado em 75% FIPE e rota para `aguardando_pagamento` — mas APENAS para `incendio` e `fenomeno_natural`. Colisao fica em `aprovado`
- **IniciarIndenizacaoModal**: calcula depreciacoes e cria documentos pendentes — mas a lista de documentos esta incompleta e depreciacoes sao cumulativas (deveria aplicar apenas a MAIOR)
- **CardRecuperacaoStatus**: botao "Iniciar Indenizacao" existe mas so aparece para roubo/furto (contexto de recuperacao)
- **NovaOSModal**: ja bloqueia criacao de OS para perda_total

### O que falta:
1. EmitirParecerModal deve encaminhar para `aguardando_pagamento` para TODOS os tipos com perda total (colisao incluso)
2. VistoriaEventoOrcamento deve ocultar orcamento de pecas quando tipo_dano = total
3. IniciarIndenizacaoModal precisa da lista completa de documentos de indenizacao
4. Depreciacoes devem aplicar apenas a MAIOR (nao somar)
5. Card/botao de indenizacao no SinistroDetalhe para qualquer tipo com perda total (nao so roubo/furto)
6. Informacoes do fluxo de indenizacao no detalhe do sinistro

---

## Alteracoes em Codigo

### 1. EmitirParecerModal.tsx — Perda total universal

A condicao atual na linha 126:
```
if (['incendio', 'fenomeno_natural'].includes(sinistro.tipo) && tipoDano === 'perda_total' ...)
```
Deve ser alterada para aplicar a TODOS os tipos:
```
if (tipoDano === 'perda_total' && resultado === 'aprovado')
```
Isso garante que colisao, incendio, fenomeno_natural e qualquer outro tipo com perda total va direto para indenizacao.

### 2. VistoriaEventoOrcamento.tsx — Ocultar orcamento quando total

Quando `tipoDano === 'total'`:
- Ocultar secao "Itens do Orcamento" (pecas e servicos)
- Ocultar secao "Etapas Necessarias para o Reparo"
- Manter apenas: descricao tecnica + observacoes de perda total + parecer do regulador
- Alterar label do botao de "Finalizar Vistoria e Enviar Orcamento" para "Finalizar Vistoria — Perda Total"
- Adicionar alerta visual explicando que o veiculo nao sera reparado

### 3. IniciarIndenizacaoModal.tsx — Documentos completos + regra de depreciacao

**Lista de documentos atualizada:**
- B.O. original (obrigatorio)
- CRV preenchido a favor da Pratic Car (obrigatorio)
- CRLV original (obrigatorio)
- Quitacao de IPVA e seguro obrigatorio — 2 ultimos anos (obrigatorio)
- Chaves do veiculo (obrigatorio)
- Certidao negativa de furto e multa (obrigatorio)
- Procuracao publica para a associacao (obrigatorio)
- Quitacao de financiamento (condicional — se financiado)
- Contrato social ou estatuto (condicional — se PJ)
- Nota fiscal de venda (condicional — se leilao)

**Regra de depreciacao:**
Atualmente soma todas as depreciacoes selecionadas. A regra correta e aplicar APENAS a maior. Alterar o calculo:
```
const maiorDepreciacao = Math.max(
  ...DEPRECIACOES.filter(d => depreciacoes[d.key]).map(d => d.percentual), 
  0
);
const valorFinal = valorBase * (1 - maiorDepreciacao / 100);
```

Adicionar informacao visual: "Regra: aplica-se apenas a maior depreciacao"

### 4. SinistroDetalhe.tsx — Botao de indenizacao para perda total

Adicionar na coluna lateral (right column), apos os cards existentes, um card condicional para sinistros com `tipo_dano === 'perda_total'` e status `aprovado` ou `aguardando_analise`:
- Exibir badge "Perda Total" com icone
- Botao "Iniciar Processo de Indenizacao" que abre o IniciarIndenizacaoModal
- Importar e usar IniciarIndenizacaoModal diretamente (ja existe, so falta expor no contexto correto)

Isso atende todos os tipos: colisao, incendio, fenomeno_natural e roubo/furto com recuperacao.

### 5. IniciarIndenizacaoModal.tsx — Informacoes adicionais

Adicionar secao informativa:
- Prazo: "60 dias uteis a partir da documentacao completa"
- Nota sobre GNV: "Se o veiculo tem kit gas, o associado pode retirar antes da entrega"
- Nota sobre financiamento: "Se financiado, o credor e pago primeiro, saldo restante ao associado"

---

## Resumo dos Arquivos

| Acao | Arquivo |
|---|---|
| Modificar | `src/components/eventos/EmitirParecerModal.tsx` (perda total para TODOS os tipos) |
| Modificar | `src/components/regulador/VistoriaEventoOrcamento.tsx` (ocultar orcamento quando total) |
| Modificar | `src/components/sinistros/IniciarIndenizacaoModal.tsx` (documentos completos + maior depreciacao) |
| Modificar | `src/pages/eventos/SinistroDetalhe.tsx` (card indenizacao para qualquer perda total) |

## Ordem de Implementacao

1. EmitirParecerModal — tornar perda total universal
2. VistoriaEventoOrcamento — ocultar orcamento quando total
3. IniciarIndenizacaoModal — documentos completos + regra de maior depreciacao
4. SinistroDetalhe — card/botao de indenizacao para perda total

