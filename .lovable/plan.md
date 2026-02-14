

# Fluxo de Alagamento / Fenomeno Natural

## O que ja existe

- Tipo `fenomeno_natural` registrado no NovoSinistroModal com documentos basicos
- Colunas `bombeiros_acionados`, `analise_interna`, `analise_interna_motivos` ja existem (criadas no fluxo de incendio)
- CardAnaliseIncendio como referencia de padrao para card de analise
- EmitirParecerModal ja trata perda total encaminhando para `aguardando_pagamento` (incendio) -- reutilizavel
- EventoLinkCard ja suporta etapas customizadas por tipo
- Fluxo de indenizacao integral ja implementado (roubo/furto)

## O que falta

1. Campo para classificar tipo de agua (doce/salgada) no registro
2. Documentacao obrigatoria dinamica (bombeiros acionados + fotos in loco obrigatorias)
3. Card de analise juridica especifico para alagamento
4. Etapas do Link 1 adaptadas para fenomeno natural
5. EmitirParecerModal tratar perda total de fenomeno_natural igual incendio

---

## Alteracoes no Banco de Dados

### Migracao SQL

```sql
ALTER TABLE sinistros 
  ADD COLUMN tipo_agua TEXT CHECK (tipo_agua IN ('doce', 'salgada'));
```

- `tipo_agua`: Se a agua era doce (coberto) ou salgada (analise juridica)
- As colunas `bombeiros_acionados`, `analise_interna` e `analise_interna_motivos` ja existem

---

## Alteracoes em Codigo

### 1. NovoSinistroModal.tsx -- Campos especificos para fenomeno natural

Quando tipo = `fenomeno_natural`:

- Novo state `tipoAgua` (doce/salgada)
- Toggle "Os bombeiros foram acionados?" (reutilizar o mesmo padrao do incendio -- ja existe o state `bombeirosAcionados`)
- Seletor "Tipo de agua": Agua doce / Agua salgada (mare, ressaca)
- Se agua salgada: exibir aviso "Sera encaminhado para analise juridica"
- Salvar `tipo_agua` e `bombeiros_acionados` no insert

Documentos dinamicos no passo 7:
- Fotos in loco (obrigatorio sempre)
- Se bombeiros acionados: Certidao de Ocorrencia do Corpo de Bombeiros
- Se bombeiros NAO acionados: Carta reconhecida em cartorio
- Se agua salgada: marcar automaticamente `analise_interna = true` com motivo `agua_salgada`

### 2. EventoLinkCard.tsx -- Etapas para fenomeno natural

Adicionar condicao para `fenomeno_natural`:
- Etapa 1: B.O. + Fotos do Dano
- Etapa 2: Comprovante Evento (certidao bombeiros ou carta cartorio) + Fotos In Loco
- Etapa 3: Relato Completo

### 3. Novo componente: CardAnaliseAlagamento.tsx

Card lateral no SinistroDetalhe para sinistros tipo `fenomeno_natural`, seguindo o padrao do CardAnaliseIncendio:

- Exibe tipo de agua (doce/salgada) com badge colorido
- Exibe se bombeiros foram acionados e qual documento foi exigido
- Checkboxes de verificacao:
  - "Agua salgada (mare/ressaca)" -- marca analise juridica
  - "Local inadequado (area notoriamente alagavel)" -- marca analise juridica
- Botao "Encaminhar para Analise Juridica" (diferente do incendio que e "analise interna")
- Badge visual "Em Analise Juridica" quando ativado
- Observacao: usa as mesmas colunas `analise_interna` e `analise_interna_motivos`

### 4. EmitirParecerModal.tsx -- Tratar fenomeno natural

- Adicionar `fenomeno_natural` ao lado de `incendio` na logica de perda total encaminhando para `aguardando_pagamento`
- Exibir alerta de analise interna/juridica tambem para `fenomeno_natural`

### 5. SinistroDetalhe.tsx -- Integrar CardAnaliseAlagamento

- Adicionar o CardAnaliseAlagamento na coluna lateral quando `sinistro.tipo === 'fenomeno_natural'`
- Badge "Analise Juridica" no header (reutiliza a mesma logica do "Analise Interna")

---

## Resumo dos Arquivos

| Acao | Arquivo |
|---|---|
| Migracao | Adicionar coluna `tipo_agua` em `sinistros` |
| Modificar | `src/components/eventos/NovoSinistroModal.tsx` (toggle bombeiros + tipo agua + docs dinamicos) |
| Modificar | `src/components/eventos/EventoLinkCard.tsx` (etapas para fenomeno natural) |
| Modificar | `src/components/eventos/EmitirParecerModal.tsx` (perda total + alerta juridico) |
| Modificar | `src/pages/eventos/SinistroDetalhe.tsx` (integrar CardAnaliseAlagamento) |
| Criar | `src/components/sinistros/CardAnaliseAlagamento.tsx` (analise juridica + tipo agua) |

## Ordem de Implementacao

1. Migracao SQL (coluna `tipo_agua`)
2. NovoSinistroModal -- toggle bombeiros (reutilizar) + seletor tipo agua + docs dinamicos + auto-marcar analise juridica para agua salgada
3. EventoLinkCard -- etapas adaptadas para fenomeno natural
4. CardAnaliseAlagamento -- verificacoes agua salgada/local inadequado + encaminhar analise juridica
5. EmitirParecerModal -- perda total para indenizacao + alerta analise juridica
6. SinistroDetalhe -- integrar CardAnaliseAlagamento na coluna lateral

