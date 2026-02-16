

# Adicionar "Vidros e Farois" nas Etapas de Reparo do Regulador

## Problema

No formulario de orcamento do regulador (`VistoriaEventoOrcamento`), as etapas de reparo disponiveis sao: Lanternagem, Pintura, Mecanica, Eletrica, Polimento e Lavagem. Nao existe a opcao "Vidros e Farois", impossibilitando o regulador de identificar esse tipo de servico no orcamento.

## Solucao

### Arquivo: `src/components/regulador/VistoriaEventoOrcamento.tsx`

Adicionar uma nova entrada no array `ETAPAS_REPARO`:

```text
{ id: 'vidros_farois', nome: 'Vidros e Faróis', descricao: 'Troca ou reparo de para-brisa, vidros laterais, traseiro e faróis' }
```

A nova etapa sera inserida apos "eletrica" e antes de "polimento", pois segue a sequencia logica do reparo (eletrica cuida de farois eletricos, vidros e farois cuida da parte fisica/estrutural).

### Resultado

O regulador podera selecionar "Vidros e Farois" como etapa de reparo, e essa informacao sera salva no `dados_vistoria.etapas_reparo`, permitindo:
- Identificacao automatica de que o evento envolve vidros e farois
- Filtragem de oficinas com especialidade compativel (ja funciona via `AtribuirFornecedoresDialog`)
- Visibilidade para o Analista de Eventos na tela de analise

| Arquivo | Alteracao |
|---|---|
| `src/components/regulador/VistoriaEventoOrcamento.tsx` | Adicionar `vidros_farois` ao array `ETAPAS_REPARO` |

