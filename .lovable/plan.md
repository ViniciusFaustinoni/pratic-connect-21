

# Tornar adicional de aplicativo 100% dinâmico

## Problema encontrado

As funções `resolverTipoUsoQuery` e `resolverPrecoApp` em `precoApp.ts` são usadas em **6 arquivos**, não apenas nos 3 citados:

1. `src/hooks/useCalcularCotacao.ts`
2. `src/hooks/usePlanosCotacao.ts`
3. `src/hooks/useCotacao.ts`
4. `src/hooks/useCotacaoAvancada.ts`
5. `src/components/planos/CalculadoraPreco.tsx`
6. `src/utils/precoApp.ts` (definição)

Se alterarmos a assinatura das funções sem atualizar todos os chamadores, o app quebra. A solução abaixo mantém as funções puras (recebem dados como parâmetro) e atualiza todos os chamadores.

---

## Passo 1 — Inserir chave no banco

Inserir na tabela `configuracoes`:

```sql
INSERT INTO configuracoes (chave, valor, descricao)
VALUES (
  'regioes_com_adicional_app',
  '["rj","lagos"]',
  'Regiões onde o uso como aplicativo exige adicional mensal para cobertura 100% FIPE'
);
```

---

## Passo 2 — Reescrever `src/utils/precoApp.ts`

As duas funções passam a receber a configuração como parâmetro em vez de ter listas hardcoded:

```typescript
interface ConfigAdicionalApp {
  regioesComAdicional: string[];  // vem de configuracoes.regioes_com_adicional_app
  linhasComColunaApp: string[];   // linhas que têm coluna 'aplicativo' na tabela de preços (ex: select-one)
  linhasSupportsApp: string[];    // linhas com supports_app=true em product_lines
}
```

- `resolverTipoUsoQuery(linha, regiao, tipoUso, config)` — sem nenhum nome de região ou linha no código
- `resolverPrecoApp(linha, regiao, tipoUso, valor, adicional, config)` — idem
- `TIPOS_USO_ESPECIFICOS` removido; a lógica de "motos não têm adicional" deriva de: se a linha não está em `regioesComAdicional` ou não está em `linhasSupportsApp`, retorna valor direto

---

## Passo 3 — Atualizar `src/hooks/useCalcularCotacao.ts`

- Adicionar `product_lines` e `regioes_com_adicional_app` às queries paralelas
- Construir o objeto `ConfigAdicionalApp` a partir dos dados do banco
- Remover `LINHAS_COM_APP` — filtrar uso app via `supports_app` do `product_lines`
- Passar config nas chamadas a `resolverTipoUsoQuery` e `resolverPrecoApp`

---

## Passo 4 — Atualizar os outros 3 chamadores

Mesma lógica: cada arquivo que chama `resolverTipoUsoQuery`/`resolverPrecoApp` precisa montar o `ConfigAdicionalApp` e passá-lo. Os arquivos afetados:

- **`src/hooks/usePlanosCotacao.ts`** — já busca `product_lines` via join; só precisa montar o config e buscar a chave `regioes_com_adicional_app` (já busca `configuracoes`)
- **`src/hooks/useCotacao.ts`** — adicionar busca de `product_lines.supports_app` e da config
- **`src/hooks/useCotacaoAvancada.ts`** — idem
- **`src/components/planos/CalculadoraPreco.tsx`** — já usa `useProductLines()`; só precisa buscar a config

---

## Resumo de impacto

| Arquivo | Mudança |
|---|---|
| `configuracoes` (banco) | Nova chave `regioes_com_adicional_app` |
| `precoApp.ts` | Reescrito — zero hardcodes, recebe config como parâmetro |
| `useCalcularCotacao.ts` | Remove `LINHAS_COM_APP`, busca `product_lines` + config |
| `usePlanosCotacao.ts` | Passa config nas chamadas |
| `useCotacao.ts` | Passa config nas chamadas |
| `useCotacaoAvancada.ts` | Passa config nas chamadas |
| `CalculadoraPreco.tsx` | Passa config nas chamadas |

Nenhuma tela nova. Nenhuma outra lógica alterada. Apenas eliminação de hardcodes de região e linha no motor de pricing de aplicativo.

