

# Autodetecção de plano + Edge Function parse-elegibilidade-xlsx

## O que muda

1. **Nova edge function `parse-elegibilidade-xlsx`** — processa Excel server-side (código fornecido pelo usuário)
2. **Autodetecção de plano** — ao dropar o arquivo Excel, o sistema lê uma célula/aba de metadados ou o nome do arquivo para identificar automaticamente o plano correspondente
3. **UI atualizada** — remove fluxo PDF, usa edge function para Excel, exportação passa a gerar .xlsx ao invés de PDF

## Implementação

### 1. Edge Function `supabase/functions/parse-elegibilidade-xlsx/index.ts`
Criar com o código fornecido pelo usuário (serve, XLSX.read, validação de aba "Elegibilidade", validação de cabeçalho/linhas, insert no banco). Adicionar entrada em `config.toml`:
```toml
[functions.parse-elegibilidade-xlsx]
verify_jwt = false
```

### 2. Autodetecção de plano no Excel (client-side)
Ao dropar o arquivo, antes de enviar à edge function:
- Ler o Excel client-side com `XLSX.read`
- Procurar uma aba chamada **"Metadados"** ou uma célula na aba "Elegibilidade" (ex: célula `A1` com comentário, ou uma linha de metadados antes do cabeçalho)
- **Estratégia principal**: procurar aba "Metadados" com campos `PLANO_NOME` e/ou `LINHA_SLUG`
- Comparar com a lista de planos carregados e pré-selecionar o `Select` de plano
- Se não encontrar, manter seleção manual (sem bloquear)
- Exibir badge "Plano detectado: X" quando autodetectar

### 3. Atualizar `ElegibilidadeVeiculos.tsx`

**Dropzone**: aceitar apenas `.xlsx`/`.xls` (remover `.pdf`)

**Fluxo de processamento**: substituir `processarExcel` (client-side) e `processarPDF` por chamada única à edge function `parse-elegibilidade-xlsx` via fetch com FormData

**Autodetecção no `onDrop`**:
```text
onDrop → XLSX.read (client) → procurar aba "Metadados" → extrair PLANO_NOME/LINHA_SLUG → 
match com planos → setSelectedPlano automaticamente
```

**Exportação**: substituir `exportarPDF` por `exportarExcel` que gera .xlsx com:
- Aba "Elegibilidade" com dados do plano
- Aba "Metadados" com PLANO_NOME, LINHA_SLUG, GERADO_EM (permite autodetecção na reimportação)

**Modelo de download (`baixarModelo`)**: já gera xlsx — adicionar aba "Metadados" ao modelo

### 4. Remover referências ao fluxo PDF
- Remover `processarPDF`, import de `PDFDocument`, `rgb`, `StandardFonts`, `pdf-lib`
- Remover bloco `##DADOS_IMPORTACAO##`
- Manter `parse-elegibilidade-pdf` no config.toml (inativa, sem deletar)

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/parse-elegibilidade-xlsx/index.ts` | Criar (código do usuário) |
| `supabase/config.toml` | Adicionar entrada |
| `src/components/gestao-comercial/ElegibilidadeVeiculos.tsx` | Autodetecção + edge function + exportar xlsx + remover PDF |

