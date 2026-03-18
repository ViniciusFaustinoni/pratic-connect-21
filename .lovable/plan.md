

## Plano: Detecção dinâmica de tipo de veículo via `plano_elegibilidade_modelos`

### Problema
A detecção carro/moto depende de listas hardcoded (`MOTO_KEYWORDS`, `MARCAS_EXCLUSIVAS_MOTO`) duplicadas em 5 arquivos. Qualquer modelo não listado (como Honda Elite) é classificado errado.

### Abordagem

Criar um **hook React** que consulta `plano_elegibilidade_modelos` para determinar o tipo: se a marca+modelo tem registros com `linha_slug = 'advanced'`, é moto. Manter `MOTO_KEYWORDS` como fallback síncrono.

### Arquivos e mudanças

**1. Novo hook: `src/hooks/useDetectarTipoVeiculo.ts`**
- Query à `plano_elegibilidade_modelos` filtrando por `marca` (ilike) e `is_active = true`
- Se encontra registros com `linha_slug = 'advanced'` → `'moto'`
- Se encontra registros com outras linhas → `'automovel'`
- Se não encontra nada → fallback para `detectarTipoVeiculo()` síncrona existente
- Cache com `staleTime: 10min` (dados mudam raramente)
- Exporta `useDetectarTipoVeiculo(marca, modelo)` retornando `{ tipoVeiculo, isLoading }`

**2. Atualizar `src/data/vistoriaConfigCompleta.ts`**
- Adicionar `'elite'` e outros modelos faltantes ao `MOTO_KEYWORDS` (fallback)
- Exportar `detectarTipoVeiculo` sem mudanças na assinatura (continua síncrona para edge functions)

**3. Atualizar consumidores React (4 arquivos)**
- `src/pages/vendas/Cotador.tsx` — usar `useDetectarTipoVeiculo(marca, modelo)` no lugar do `useMemo` com `detectarTipoVeiculo`
- `src/pages/vendas/Cotacao.tsx` — idem
- `src/components/cotacoes/CotacaoFormDialog.tsx` — idem
- `src/components/planos/CalculadoraPreco.tsx` — idem

**4. Atualizar consumidores de cotação pública (2 arquivos)**
- `src/pages/public/CotacaoContratacao.tsx` — usar o hook, remover `MOTO_KEYWORDS` local
- `src/hooks/useCotacaoContratacao.ts` — usar query direta ao banco no lugar de keywords locais

**5. Edge Functions (manter fallback — sem acesso a hooks React)**
- `supabase/functions/contrato-gerar/index.ts` — adicionar consulta à `plano_elegibilidade_modelos` via supabase client antes de cair no fallback de keywords
- `supabase/functions/sga-hinova-sync/index.ts` — idem, consulta ao banco com fallback para keywords

### Não alterado
- `InstaladorChecklist.tsx` e `ExecutarVistoriaCompleta.tsx` — usam `tipo_veiculo` explícito do banco (já resolvido), keywords são fallback aceitável

### Resultado
- Qualquer modelo cadastrado na tabela de elegibilidade é detectado corretamente sem manutenção manual
- Keywords permanecem como rede de segurança para veículos não cadastrados
- Zero breaking changes — mesma interface de retorno

