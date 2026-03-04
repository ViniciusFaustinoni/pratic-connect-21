

# Plano: Importar Orcamento via PDF no Parecer do Regulador

## Situacao atual

- O regulador preenche itens (pecas e servicos) manualmente um a um em `VistoriaEventoOrcamento.tsx`
- Ja existe `ImportarOrcamentoPDFModal` + edge function `extract-orcamento-pdf` que extrai pecas/servicos de PDF via IA (Gemini) — usado hoje apenas pelo analista em `CardOrcamentoReparo`
- O regulador ja seleciona etapas de reparo manualmente (lanternagem, pintura, etc.) — isso deve continuar manual

## Mudanca

Substituir o bloco de adicao manual de itens na Secao 2 do `VistoriaEventoOrcamento.tsx` por um fluxo de upload de PDF com preview editavel, reutilizando a mesma logica de extracao existente.

### Arquivo: `src/components/regulador/VistoriaEventoOrcamento.tsx`

1. **Adicionar botao "Importar PDF"** na Secao 2, acima da lista de itens
2. **Integrar logica de upload+extracao** (dropzone, upload para storage, chamar `extract-orcamento-pdf`, preview editavel)
3. **Manter botoes "+ Peca" e "+ Servico"** para ajustes manuais apos importacao
4. **Manter selecao de etapas** intacta (manual pelo regulador)
5. Ao importar o PDF, os itens extraidos populam o state `itens` existente, permitindo edicao antes de finalizar

### Fluxo do regulador

```text
Secao 2: Itens
  [Etapas de reparo - checkboxes - manual] ← sem mudanca
  
  [Importar PDF do Orcamento]  ← NOVO botao principal
     ↓ upload → IA extrai → preview editavel → confirma
     ↓ popula lista de itens
  
  [Lista de itens extraidos - editaveis]
  [+ Peca] [+ Servico]  ← mantidos para ajuste fino
```

### Detalhes tecnicos

- Reutilizar a mesma edge function `extract-orcamento-pdf` (nenhuma mudanca no backend)
- Upload do PDF para `documentos` bucket (mesmo path: `orcamentos-pdf/`)
- Converter resultado da IA para o formato `ItemParecer[]` existente
- Inline no componente (sem abrir modal separado) — exibir zona de drop com estado de processamento direto na secao

