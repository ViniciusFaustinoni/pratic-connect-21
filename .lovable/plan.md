
# Proteção 360° para Veículos sem Rastreador — IMPLEMENTADO

## Resumo

Veículos com FIPE abaixo do limite de rastreador (padrão R$30k) recebem proteção 360° diretamente após aprovação, sem necessidade de instalação. A autovistoria completa (31 fotos + vídeo 360°) substitui a vistoria do instalador.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePropostasPendentes.ts` | Busca `valor_fipe`, verifica `precisaRastreador`, ativa `cobertura_total=true` e pula criação de instalação para veículos sem rastreador |
| `src/pages/public/CotacaoPublicaCompleta.tsx` | Importa configs de rastreador, condiciona lista de fotos (31 vs 18), atualiza Alert e validação |
