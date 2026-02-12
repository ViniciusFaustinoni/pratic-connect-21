
# Correcao do Termo de Afiliacao - Variaveis Nao Mapeadas, Logo e Tabelas

## Problemas Identificados

Comparando o PDF real assinado com o template no banco de dados e o codigo de substituicao de variaveis, foram encontrados os seguintes erros:

### 1. Variaveis nao mapeadas (aparecem cruas no PDF)
O template no banco usa variaveis que **nao existem** no mapeamento (`criarMapeamentoVariaveis` em `template-utils.ts`):

| Variavel no template | Status | Causa |
|---|---|---|
| `{{associado.whatsapp}}` | NAO MAPEADA | Nao existe no `criarMapeamentoVariaveis()` |
| `{{veiculo.tipo}}` | NAO MAPEADA | Existe `veiculo.tipo_uso` mas NAO `veiculo.tipo` |
| `{{plano.descricao}}` | NAO MAPEADA | Nao existe no mapeamento |
| `{{veiculo.codigo_fipe}}` | OK | Ja mapeada corretamente |

### 2. Logo ausente no cabecalho
O cabecalho do documento gerado usa apenas texto "ABP PRATICCAR" em vez de uma imagem de logo. O PDF real mostra que deveria ter o logo da empresa.

### 3. Tabelas HTML nao renderizadas corretamente
O template agora e salvo como HTML rico (com `<table>` do TipTap), mas a funcao `markdownParaHTML()` no edge function trata o conteudo como se fosse markdown puro, aplicando transformacoes que **quebram as tabelas HTML existentes**. Especificamente, a funcao envolve linhas que nao comecam com `<` em tags `<p>`, o que pode corromper o HTML das tabelas.

### 4. Variaveis do VariaveisSelector desalinhadas com o backend
O `VariaveisSelector.tsx` lista variaveis como `plano.descricao`, `plano.franquia`, `associado.whatsapp`, `veiculo.tipo` que nao existem no mapeamento do backend, criando uma experiencia confusa para o usuario.

---

## Plano de Correcao

### Etapa 1: Adicionar variaveis faltantes no backend
**Arquivo: `supabase/functions/_shared/template-utils.ts`**

Adicionar ao `criarMapeamentoVariaveis()`:
- `associado.whatsapp` - mapear para `dados.cliente.telefone` (ou `telefone_secundario` se disponivel)
- `veiculo.tipo` - mapear para `dados.veiculo.categoria` (Automovel, Moto, etc.)
- `plano.descricao` - mapear para as coberturas do plano formatadas como lista legivel
- `plano.valor_base` - mapear para o valor mensal do contrato
- `plano.cobertura_fipe` - mapear para percentual de cobertura

### Etapa 2: Corrigir `markdownParaHTML()` para respeitar HTML existente
**Arquivo: `supabase/functions/_shared/template-utils.ts`**

A funcao `markdownParaHTML()` precisa detectar se o conteudo ja e HTML rico (contem tags `<table>`, `<strong>`, etc.) e, nesse caso, **nao aplicar conversao markdown**. O conteudo do TipTap ja e HTML valido e deve ser passado diretamente.

Logica:
- Se o conteudo contem `<table` ou `<p`, considerar como HTML e retornar sem transformacao markdown
- Caso contrario, aplicar a conversao markdown existente (fallback para templates antigos em texto puro)

### Etapa 3: Incluir logo da empresa no cabecalho
**Arquivo: `supabase/functions/_shared/template-utils.ts`**

Modificar `generateHeader()` para incluir uma imagem de logo em base64 ou via URL publica. Como a Autentique recebe HTML, a forma mais confiavel e usar uma imagem base64 inline ou uma URL publica acessivel.

Opcoes:
- Buscar logo das configuracoes da empresa (`configuracoes` tabela, chave `empresa_logo_url`)
- Usar logo hardcoded em base64 como fallback
- Adicionar campo `empresa_logo_url` nas configuracoes se nao existir

### Etapa 4: Alinhar VariaveisSelector com o backend
**Arquivo: `src/components/documentos/VariaveisSelector.tsx`**

Atualizar a lista de variaveis para refletir exatamente o que o backend suporta. Remover variaveis que nao tem mapeamento e adicionar as novas que serao criadas.

### Etapa 5: Deploy e teste
- Deploy da edge function `autentique-create`
- Verificar que todas as variaveis sao substituidas corretamente
- Verificar que tabelas HTML do TipTap sao preservadas no documento final

---

## Detalhes Tecnicos

### Novas variaveis em `criarMapeamentoVariaveis()`:
```text
'associado.whatsapp': formatPhone(dados.cliente.telefone_secundario || dados.cliente.telefone)
'veiculo.tipo': dados.veiculo.categoria || 'Automovel'
'plano.descricao': (dados.plano.coberturas || []).join(', ') || 'Protecao veicular completa'
'plano.valor_base': formatCurrency(dados.contrato.valor_mensal)
'plano.cobertura_fipe': '100%'
'contrato.forma_pagamento': dados.contrato.forma_pagamento || 'Boleto Bancario'
'contrato.primeira_mensalidade': primeiraMensalidade
```

### Logica de deteccao HTML em `markdownParaHTML()`:
```text
function markdownParaHTML(conteudo):
  se conteudo contem '<table' ou '<p ' ou '<div':
    retornar conteudo envolvido em <div class="section"> sem transformacao
  senao:
    aplicar conversao markdown normal (headers, bold, listas, etc.)
```

### Cabecalho com logo:
```text
generateHeader(dados):
  <div class="header">
    <img src="URL_OU_BASE64" alt="Logo" style="max-height: 60px;" />
    <div class="header-empresa">...</div>
    <div class="header-titulo">TERMO DE AFILIACAO...</div>
  </div>
```

### Arquivos modificados:
1. `supabase/functions/_shared/template-utils.ts` - Variaveis + markdownParaHTML + header com logo
2. `src/components/documentos/VariaveisSelector.tsx` - Alinhar lista de variaveis
3. Deploy: `autentique-create`, `autentique-create-by-token`
