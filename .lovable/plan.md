## Diagnóstico raiz

O threshold por tipo já existe (`exigeRastreador`: carro ≥ 30k, moto ≥ 9k, diesel sempre). A regra está correta, mas em vários pontos do código a **detecção de "isMoto" é frágil ou usa um campo que não existe**. Quando ela falha, a moto é tratada como carro e cai na rota errada (ex.: moto Honda CG 12k é detectada como carro 12k → "carro abaixo de 30k" → autovistoria COMPLETA 31 fotos, em vez de enxuta + instalação).

### Pontos com detecção inconsistente que afetam motos

1. **`src/hooks/useSolicitarVistoriaTecnico.ts:71` (`veiculoSubFipe`)** — só olha `veiculo.categoria`. A tabela `veiculos` **não tem coluna `categoria`** (verificado via `information_schema`). Resultado: `isMoto = false` sempre. Para qualquer moto < 30k a função retorna `true` (sub-FIPE). Usado na tela `monitoramento/AprovacaoInstalacaoDetalhe.tsx:914` para decidir o caminho da aprovação.

2. **`supabase/functions/finalizar-autovistoria-cotacao/index.ts:75-89`** — lê `veiculos.categoria` (inexistente) com fallback regex curta no modelo (`cg|cb|cbr|pcx|biz|nxr|bros|titan|fan|ybr|fazer|hornet|crosser|xre`). Modelos comuns ficam de fora (AEROX, ADV, NMAX, ELITE, NEO, BURGMAN, FACTOR, HORNET 2024 com sufixo, etc.) e a moto vira "carro sub-FIPE" no servidor que materializa a vistoria.

3. **`src/hooks/useAprovacaoMonitoramento.ts:103-104 e 166-167`** — considera moto se a marca casar `/honda|yamaha|suzuki|kawasaki|bmw motorrad|harley/`. Honda/Suzuki/Kawasaki/BMW também fabricam carros → falso positivo no sentido oposto (Honda Civic vira moto, exige 9k em vez de 30k).

