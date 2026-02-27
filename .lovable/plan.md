
# Dispensar Rastreador para Motos com FIPE abaixo de R$9.000

## Problema
A funcao `precisaRastreador` usa um unico limite FIPE (R$30.000) para todos os tipos de veiculo. Motos com FIPE abaixo de R$9.000 deveriam ser dispensadas, mas o sistema aplica o mesmo corte de carros, impedindo a conclusao da instalacao.

## Solucao

### 1. Nova configuracao no banco de dados
Inserir nova chave `operacional_fipe_minimo_rastreador_moto` com valor `9000` na tabela `configuracoes`.

### 2. Atualizar hook `useConfigRastreador.ts`
- Adicionar novo hook `useConfigFipeRastreadorMoto()` que busca a chave `operacional_fipe_minimo_rastreador_moto` (fallback: R$9.000)
- Atualizar a funcao `precisaRastreador` para aceitar um parametro opcional `tipoVeiculo` (default `'automovel'`), aplicando o limite correto conforme o tipo

### 3. Atualizar `InstaladorChecklist.tsx`
- Importar e usar o novo hook para motos
- Passar `tipoVeiculo` na chamada de `precisaRastreador` para que motos usem o limite de R$9.000

### 4. Atualizar `ExecutarVistoriaCompleta.tsx`
- Mesma logica: detectar tipo de veiculo e passar para `precisaRastreador`

## Arquivos Modificados (3) + Migracao (1)
1. **Migracao SQL** -- inserir config `operacional_fipe_minimo_rastreador_moto = 9000`
2. `src/hooks/useConfigRastreador.ts` -- novo hook + funcao atualizada
3. `src/pages/instalador/InstaladorChecklist.tsx` -- usar limite correto por tipo
4. `src/pages/instalador/ExecutarVistoriaCompleta.tsx` -- usar limite correto por tipo
