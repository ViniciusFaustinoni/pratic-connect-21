## Problema

Na etapa de Vistoria da contratação pública (ex.: placa LTB4J74), o cliente vê as 3 opções (Autovistoria, Técnico vai até mim, Levar à Base) mesmo quando o consultor já travou o cenário de adesão como **+ Base** (isenta_adesao + base ou cobra_adesao + base). A opção "Quero que o técnico venha até mim" é incoerente nesse caso, pois implica instalação em rota.

A cotação já tem `tipo_instalacao` salvo (`'rota'` ou `'base'`), derivado do `cenario_adesao` escolhido pelo consultor, e esse valor já é passado como prop `tipoInstalacao` para `EtapaVistoria` e `EscolhaLocalVistoria`. Hoje ele é usado apenas para marcar uma das opções como "Sugerido" — não para esconder a opção contrária.

## Solução

Tornar `tipoInstalacao` decisivo (não apenas sugestivo) na escolha do local da vistoria/instalação:

- `tipoInstalacao === 'base'` → esconder o card **"Quero que o técnico venha até mim"** (rota)
- `tipoInstalacao === 'rota'` → esconder o card **"Quero levar meu veículo à Base"**
- `tipoInstalacao` nulo/indefinido → manter as duas opções (comportamento atual)
- O card **Autovistoria** continua sempre visível quando o plano tem cobertura R&F (regra atual, não muda)

Como consequência, o badge "Sugerido" deixa de fazer sentido (sobra só uma opção) — remover o badge nesses cards.

## Arquivos a alterar

1. **`src/components/cotacao-publica/EtapaVistoria.tsx`**
   - Envolver o "Card 2: Técnico vai até o cliente" em `{tipoInstalacao !== 'base' && (...)}`
   - Envolver o "Card 3: Cliente leva à Base" em `{tipoInstalacao !== 'rota' && (...)}`
   - Remover os spans "Sugerido" desses dois cards (ficam redundantes)

2. **`src/components/cotacao-publica/EscolhaLocalVistoria.tsx`**
   - Mesma lógica: ocultar o card `Home` quando `tipoInstalacao === 'base'` e ocultar o card `Building2` quando `tipoInstalacao === 'rota'`
   - Atualizar o comentário "Sempre mostrar as 2 opções" e o subtítulo conforme o caso (quando há só uma opção, simplificar o texto introdutório)

## Não muda

- Backend, edge functions, schema e regras de pricing/comissão
- Lógica de Autovistoria (continua condicionada ao plano R&F)
- `tipo_instalacao` continua vindo da cotação (não é recalculado aqui)

## Validação

- Cotação com `cenario_adesao = 'isenta_base'` ou `'cobra_base'` → etapa Vistoria mostra apenas Autovistoria (se elegível) + Levar à Base
- Cotação com `cenario_adesao = 'isenta_rota'` ou `'cobra_rota'` → mostra apenas Autovistoria (se elegível) + Técnico vai até mim
- Cotação sem cenário definido → mostra as 3 opções (fallback atual)
