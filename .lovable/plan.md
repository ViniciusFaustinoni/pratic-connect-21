

# Corrigir bloco "Serviços: {{plano.descricao}}" no frontend

## Problema

Existem **dois caminhos** de geração de documentos:

1. **Backend** (`supabase/functions/_shared/template-utils.ts`) — já possui a regex de limpeza do bloco "Serviços:" (linhas 153-163)
2. **Frontend** (`src/hooks/useGerarDocumento.ts`, função `fazerMerge` linhas 124-147) — **NÃO possui nenhuma limpeza**. Apenas substitui variáveis e retorna.

Quando o documento é gerado pelo frontend (ex: tela "Gerar Termo", botão "Gerar PDF"), o bloco "Serviços: {{plano.descricao}}" é substituído pelo valor da variável mas o bloco "Serviços:" permanece visível, ou se a variável não existe nos dados, fica vazio mas o cabeçalho "Serviços:" persiste.

## Correção

### Arquivo: `src/hooks/useGerarDocumento.ts`

Adicionar a mesma lógica de limpeza do backend **após** a substituição de variáveis na função `fazerMerge` (após linha 144, antes do `return resultado`):

```typescript
// Remover bloco "Serviços:" residual — qualquer contexto HTML
resultado = resultado.replace(
  /<(p|div|td|li|tr)[^>]*>[\s\S]*?Servi[çc]os\s*:[\s\S]*?<\/\1>/gi,
  ''
);
resultado = resultado.replace(
  /Servi[çc]os\s*:\s*[^\n<]*/gi,
  ''
);
```

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useGerarDocumento.ts` | Adicionar regex de limpeza do bloco "Serviços:" na função `fazerMerge` |

