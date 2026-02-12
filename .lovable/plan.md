

# Integrar Aditivos Dinamicos nas Edge Functions do Autentique

## Contexto

Atualmente, as edge functions `autentique-create` e `autentique-create-by-token` possuem secoes **hardcoded** para aditivos (0KM e Rastreador) dentro do proprio codigo. Com a nova tabela `termos_aditivos`, essas secoes devem ser substituidas por uma busca dinamica ao banco, avaliando as regras contra os dados do veiculo e anexando automaticamente os aditivos aplicaveis ao HTML enviado para o Autentique.

## O que muda

### 1. Edge Function `autentique-create/index.ts`

**Remover:**
- Funcoes hardcoded `generateSecaoCarroZeroDinamico()` e `generateSecaoRastreadorDinamico()`
- Chamadas a `ehVeiculoZeroKm` e `exigeRastreador` do template-utils

**Adicionar:**
- Buscar aditivos ativos da tabela `termos_aditivos` (ordenados por `ordem`)
- Buscar configuracao `aditivo_fipe_limite` da tabela `configuracoes`
- Para cada aditivo, avaliar suas regras contra os dados do veiculo:
  - `veiculo_0km`: placa vazia ou procedencia "Novo"
  - `veiculo_blindado`: campo observacoes contendo "blindad"
  - `fipe_acima_de`: valor FIPE acima do limite configurado
- Gerar HTML dos aditivos aplicaveis usando o `conteudo_html` do banco (com substituicao de variaveis)
- Inserir as secoes no HTML final antes da area de assinatura

### 2. Edge Function `autentique-create-by-token/index.ts`

Mesma logica: buscar aditivos dinamicos e inclui-los no HTML gerado (atualmente usa apenas o fallback hardcoded `generateTermoAfiliacao`).

### 3. Funcao utilitaria `_shared/template-utils.ts`

Adicionar uma funcao compartilhada `buscarEGerarAditivos(supabase, dadosVeiculo, dadosTemplate)` que:
1. Busca todos os aditivos ativos
2. Busca o limite FIPE das configuracoes
3. Avalia regras
4. Retorna o HTML concatenado dos aditivos aplicaveis (com variaveis substituidas)

Isso evita duplicar logica entre as duas edge functions.

---

## Detalhes Tecnicos

### Nova funcao em `_shared/template-utils.ts`

```text
async function buscarEGerarAditivos(supabase, dadosVeiculo, dadosTemplate):
  1. SELECT * FROM termos_aditivos WHERE ativo = true ORDER BY ordem
  2. SELECT valor FROM configuracoes WHERE chave = 'aditivo_fipe_limite'
  3. Para cada aditivo:
     - Avaliar cada regra do array JSON "regras"
     - Se pelo menos uma regra bate -> incluir
  4. Para cada aditivo incluido:
     - Substituir variaveis no conteudo_html
     - Envolver em div com page-break e titulo
  5. Retornar HTML concatenado
```

### Alteracao em `gerarHTMLDoTemplate()` (autentique-create)

Antes:
```text
const termo0km = generateSecaoCarroZeroDinamico(dados);
const termoRastreador = generateSecaoRastreadorDinamico(dados);
```

Depois:
```text
const aditivosHTML = await buscarEGerarAditivos(supabase, dados.veiculo, dados);
```

### Alteracao em `autentique-create-by-token`

Apos gerar o HTML principal, injetar os aditivos dinamicos antes do fechamento do `</body>`.

---

## Arquivos a alterar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/_shared/template-utils.ts` | Adicionar funcao `buscarEGerarAditivos()` |
| `supabase/functions/autentique-create/index.ts` | Remover secoes hardcoded, usar aditivos dinamicos |
| `supabase/functions/autentique-create-by-token/index.ts` | Incluir aditivos dinamicos no HTML |

## O que NAO muda

- Tabela `termos_aditivos` e CRUD no frontend (ja criados)
- Hook `useAvaliarAditivos` (usado no frontend para preview)
- Template principal do termo (continua vindo do `documento_templates`)
- Logica de envio ao Autentique (GraphQL mutation, FormData)

