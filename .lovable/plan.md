

# Corrigir Marcação Automática do Tipo de Entrada no Termo de Filiação

## Causa raiz

O contrato no banco de dados tem `tipo_entrada = 'nova'`, mas o mapeamento de variáveis em `template-utils.ts` só reconhece os valores: `adesao`, `migracao`, `inclusao`, `troca_titularidade`, `reativacao`, `substituicao_placa`.

Como `'nova'` não corresponde a nenhum desses, todas as opções ficam com `( )` — nenhuma marcada.

O valor `'nova'` é equivalente a `'adesao'` (nova adesão). Precisa ser tratado como sinônimo.

## Correção

### `supabase/functions/_shared/template-utils.ts`

Na linha 192, ajustar a condição de `operacao.adesao` para aceitar tanto `'adesao'` quanto `'nova'`:

```typescript
'operacao.adesao': (dados.contrato.tipo_entrada === 'adesao' || dados.contrato.tipo_entrada === 'nova') ? '(X)' : '( )',
```

Opcionalmente, normalizar o `tipo_entrada` no `mapearDadosParaTemplate` em `termo-afiliacao-utils.ts` para converter `'nova'` em `'adesao'` antes de passar aos templates.

### `supabase/functions/_shared/termo-afiliacao-utils.ts`

Na linha 453, normalizar o valor:

```typescript
tipo_entrada: (contrato.tipo_entrada === 'nova' ? 'adesao' : contrato.tipo_entrada) || 'adesao',
```

Isso garante que qualquer template (principal ou anexo) receba o valor correto.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/_shared/termo-afiliacao-utils.ts` | Normalizar `'nova'` → `'adesao'` no mapeamento de dados |
| `supabase/functions/_shared/template-utils.ts` | Adicionar fallback `'nova'` na condição de `operacao.adesao` (segurança extra) |

