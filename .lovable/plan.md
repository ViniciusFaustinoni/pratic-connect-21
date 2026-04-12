

## Plano: Garantir coberturas e benefícios no documento Autentique

### Problema
O template "Proposta de Filiação" (AF1) armazenado no banco **não contém** as variáveis `{{plano.tabela_coberturas}}`, `{{plano.tabela_beneficios}}` ou `{{plano.tabela_completa}}`. O sistema já monta os dados (`coberturas_detalhadas`, `beneficios_detalhados`) e já tem as funções de renderização (`gerarTabelaCoberturasHTML`, `gerarTabelaBeneficiosHTML`), mas o template do banco simplesmente não usa essas variáveis — logo, coberturas e benefícios nunca aparecem no PDF enviado ao Autentique quando usa o template do banco.

O template hardcoded (fallback) tem a seção 3 com coberturas e benefícios, mas esse só é usado quando não existe template no banco.

### Solução
Injetar automaticamente a seção de coberturas e benefícios no HTML gerado, **após** a substituição de variáveis, quando o template do banco não contiver essas variáveis. Isso garante que SEMPRE apareçam, independentemente do conteúdo do template.

### Alterações

**1. `supabase/functions/_shared/template-utils.ts`**
- Criar função `gerarSecaoCoberturasInjetavel(dados)` que gera um bloco HTML autossuficiente com:
  - Título "COBERTURAS E BENEFÍCIOS DO PLANO"
  - Lista de coberturas detalhadas (nome, descrição, valor personalizado)
  - Lista de benefícios detalhados (nome, descrição, valor personalizado)
  - Reutiliza o estilo existente (`.plan-details`, `.cobertura-item`)
- Exportar essa função

**2. `supabase/functions/autentique-create/index.ts`** (~linha 500)
- Após gerar `conteudoHTML` via `substituirVariaveis`, verificar se o conteúdo resultante contém coberturas renderizadas
- Se `templateData.plano.coberturas_detalhadas` ou `beneficios_detalhados` existem e o HTML não contém a seção, injetar `gerarSecaoCoberturasInjetavel(templateData)` antes dos aditivos

**3. `supabase/functions/autentique-create-by-token/index.ts`** (~linha 493)
- Mesma lógica: injetar a seção de coberturas/benefícios após o `conteudoHTML` e antes dos `aditivosHTML`

### Resultado
- Coberturas e benefícios do plano escolhido aparecerão **sempre** no documento enviado ao Autentique
- Se o usuário adicionar `{{plano.tabela_completa}}` manualmente no template do banco, a injeção automática não duplicará (verificação prévia)
- O template hardcoded (fallback) continua funcionando normalmente com a seção 3 já existente

