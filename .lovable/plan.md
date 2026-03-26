

# Variavel dinamica de coberturas e beneficios nos templates de documentos

## Problema atual

- `{{plano.coberturas}}` no mapeamento de variaveis (template-utils.ts, linha 96) faz apenas `.join(', ')` de um array de strings generico do campo `planos.coberturas` — nao busca as coberturas e beneficios reais vinculados ao plano nas tabelas `planos_coberturas` e `planos_beneficios`
- Nao existe uma variavel que gere uma tabela HTML formatada com todas as coberturas e beneficios do plano contratado
- O `VariaveisSelector.tsx` lista `plano.coberturas` como "Lista de coberturas" mas sem detalhamento

## Solucao

### 1. Buscar coberturas e beneficios reais do plano nas Edge Functions

Nos dois edge functions (`autentique-create/index.ts` e `autentique-create-by-token/index.ts`), apos obter o `plano_id` do contrato, buscar:

```sql
-- Coberturas vinculadas ao plano
SELECT c.nome, c.descricao, pc.valor_personalizado, pc.carencia_dias, pc.franquia_percentual
FROM planos_coberturas pc
JOIN coberturas c ON c.id = pc.cobertura_id
WHERE pc.plano_id = ?
ORDER BY c.nome

-- Beneficios vinculados ao plano  
SELECT b.name, b.description, pb.custom_value
FROM planos_beneficios pb
JOIN benefits b ON b.id = pb.benefit_id
WHERE pb.plano_id = ?
ORDER BY b.name
```

Passar esses arrays para `templateData` como `plano.coberturas_detalhadas` e `plano.beneficios_detalhados`.

### 2. Novas variaveis no mapeamento (`template-utils.ts`)

| Variavel | Conteudo |
|---|---|
| `plano.coberturas` | Lista simples: "Roubo/Furto, Colisao, Incendio" (mantida) |
| `plano.beneficios` | Lista simples: "Assistencia 24h, Carro Reserva" |
| `plano.tabela_coberturas` | Tabela HTML formatada com nome, descricao, carencia, franquia |
| `plano.tabela_beneficios` | Tabela HTML formatada com nome, descricao, valor |
| `plano.tabela_completa` | Tabela HTML unificada: coberturas + beneficios do plano |

### 3. Atualizar `VariaveisSelector.tsx`

Adicionar as novas variaveis no grupo `plano`:
- `plano.beneficios` — "Lista de beneficios do plano"
- `plano.tabela_coberturas` — "Tabela HTML de coberturas com detalhes"
- `plano.tabela_beneficios` — "Tabela HTML de beneficios com detalhes"  
- `plano.tabela_completa` — "Tabela HTML completa (coberturas + beneficios)"

### 4. Atualizar `useGerarDocumento.ts` (frontend)

Na funcao `buscarDadosAssociado`, quando ha contrato com `plano_id`, buscar coberturas e beneficios vinculados para popular as mesmas variaveis no merge de documentos gerados pelo frontend.

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `supabase/functions/autentique-create/index.ts` | Buscar coberturas/beneficios do plano e injetar em templateData |
| `supabase/functions/autentique-create-by-token/index.ts` | Idem |
| `supabase/functions/_shared/template-utils.ts` | Novas variaveis no mapeamento + funcao geradora de tabela HTML |
| `supabase/functions/_shared/termo-afiliacao-utils.ts` | Expandir tipo `TermoAfiliacaoData.plano` com arrays detalhados |
| `src/components/documentos/VariaveisSelector.tsx` | Adicionar variaveis novas ao grupo `plano` |
| `src/hooks/useGerarDocumento.ts` | Buscar coberturas/beneficios do plano no merge frontend |

## Formato da tabela HTML gerada

```html
<table class="plan-details">
  <thead><tr><th>Cobertura</th><th>Detalhes</th></tr></thead>
  <tbody>
    <tr><td>Roubo e Furto</td><td>100% FIPE · Carencia: 90 dias</td></tr>
    <tr><td>Colisao</td><td>100% FIPE · Franquia: 6%</td></tr>
  </tbody>
  <thead><tr><th>Beneficio</th><th>Detalhes</th></tr></thead>
  <tbody>
    <tr><td>Assistencia 24h</td><td>400km</td></tr>
    <tr><td>Carro Reserva</td><td>30 dias</td></tr>
  </tbody>
</table>
```

Estilos CSS ja existentes no `generateStyles()` serao estendidos com classe `.plan-details`.

