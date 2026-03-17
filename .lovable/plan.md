

## Plano: Variáveis dinâmicas de "Regras de Venda" nos documentos Autentique

### Contexto

Os documentos de adesão (Autentique) usam `criarMapeamentoVariaveis()` em `template-utils.ts` para substituir `{{variavel}}` no template. Hoje o mapeamento tem apenas dados de cliente/veículo/plano/empresa/sistema. As configurações de regras de venda (taxas, migração, pontuação, repasse) não estão disponíveis como variáveis — se usadas no template, aparecem como "—".

Os valores estão em **duas tabelas**:
- `configuracoes` — taxas de adesão, repasse, substituição, revistoria, multa rastreador, exceções FIPE
- `comissoes_parametros` — migração (comprovantes, prazo, canal, carência), pontuação (prazo reativação), repasse maior (percentuais, valores, corte boletos)

### Alterações

#### 1. `supabase/functions/_shared/termo-afiliacao-utils.ts`

**a)** Expandir `TermoAfiliacaoData` com campo opcional `regrasVenda`:

```typescript
regrasVenda?: {
  // Taxas e Adesão
  taxa_adesao_percentual_fipe: string;
  taxa_adesao_minimo_volante: string;
  taxa_adesao_minimo_base: string;
  taxa_repasse_volante: string;
  taxa_substituicao_placa: string;
  taxa_troca_titularidade: string;
  taxa_revistoria: string;
  multa_rastreador: string;
  // Migração
  migracao_comprovantes_exigidos: string;
  migracao_prazo_resposta_horas: string;
  migracao_canal_oficial: string;
  migracao_isentar_carencia: string;
  // Pontuação
  prazo_reativacao_dias: string;
  // Repasse Maior
  repasse_maior_pct_favoravel: string;
  repasse_maior_pct_reduzido: string;
  repasse_maior_valor_favoravel: string;
  repasse_maior_valor_reduzido: string;
  repasse_maior_corte_boletos: string;
};
```

**b)** Nova função `buscarRegrasVenda(supabase)` que:
1. Busca de `configuracoes` as 8 chaves de taxas
2. Busca de `comissoes_parametros` as 10 chaves de migração/pontuação/repasse
3. Retorna objeto tipado
4. Valida que todas as chaves obrigatórias existem — retorna lista de faltantes

#### 2. `supabase/functions/_shared/template-utils.ts`

Expandir `criarMapeamentoVariaveis()` com ~18 novas variáveis no grupo `regras`:

```
regras.taxa_adesao_percentual       → "1%"
regras.taxa_adesao_minimo_volante   → "R$ 100,00"
regras.taxa_adesao_minimo_base      → "R$ 100,00"
regras.repasse_volante              → "R$ 50,00"
regras.taxa_substituicao_placa      → "R$ 50,00"
regras.taxa_troca_titularidade      → "R$ 50,00"
regras.taxa_revistoria              → "R$ 50,00"
regras.multa_rastreador             → "R$ 400,00"
regras.migracao_comprovantes        → "3"
regras.migracao_prazo_horas         → "48"
regras.migracao_canal               → "e-mail"
regras.migracao_carencia_isenta     → "Sim"
regras.prazo_reativacao_dias        → "120"
regras.repasse_pct_favoravel        → "50%"
regras.repasse_pct_reduzido         → "70%"
regras.repasse_valor_favoravel      → "R$ 100,00"
regras.repasse_valor_reduzido       → "R$ 150,00"
regras.repasse_corte_boletos        → "4"
```

Se `dados.regrasVenda` não estiver presente, essas variáveis ficam sem mapeamento (e serão capturadas pela validação).

#### 3. `supabase/functions/autentique-create/index.ts`

Após `buscarConfiguracoesEmpresa`, chamar `buscarRegrasVenda(supabase)`.

**Validação antes de gerar**: Se o template contém variáveis `{{regras.*}}` e alguma configuração está faltante, retornar erro 422 com mensagem indicando quais chaves estão ausentes — bloqueando a geração do documento.

Atribuir `templateData.regrasVenda = regrasVenda` antes de chamar `gerarHTMLDoTemplate`.

#### 4. `supabase/functions/autentique-create-by-token/index.ts`

Mesma lógica: buscar regras de venda e injetar no `templateData`. Mesma validação de bloqueio.

#### 5. Resumo de arquivos

| Arquivo | Alteração |
|---|---|
| `_shared/termo-afiliacao-utils.ts` | +interface `RegrasVendaData`, +função `buscarRegrasVenda()` |
| `_shared/template-utils.ts` | +18 variáveis em `criarMapeamentoVariaveis()` |
| `autentique-create/index.ts` | +fetch regras, +validação, +injeção no templateData |
| `autentique-create-by-token/index.ts` | +fetch regras, +validação, +injeção no templateData |

Nenhuma migration necessária — todas as chaves já existem no banco. As variáveis ficam disponíveis para uso no editor de templates do TipTap como `{{regras.taxa_substituicao_placa}}` etc.

