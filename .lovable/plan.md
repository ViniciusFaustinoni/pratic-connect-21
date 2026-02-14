
# Fluxo Especifico de Incendio

## O que ja existe

- Tipo `incendio` registrado normalmente no NovoSinistroModal
- Documentos obrigatorios incluem `laudo_bombeiros` (fixo como obrigatorio)
- EmitirParecerModal calcula automaticamente `perda_total` vs `parcial` baseado na regra 75% FIPE
- Quando perda total, veiculo e inativado automaticamente
- Campo `motivo_analise_interna` ja existe na tabela `sinistros`
- Fluxo de indenizacao integral ja foi implementado no roubo/furto (reutilizavel)

## O que falta

1. **Campo "bombeiros acionados?" no registro** -- Dinamizar documentacao obrigatoria
2. **Verificacoes especiais na analise** -- GNV irregular e sobrecarga eletrica com encaminhamento para analise interna
3. **Perda total encaminha para indenizacao** -- Ja funciona via EmitirParecerModal, mas precisa redirecionar para o fluxo de indenizacao ao inves de simplesmente inativar o veiculo

---

## Alteracoes no Banco de Dados

### Migracoes SQL

```sql
ALTER TABLE sinistros 
  ADD COLUMN bombeiros_acionados BOOLEAN,
  ADD COLUMN analise_interna BOOLEAN DEFAULT false,
  ADD COLUMN analise_interna_motivos TEXT[];
```

- `bombeiros_acionados`: Se os bombeiros foram acionados (define qual documento exigir)
- `analise_interna`: Se o sinistro foi encaminhado para analise interna
- `analise_interna_motivos`: Array com motivos (ex: `['gnv_irregular', 'sobrecarga_eletrica']`)

---

## Alteracoes em Codigo

### 1. NovoSinistroModal.tsx -- Campo "Bombeiros acionados?" e documentos dinamicos

Quando tipo = `incendio`, exibir:
- Toggle "Os bombeiros foram acionados?" (Sim/Nao)
- Se Sim: documento obrigatorio = "Certidao de Ocorrencia do Corpo de Bombeiros"
- Se Nao: documento obrigatorio = "Carta reconhecida em cartorio explicando circunstancias"

Atualizar `DOCUMENTOS_OBRIGATORIOS.incendio` para ser dinamico baseado na resposta. Salvar `bombeiros_acionados` no insert do sinistro.

### 2. EventoLinkCard.tsx -- Etapas para incendio

Incendio segue o mesmo fluxo base de colisao (3 etapas: Auto Vistoria, B.O., Relato), sem alteracao necessaria. As etapas genericas ja funcionam.

### 3. Novo componente: CardAnaliseIncendio.tsx

Card que aparece na coluna lateral do SinistroDetalhe para sinistros tipo `incendio` (visivel apenas na fase de analise ou posterior):

- Exibe se bombeiros foram acionados e qual documento foi enviado
- Checkboxes de verificacao especial:
  - "GNV irregular (sem documentacao)" -- nao nega, marca analise interna
  - "Sobrecarga eletrica (modificacoes/som)" -- nao nega, marca analise interna
- Botao "Encaminhar para Analise Interna" com selecao de motivos
- Quando ativado, atualiza `analise_interna = true` e `analise_interna_motivos` no sinistro
- Badge visual no detalhe indicando "Em Analise Interna"

### 4. EmitirParecerModal.tsx -- Verificacao antes de emitir parecer

Quando tipo = `incendio` e `analise_interna = true`:
- Exibir alerta: "Este sinistro esta em analise interna. Motivos: [lista]"
- Permitir emitir parecer normalmente (a analise interna ja foi concluida)

Quando tipo = `incendio` e resultado = `aprovado` e `tipo_dano = perda_total`:
- Alem de inativar veiculo (ja existente), mudar status para `aguardando_pagamento` em vez de `aprovado`
- Reutilizar o fluxo de indenizacao integral implementado no roubo/furto

### 5. SinistroDetalhe.tsx -- Integrar CardAnaliseIncendio

Adicionar o CardAnaliseIncendio na coluna lateral quando `sinistro.tipo === 'incendio'`.

---

## Resumo dos Arquivos

| Acao | Arquivo |
|---|---|
| Migracao | Adicionar colunas `bombeiros_acionados`, `analise_interna`, `analise_interna_motivos` |
| Modificar | `src/components/eventos/NovoSinistroModal.tsx` (toggle bombeiros + documentos dinamicos) |
| Modificar | `src/components/eventos/EmitirParecerModal.tsx` (alerta analise interna + perda total para indenizacao) |
| Modificar | `src/pages/eventos/SinistroDetalhe.tsx` (integrar CardAnaliseIncendio) |
| Criar | `src/components/sinistros/CardAnaliseIncendio.tsx` (verificacoes especiais + encaminhar analise interna) |

## Ordem de Implementacao

1. Migracao SQL (3 colunas)
2. NovoSinistroModal -- toggle bombeiros + documentos dinamicos
3. CardAnaliseIncendio -- verificacoes GNV/sobrecarga + analise interna
4. EmitirParecerModal -- alerta analise interna + perda total para indenizacao
5. SinistroDetalhe -- integrar CardAnaliseIncendio
