

# Etapa 4 — Parser PDF + Integração UI + Elegibilidade no Cotador

## Tres entregas em paralelo

### 1. Edge Function `parse-elegibilidade-pdf`

Criar `supabase/functions/parse-elegibilidade-pdf/index.ts` conforme especificado:
- Recebe FormData (arquivo PDF, plano_id, linha_slug, modo)
- Extrai texto do PDF via regex de strings entre parenteses
- Localiza bloco entre `##DADOS_IMPORTACAO_INICIO##` e `##DADOS_IMPORTACAO_FIM##`
- Valida cabecalho, parseia linhas pipe-separated
- Modo `substituir` desativa registros anteriores
- Insert em `plano_elegibilidade_modelos`
- CORS headers padrao do projeto
- `verify_jwt = false` no config.toml

### 2. Reescrever `TabImportarPDF` em `ElegibilidadeVeiculos.tsx`

Substituir o placeholder atual (linhas 358-408) por:

**Secao de importacao:**
- Select de plano (obrigatorio antes de habilitar dropzone)
- Select de modo (Adicionar/Substituir) com Alert laranja para Substituir
- Dropzone habilitado apos selecao de plano
- Botao "Processar PDF" chama edge function via `supabase.functions.invoke`
- Estados: carregando (spinner), erro (alert vermelho com detalhes), sucesso (alert verde + tabela preview)
- Botao "Ver no plano" que muda para aba "por-plano" (requer lift state do activeTab e selectedPlano para o componente pai)

**Secao de exportacao:**
- Select de plano + botao "Exportar PDF"
- Gera PDF client-side com `pdf-lib` (ja instalado)
- Busca registros do plano, gera layout visual + bloco `##DADOS_IMPORTACAO##`
- Download automatico

### 3. Integrar elegibilidade no `usePlanosCotacao.ts`

**Hook (`usePlanosCotacao.ts`):**
- Adicionar `marca?: string` e `modelo?: string` a `CalcularPlanosParams`
- Nova query para `plano_elegibilidade_modelos` (staleTime 5min)
- Funcao `verificarElegibilidadeModelo` (case-insensitive, sem config = aceita tudo)
- Filtro aditivo apos linha ~215 (apos blocked_categories): exclui planos `negado`
- Adicionar `elegibilidadeStatus` a interface `PlanoCotacao` e ao push (~linha 318)
- Incluir `elegibilidadeLoading` e `elegibilidadeData` nas deps do useMemo

**Callers — passar marca/modelo:**
- `Cotador.tsx` (~linha 298): `marca: marca || undefined, modelo: modelo || undefined`
- `Cotacao.tsx` (~linha 109): `marca: marca || undefined, modelo: modelo || undefined`
- `CotacaoFormDialog.tsx` (~linha 293): resolver marca/modelo via useMemo antes do hook (extrair de `veiculoEncontrado?.vehicleData?.marca` ou `marcaSelecionada`)

**UI — badge limitado:**
- `PlanoCardCotacao.tsx`: badge amarelo "Aceitacao com restricoes" apos o titulo quando `elegibilidadeStatus === 'limitado'`
- `CotacaoFormDialog.tsx` (~linha 1668): mesmo badge amarelo ao lado do nome do plano

## Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/parse-elegibilidade-pdf/index.ts` | Criar |
| `supabase/config.toml` | Adicionar funcao |
| `src/components/gestao-comercial/ElegibilidadeVeiculos.tsx` | Reescrever TabImportarPDF |
| `src/hooks/usePlanosCotacao.ts` | Adicionar elegibilidade |
| `src/pages/vendas/Cotador.tsx` | Passar marca/modelo |
| `src/pages/vendas/Cotacao.tsx` | Passar marca/modelo |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Passar marca/modelo + badge |
| `src/components/cotacao/PlanoCardCotacao.tsx` | Badge limitado |

## Regras
- Nenhum filtro existente removido no hook
- Nao bloquear planos enquanto elegibilidadeData carrega
- Uma unica query para toda elegibilidade (sem N+1)
- Comparacao sempre case-insensitive com trim

