

# Proteção 360° para Veículos sem Rastreador (via Autovistoria Completa)

## Problema

Hoje, ao aprovar uma proposta, o sistema sempre define `cobertura_roubo_furto: true` e `cobertura_total: false` quando não há instalação concluída — aguardando o instalador ativar a proteção 360°. Porém, veículos com FIPE abaixo do limite de rastreador (R$30k padrão) **nunca terão instalador**. Para esses casos, a autovistoria completa (31 fotos + vídeo 360°) feita pelo associado substitui a vistoria do instalador, e o cadastro analisa e libera a proteção 360° diretamente.

## Mudanças

### 1. Aprovação da proposta — `src/hooks/usePropostasPendentes.ts`

Na mutation `useAprovarProposta`, após buscar o veículo, verificar se ele precisa de rastreador usando `precisaRastreador(valorFipe, fipeMinimo)`:

- **Se NÃO precisa de rastreador**: definir `cobertura_roubo_furto: true`, `cobertura_total: true`, `status: 'ativo'`. Não criar instalação. Mensagem: "Proteção 360° ativada (sem rastreador)."
- **Se precisa de rastreador**: manter fluxo atual (roubo/furto → aguardar instalação).

Buscar `valor_fipe` do veículo (já disponível na tabela `veiculos`) e os limites de configuração (`operacional_fipe_minimo_rastreador`).

### 2. Autovistoria completa no link público — `src/pages/public/CotacaoPublicaCompleta.tsx`

Condicionar a lista de fotos exigida:
- Se `!precisaRastreador(valor_fipe, fipeMin)`: usar `FOTOS_VISTORIA_COMPLETA` (31 fotos, excluindo categoria `instalacao`) + vídeo 360° obrigatório.
- Se precisa de rastreador: manter as 18 fotos atuais (`FOTOS_VISTORIA_CONFIG`) + vídeo 360° obrigatório.

### 3. Autovistoria no fluxo interno — `src/components/cotacao-publica/AutovistoriaCotacao.tsx` e `EtapaVistoria.tsx`

Aceitar prop `precisaRastreador` e condicionar fotos da mesma forma.

### 4. Hook de coberturas — `src/hooks/useMinhasCoberturasApp.ts`

Atualizar a `mensagemCoberturaParcial`: quando `temCoberturaRouboFurto && !temCoberturaTotal`, a mensagem atual menciona "instalação do rastreador". Para veículos sem rastreador, essa mensagem não deveria aparecer — mas como `cobertura_total` já será `true` na aprovação, isso se resolve automaticamente.

## Resumo de arquivos

| Arquivo | Ação |
|---------|------|
| `src/hooks/usePropostasPendentes.ts` | Buscar `valor_fipe` do veículo, verificar `precisaRastreador`, condicionar cobertura e skip de instalação |
| `src/pages/public/CotacaoPublicaCompleta.tsx` | Condicionar fotos 31 vs 18 baseado em FIPE/rastreador |
| `src/components/cotacao-publica/AutovistoriaCotacao.tsx` | Prop `precisaRastreador`, fotos completas quando sem rastreador |
| `src/components/cotacao-publica/EtapaVistoria.tsx` | Repassar prop |

