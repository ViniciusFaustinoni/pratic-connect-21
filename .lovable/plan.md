

# Reformular Orçamento do Regulador: PDF como Entrada Principal

## Situacao Atual

Ja existe a tela `VistoriaEventoOrcamento.tsx` que permite ao regulador importar PDF com extracao por IA. Porem:
- O upload de PDF e apenas uma opcao secundaria dentro do fluxo de vistoria
- O regulador precisa preencher muitos campos manualmente antes de chegar ao PDF
- Na tela de oficina (`ReguladorOficina.tsx`), o orcamento aparece colapsado via `CardOrcamentoReparo`, sem opcao de upload de PDF

A imagem enviada mostra a tela de detalhe do associado Marcus Vinicius — nao ha relacao direta com o orcamento do regulador, mas confirma que o associado esta ativo.

## Plano de Alteracoes

### 1. Reorganizar `VistoriaEventoOrcamento.tsx` — PDF como passo principal

- **Inverter a ordem da Secao 2**: O dropzone de PDF aparece PRIMEIRO, antes da lista de itens
- Apos upload e extracao, os itens aparecem ja preenchidos para revisao
- Botoes "Adicionar Peca/Servico" ficam como opcao secundaria abaixo dos itens extraidos
- **Etapas de reparo**: Continuam manuais (checkboxes), posicionadas ANTES do upload de PDF
- Remover o texto "Valores estimados com base na sua experiencia" e substituir por "Envie o PDF do orcamento para preenchimento automatico"

### 2. Adicionar acesso ao orcamento via PDF na tela `ReguladorOficina.tsx`

- Nos cards de OS com status `aguardando_orcamento` ou `em_execucao`, adicionar botao "Enviar Orcamento PDF"
- Ao clicar, abre um dialog simplificado com:
  - Dropzone para PDF (reutiliza a mesma logica de upload + edge function `extract-orcamento-pdf`)
  - Selecao de etapas de reparo (checkboxes manuais)
  - Revisao dos itens extraidos
  - Botao salvar que grava no `orcamento_reparo` do sinistro vinculado

### 3. Criar componente reutilizavel `OrcamentoPDFImport`

Extrair a logica de upload/extracao de `VistoriaEventoOrcamento.tsx` para um componente isolado:
- Props: `onItensExtraidos(itens)`, `disabled`
- Contem: dropzone, estados de loading/sucesso, chamada a edge function
- Reutilizado tanto no `VistoriaEventoOrcamento` quanto no novo dialog da `ReguladorOficina`

### Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `src/components/regulador/OrcamentoPDFImport.tsx` | **Novo** — componente reutilizavel de upload PDF + extracao IA |
| `src/components/regulador/VistoriaEventoOrcamento.tsx` | Refatorar: usar `OrcamentoPDFImport`, reordenar secoes |
| `src/pages/regulador/ReguladorOficina.tsx` | Adicionar botao "Enviar Orcamento PDF" + dialog com import e etapas |

### Fluxo resultante para o regulador

```text
Regulador abre OS na aba Oficina
  → Clica "Enviar Orcamento PDF"
  → Dialog abre:
      1. Seleciona etapas de reparo (checkboxes)
      2. Faz upload do PDF
      3. IA extrai pecas e servicos automaticamente
      4. Regulador revisa itens extraidos (pode editar/remover)
      5. Clica "Salvar Orcamento"
  → Dados gravados no orcamento_reparo do sinistro
```

A edge function `extract-orcamento-pdf` ja existe e nao precisa de alteracoes.

