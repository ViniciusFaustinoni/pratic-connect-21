## ERRO 10 — Centralizar `DocumentoAnexado`

### Situação atual

Três formas convivendo:

| Local | Nome | Campos diferenciais |
|---|---|---|
| `src/types/documentos.ts` | `DocumentoAnexadoCompleto` | tipo tipado (`TipoDocumentoAnexo`), status tipado (`StatusDocumento`), `nome_arquivo`, campos Autentique (`assinado_em`, `autentique_id`, `validado_autentique`...) e análise (`analisado_por`, `motivo_reprovacao`...) |
| `src/hooks/usePropostasPendentes.ts` | `DocumentoAnexado` (exportada) | `arquivo_nome`, `tipo: string`, `status: string` — usada em ~10 pontos do hook |
| `src/components/cadastro/DocumentosAnexadosCard.tsx` | `DocumentoAnexado` (local) | adiciona `ocr_resultado` (com `dados` OCR) e **não** tem `arquivo_nome` |

Resultado: o hook entrega objetos com `arquivo_nome` que o componente nem declara, e o componente espera `ocr_resultado` que não está tipado no hook — funciona porque ambos são `string`/`any` na borda, mas qualquer campo novo entra silenciosamente como `undefined`.

### Correção

**1. Em `src/types/documentos.ts`** — adicionar um tipo canônico unificado para uso operacional no Cadastro, ao lado do `DocumentoAnexadoCompleto` (que continua sendo o "rico", com campos Autentique/análise):

```ts
export interface DocumentoAnexadoOcr {
  validado_ocr?: boolean;
  dados?: {
    nome?: string; numero_registro?: string; rg?: string; validade?: string;
    cor?: string; combustivel?: string; motor?: string;
    placa?: string; renavam?: string; chassi?: string;
  };
  [key: string]: unknown;
}

export interface DocumentoAnexado {
  id: string;
  tipo: string;              // mantém string para compat com dados vindos do banco
  arquivo_url: string;
  arquivo_nome?: string | null;
  status: string;
  created_at: string;
  ocr_resultado?: DocumentoAnexadoOcr;
}
```

União de superset: cobre os campos usados pelo hook **e** pelo componente. Não quebra nada porque todos os campos extras são opcionais.

**2. Em `src/hooks/usePropostasPendentes.ts`**
- Remover a definição local de `DocumentoAnexado` (linhas 14–21).
- `import type { DocumentoAnexado } from '@/types/documentos';` e re-exportar (`export type { DocumentoAnexado }`) para preservar imports atuais (`import { DocumentoAnexado } from '@/hooks/usePropostasPendentes'`).

**3. Em `src/components/cadastro/DocumentosAnexadosCard.tsx`**
- Remover as interfaces locais `DocumentoDadosOCR` e `DocumentoAnexado` (linhas 26–52).
- `import type { DocumentoAnexado } from '@/types/documentos';`

**4. Não mexer em `DocumentoAnexadoCompleto`** — ele segue usado por `DocumentosAnexadosPanel` / `DocumentoAnexadoCard` no fluxo de Documentações Anexadas com Autentique, que tem semântica diferente (aprovação manual, status tipado). Apenas documentar com JSDoc que `DocumentoAnexado` é a versão "fila Cadastro/operacional" e `DocumentoAnexadoCompleto` é a versão "painel Autentique".

### Escopo / risco

- Apenas tipos. Zero mudança de comportamento.
- Re-export do hook mantém compatibilidade com qualquer consumidor que importe `DocumentoAnexado` de `@/hooks/usePropostasPendentes`.
- Build TS valida que nenhum consumidor quebra.

### Arquivos tocados

- `src/types/documentos.ts` (+novo tipo canônico)
- `src/hooks/usePropostasPendentes.ts` (import + re-export)
- `src/components/cadastro/DocumentosAnexadosCard.tsx` (import)
