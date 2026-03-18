

## Plano: Detecção de tipo de veículo 100% dinâmica (sem marcas/modelos hardcoded)

### Abordagem

Três regras em cascata, sem nenhum nome de marca ou modelo hardcoded no código:

1. **Regra 1 — Marcas exclusivas de moto**: ler `marcas_exclusivas_moto` da tabela `configuracoes`. Se a marca está na lista, é moto.
2. **Regra 2 — Marcas mistas (Honda, Yamaha etc.)**: consultar `plano_elegibilidade_modelos` por marca+modelo com `linha_slug = 'advanced'`. Se encontrar match, é moto.
3. **Regra 3 — Fallback**: manter `MOTO_KEYWORDS` como último recurso (para veículos não cadastrados).

### Pré-requisito: inserir config no banco

Inserir na tabela `configuracoes` a chave `marcas_exclusivas_moto` com valor sendo a lista de marcas separadas por vírgula (ex: `SUZUKI,KAWASAKI,HARLEY-DAVIDSON,TRIUMPH,DUCATI,KTM,DAFRA,SHINERAY,...`). Isso tira as marcas do código e permite edição pelo painel.

### Arquivos alterados

**1. `src/hooks/useDetectarTipoVeiculo.ts`** — reescrever o hook:
- Query 1: buscar `configuracoes` onde `chave = 'marcas_exclusivas_moto'`, parsear lista, verificar se marca está nela → moto
- Query 2: buscar `plano_elegibilidade_modelos` por marca+modelo com `linha_slug = 'advanced'` → moto
- Query 3 (só marca, sem modelo): se todos os registros da marca são `advanced` → moto
- Fallback: `detectarTipoVeiculo()` síncrona (mantém `MOTO_KEYWORDS`)

**2. `src/data/vistoriaConfigCompleta.ts`** — remover `MARCAS_EXCLUSIVAS_MOTO` hardcoded:
- Remover a constante `MARCAS_EXCLUSIVAS_MOTO`
- Remover a checagem de marca da função `detectarTipoVeiculo` (ficam apenas `MOTO_KEYWORDS` como fallback puro por modelo)
- `MOTO_KEYWORDS` permanece como fallback de último recurso

**3. `supabase/functions/contrato-gerar/index.ts`** — mesma lógica no edge function:
- Adicionar query à `configuracoes` para `marcas_exclusivas_moto`
- Verificar marca contra lista do banco antes de consultar `plano_elegibilidade_modelos`
- Remover lista hardcoded de marcas do `MOTO_KEYWORDS` (manter só keywords de modelo como fallback)

**4. `supabase/functions/sga-hinova-sync/index.ts`** — idem:
- Adicionar query à `configuracoes` para `marcas_exclusivas_moto`
- Remover `MARCAS_MOTO` hardcoded e lógica `HONDA_CARROS`
- Manter keywords de modelo como fallback

### Resultado
- Zero nomes de marca hardcoded no código
- Marcas exclusivas gerenciáveis via tabela `configuracoes`
- Modelos detectados via `plano_elegibilidade_modelos`
- `MOTO_KEYWORDS` mantido apenas como rede de segurança para modelos não cadastrados

