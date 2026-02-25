

# Remover bloco "Servicos: {{plano.descricao}}" do Termo de Filiacao

## Problema

O template AF1 armazenado no banco de dados (`documento_templates`) contém um bloco:

```html
<p><strong>Serviços:</strong></p>
<p>{{plano.descricao}}</p>
```

Este bloco nao deveria existir no termo. Mesmo que a variavel fosse substituida corretamente, o conteudo (lista de coberturas) ja aparece em outro lugar do documento. O resultado e informacao duplicada ou, pior, a variavel aparecendo literalmente no PDF.

## Solucao

### 1. Limpeza no codigo (seguranca permanente)

**Arquivo:** `supabase/functions/_shared/template-utils.ts`

Adicionar na funcao `substituirVariaveis` (ou como pos-processamento) uma regex para remover o bloco "Servicos:" seguido de `{{plano.descricao}}` ou seu valor substituido. Isso garante que mesmo que o template do banco volte a ter esse trecho, ele sera removido automaticamente.

Regex de limpeza:
```
<p><strong>Serviços:</strong></p>\s*<p>.*?</p>
```
Aplicada apenas quando o paragrafo seguinte contem `plano.descricao` ou o conteudo de coberturas.

### 2. Limpar o template no banco de dados

Executar UPDATE no banco para remover o trecho do template AF1:

```sql
UPDATE documento_templates 
SET conteudo = REPLACE(
  REPLACE(conteudo, '<p><strong>Serviços:</strong></p>', ''),
  '<p>{{plano.descricao}}</p>', ''
)
WHERE codigo = 'AF1';
```

### 3. Deploy

Deployar `autentique-create` e `autentique-create-by-token` para aplicar a limpeza no codigo.

## Resultado

O termo de filiacao nao tera mais o bloco "Servicos" no topo, independentemente do conteudo do template no banco.
