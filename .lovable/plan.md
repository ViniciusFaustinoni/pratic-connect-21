# Auditoria do matching marca×modelo na elegibilidade

O bug do T-CROSS é uma **instância** de um problema mais geral: o tokenizador de `findModelEligibility` em `src/hooks/useEntityEligibilityRules.ts` decide silenciosamente "não casou" sempre que a forma escrita no cadastro (`entity_eligibility_rules.rule_config.modelos[].modelo`) usa pontuação/espaçamento diferente da forma do DETRAN/FIPE. Já corrigimos hífen, mas a mesma classe de falha existe com outros caracteres e com cadastros tipo `CRV` × FIPE `CR-V`, `HB20` × `HB 20`, `C3` × `C 3 PICASSO`, etc. — e não há sinal nenhum quando isso acontece em produção.

A auditoria tem três frentes: **endurecer o motor**, **mapear divergências reais no banco** e **garantir que regressões futuras gritem**.

---

## 1. Endurecer o motor de matching

Em `src/hooks/useEntityEligibilityRules.ts`:

- **Tokenizador robusto.** Trocar `split(/[\s/\-]+/)` por um split em **qualquer não-alfanumérico** (`/[^a-z0-9]+/i` após `removeDiacritics` + uppercase). Cobre hífen, ponto, vírgula, parênteses, barra, underscore, ` & `, etc.
- **Chave compacta de fallback.** Para cada string, gerar também `compact = só [A-Z0-9]` (ex.: `HR-V` → `HRV`, `CR-V` → `CRV`, `C 3` → `C3`). Casamento aceito quando **ou** todos os tokens da entry estão no ctx, **ou** o `compact(entry.modelo)` está contido nos `compact` dos tokens/concatenação do ctx. Resolve `CRV ↔ CR-V`, `HB20 ↔ HB 20`, `C3 ↔ C 3` sem afrouxar (`208` ainda não casa com `2008` porque a comparação `compact` é por token, não substring).
- **Telemetria de silêncio.** Quando uma `rule_type='marca_modelo'` é avaliada e nenhum candidato é retornado para um contexto com `marca+modelo` preenchidos, logar `console.warn('[elegibilidade] modelo nao casou', { ruleId, marca, modelo, versao, entries: modelos.map(m=>m.modelo) })`. Hoje o silêncio é o bug — sem sinal, ninguém percebe.

## 2. Mapear divergências reais hoje no banco

Script único (rodável em `/tmp`, gerando relatório em `/mnt/documents/auditoria-elegibilidade-modelos.csv`) que:

1. Lê todas as `entity_eligibility_rules` com `rule_type='marca_modelo'`.
2. Para cada `entry` (marca+modelo), simula `findModelEligibility` contra **todas** as linhas de `marcas_modelos` da mesma marca.
3. Classifica em três buckets:
   - **órfã** — entry que não casa com nenhum modelo do catálogo FIPE/DETRAN (forte sinal de erro de digitação tipo `T-CROSS` antes do fix).
   - **ambígua** — entry que casa com famílias diferentes do esperado (ex.: `GOL` casando com `GOLF`, se ocorrer).
   - **ok** — entry que casa com ≥1 modelo coerente.
4. Entrega CSV para o time de produto revisar e corrigir os cadastros suspeitos, sem o agente mexer nos dados.

O resultado dessa auditoria é o que prova que o fix do motor cobre o universo real — e a planilha vira a lista de cadastros para limpeza manual no painel.

## 3. Regressão travada

- **Testes unitários** novos em `src/hooks/__tests__/useEntityEligibilityRules.test.ts` cobrindo: `T-CROSS ↔ T CROSS`, `HR-V ↔ HRV`, `CR-V ↔ CRV`, `C3 ↔ C 3 PICASSO`, `HB20 ↔ HB 20`, `208 ≠ 2008`, `GOL ≠ GOLF`, wildcard `TODOS`, ano/combustível como filtro pós-token.
- **Memória de projeto** em `mem://logic/quotation/elegibilidade-matching-marca-modelo-canonico` documentando: tokenização canônica (não-alfanumérico = separador), chave compacta como fallback, regra `208 ≠ 2008`, telemetria obrigatória de "modelo não casou".

## Arquivos afetados

- `src/hooks/useEntityEligibilityRules.ts` — tokenização + fallback compacto + warn de silêncio.
- `src/hooks/__tests__/useEntityEligibilityRules.test.ts` — novo, cobre a matriz acima.
- `/tmp/auditoria-elegibilidade-modelos.ts` — script de auditoria (descartável).
- `/mnt/documents/auditoria-elegibilidade-modelos.csv` — entregável para o time de produto.
- `mem://logic/quotation/elegibilidade-matching-marca-modelo-canonico` + index.

## Fora de escopo

- Não vou editar nenhuma linha de `entity_eligibility_rules` automaticamente — a planilha existe justamente para a revisão humana decidir caso a caso.
- Não vou tocar em `usePlanosCotacao`, `CotacaoFormDialog` nem nas regras de região; o bug do T-CROSS estava 100% no matching de modelo.