4. **`src/pages/public/CotacaoContratacao.tsx:37 (`detectarTipoVeiculoDaCotacao`)** — usa `cotacao.veiculo_categoria`. No banco esse campo está **NULL em 100% das cotações recentes** (verificado, motos Honda/Yamaha 12k–28k). Cai no fallback de `detectarTipoVeiculo` (keywords em `src/data/vistoriaConfigCompleta.ts`), que cobre bem mas perde casos como AEROX.

### O fluxo das motos hoje
- Moto detectada corretamente (ex.: CG 150 / 12.474) → `exige=true` → caminho "acima do mínimo" → enxuta opcional + instalação. **Funciona.**
- Moto NÃO detectada (ex.: AEROX 19.912, ou qualquer veículo cuja categoria/keyword falhe) → tratada como carro → `12k < 30k` → sub-FIPE → **autovistoria COMPLETA de 15/31 fotos errada**.

A causa raiz não é "moto vs carro abaixo de 30k", é **detecção de moto não-confiável**. Corrigindo a detecção, o threshold de 9k já existente passa a valer em todos os pontos.

## Plano de correção (escopo: motos; carros intactos)

### 1. Fonte única de verdade para tipo de veículo

Criar `src/lib/veiculo/detectarTipoVeiculo.ts` (e gêmeo em `supabase/functions/_shared/detectar-tipo-veiculo.ts`) com prioridade:

```text
1. veiculo.tipo (se vier explícito de API placa: 'moto' | 'carro')
2. cotacao.veiculo_categoria / contratos.veiculo_categoria, se preenchido
3. marcas_modelos.categoria por (marca, modelo) — consulta ao catálogo do sistema
4. configuracoes.marcas_exclusivas_moto (lista admin)
5. fallback de keywords (atual MOTO_REGEX + lista ampliada: aerox, nmax, xmax, fazer, mt-03, mt-07, mt-09, gixxer, drag star, etc.)
6. fallback final: 'carro'
```

A função síncrona usa cache em memória do catálogo `marcas_modelos`; a versão edge usa SELECT por marca+modelo. Retorna `'carro' | 'moto'`.

### 2. Trocar todos os call-sites pela fonte única

- `src/pages/public/CotacaoContratacao.tsx` → remover `detectarTipoVeiculoDaCotacao` local, usar o novo helper (a versão com hook se precisar de async catálogo).
- `src/hooks/useSolicitarVistoriaTecnico.ts` → `veiculoSubFipe` passa a receber `marca` e `modelo` (não só `categoria`).
- `src/hooks/useAprovacaoMonitoramento.ts` → remover regex de marca, usar o helper.
- `supabase/functions/finalizar-autovistoria-cotacao/index.ts` → usar o helper compartilhado.
- `supabase/functions/aprovar-proposta/index.ts`, `concluir-instalacao-prestador/index.ts`, `ativar-associado/index.ts` → mesma troca (todos hoje têm sua própria regex).

### 3. Backfill defensivo do `cotacoes.veiculo_categoria`

Migration única que preenche `veiculo_categoria='moto'` em cotações ativas (≤ 30 dias) cujo par (marca, modelo) seja moto segundo `marcas_modelos`. Isso corrige imediatamente cotações abertas como COT-20260519-122938890-252 (CB250F Twister), COT-…-094350410-530 (AEROX), etc., sem precisar refazer fluxo.

### 4. Saneamento das vistorias já materializadas erradas

Script (não destrutivo) que lista cotações ativas onde:
- Tipo detectado = moto
- `valor_fipe ≥ 9000`
- `tipo_vistoria = 'autovistoria'` com ≥ 15 fotos
- Sem `instalacao` agendada

Para cada uma: voltar `tipo_vistoria = NULL`, devolver `status_contratacao` para `contrato_assinado`/`pagamento_ok` conforme estado, manter mídia (não apagar), e permitir refazer no caminho enxuto + agendar instalação. **Roda só após aprovação explícita.**

### 5. Testes

- `src/lib/veiculo/detectarTipoVeiculo.test.ts` cobrindo: AEROX, NMAX, XMAX, ELITE, ADV, CG, Honda Civic (carro), Honda Fit (carro), Yamaha (sem modelo), Diesel.
- Teste do `escopoAnaliseCadastro` para garantir que motos ≥ 9k não caem em "sub-FIPE completa".

### 6. Não-mexer (carros intactos)

- Threshold de 30k mantido em todos os pontos.
- `CARRO_BRANDS` intocada.
- Edge `concluir-instalacao-prestador` linha 67 (`fipe >= 30000` para carro) — assinatura não muda, só a fonte do `isMoto`.

## Detalhes técnicos

Tabelas/colunas tocadas:
- Leitura nova: `marcas_modelos(marca, modelo, categoria)` em runtime.
- Update no backfill: `cotacoes.veiculo_categoria` apenas onde estiver NULL e o catálogo confirmar moto.

Compatibilidade: a função `exigeRastreador` em `src/types/termo-filiacao.ts` e `supabase/functions/_shared/template-utils.ts` **não muda** — continua recebendo `tipo`. Quem muda é só quem decide o `tipo` antes de chamá-la.

Risco: queries extras em `marcas_modelos` por cotação no link público — mitigado com cache global (já existe padrão em `useConfiguracoesAll`).

## Entregáveis

1. Helper síncrono + edge para detecção.
2. Substituição de 6 call-sites.
3. Migration de backfill em `cotacoes.veiculo_categoria`.
4. Script de saneamento das autovistorias erradas (executar sob confirmação).
5. Testes unitários.

Carros: nada muda no caminho deles. Validação visual: rodar uma cotação Honda Civic 25k (carro, sub-FIPE → completa 31 fotos) e uma Yamaha AEROX 19k (moto ≥ 9k → enxuta opcional + instalação) após o ajuste.