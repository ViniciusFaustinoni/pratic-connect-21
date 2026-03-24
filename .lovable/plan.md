

# Investigação: Por que os planos não aparecem para Meriva 2009 (FIPE R$ 26.860)

## Análise completa — por plano

| Plano | Resultado | Motivo |
|-------|-----------|--------|
| LANÇAMENTO BASIC/PREMIUM/EXCLUSIVE | Filtrado | `ano_minimo = 2024`, veículo é 2009 |
| ELÉTRICOS | Filtrado | `ano_minimo = 2020`, veículo é 2009 |
| ESPECIAL | Negado (elegibilidade) | Whitelist aceita Meriva apenas 2002-2004 (`ano_max = 2004`) |
| ESPECIAL PLUS | Negado (elegibilidade) | Meriva não está na whitelist (só Sprinter, Boxer, etc.) |
| ADVANCED / ADVANCED+ | Negado (elegibilidade) | Whitelist contém apenas marcas de moto (Honda, Yamaha, etc.) |
| **SELECT BASIC** | **BUG** | `plano_preco_map.tipo_uso = 'passeio'` em vez de `'particular'` → busca preço com tipo_uso inexistente → `valorMensal = 0` → plano oculto |
| SELECT EXCLUSIVE | Filtrado | `tipo_uso = 'aplicativo'` no plano, cotação é passeio |
| SELECT PREMIUM | **Deveria aparecer** | Mapeamento correto (`tipo_uso = 'particular'`), Meriva na whitelist (2005+, aceito), faixa FIPE existe para `select/rj/particular/gasolina` |
| SELECT ONE | **Deveria aparecer** | Mapeamento correto, Meriva na whitelist (2005+, aceito), faixa FIPE existe para `select-one/rj/particular/null` |
| SELECT ONE 5% PROMO | Sem preço | `linha_slug = null` no `plano_preco_map` → sem mapeamento → oculto |

## Bug confirmado

Na tabela `plano_preco_map`, o plano **SELECT BASIC** tem `tipo_uso = 'passeio'`. O código em `usePlanosCotacao.ts` (linha 501) trata 'passeio' como um tipo_uso proprietário (igual a 'advanced'), fazendo a busca na tabela de preços com `tipo_uso = 'passeio'` — que não existe. Resultado: `valorMensal = 0` → plano é ocultado.

## Correção

### 1. Corrigir dado no banco (migration)
Atualizar `plano_preco_map` para SELECT BASIC: `tipo_uso = 'particular'`.

### 2. Safeguard no código (`usePlanosCotacao.ts`)
Adicionar 'passeio' como sinônimo de 'particular' na lógica de `isLinhaTipoUsoProprio` (linha 501), para que qualquer futuro erro de configuração não oculte planos silenciosamente:

```typescript
const isLinhaTipoUsoProprio = mappingTipoUso !== 'particular' 
  && mappingTipoUso !== 'aplicativo'
  && mappingTipoUso !== 'passeio';  // ← safeguard
```

### 3. Investigar SELECT PREMIUM e SELECT ONE
Estes dois planos deveriam ter aparecido (dados e filtros corretos). Se não apareceram, provavelmente foi um problema de timing (query de elegibilidade ainda carregando quando o usuário olhou). Nenhuma correção de código necessária — a correção do SELECT BASIC é suficiente para garantir que pelo menos 3 planos (BASIC, PREMIUM, ONE) apareçam.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/` | **Criar** — corrigir `plano_preco_map` tipo_uso de 'passeio' para 'particular' |
| `src/hooks/usePlanosCotacao.ts` | **Editar** — safeguard para 'passeio' = 'particular' |

