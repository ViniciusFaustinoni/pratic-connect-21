

# Mostrar Contrato Assinado na Aba Dados Pessoais

## Problema
O card "Contrato" na aba Dados Pessoais mostra apenas dados textuais (adesão, número, vencimento, mensalidade) mas não exibe o PDF do contrato assinado, mesmo quando disponível no banco.

## Alterações

### 1. `src/hooks/useDocumentosCotacao.ts` (linha 68)
Adicionar `pdf_url, pdf_assinado_url, numero` ao select da query `useContratoDoAssociado` para que esses campos fiquem disponíveis.

### 2. `src/pages/cadastro/AssociadoDetalhe.tsx` (linhas 545-555)
Expandir o card "Contrato" para incluir:
- Um botão/link "Ver Contrato Assinado" (quando `pdf_assinado_url` existe) ou "Ver Contrato" (quando apenas `pdf_url` existe)
- Ao clicar, abre um Dialog centralizado com visualização do PDF (iframe/object) e botão de download
- Estado local `showContratoPdf` para controlar abertura do modal
- O Dialog reutiliza o mesmo padrão visual do `DocumentViewDialog` (max-w-4xl, object+iframe fallback para PDF)

### Layout do Card Contrato (atualizado)
```text
┌─────────────────────────────┐
│ Contrato                    │
│ Adesão        01/04/2026    │
│ Contrato      CTR-2026...   │
│ Vencimento    Todo dia 10   │
│ Mensalidade   R$ 180,00     │
│                             │
│ [📄 Ver Contrato Assinado]  │
└─────────────────────────────┘
```

Ao clicar, abre modal com PDF viewer + botão "Baixar".

## Impacto
- 2 arquivos alterados
- Nenhum componente novo necessário (Dialog inline no próprio arquivo)

