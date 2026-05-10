## Objetivo

Substituir a lógica do alerta de categoria (Placa Vermelha, Táxi, Aplicativo, etc.) para mostrar apenas o que **de fato** é vetado para aquela categoria — não itens que pertencem a outras linhas de produto.

## Diagnóstico

Hoje `gerarAlertaCategoriaElegibilidade` faz:

> "Para cada regra `tipo_placa`, se a categoria não estiver no `include`, adicione o item à lista de exclusões."

Isso traz lixo porque o catálogo tem dezenas de variantes do mesmo conceito (`70% FIPE`, `75% FIPE`, `Carro Reserva R$1.500`, `Carro Reserva R$2.200`, variantes -SP/-Lagos/-Diesel/-Aplicativo). Cada variante pertence a uma linha de produto distinta. Placa Vermelha não perde nada quando "70% FIPE" é vetado — ela usa "75% FIPE".

## Nova lógica (frontend, sem mexer no banco)

Em `src/utils/alertaCategoriaElegibilidade.ts`, substituir a função por uma versão que:

1. **Agrupa por nome-base** (sem sufixos `-Lagos`, `-SP`, `-Aplicativo`, `-Diesel`, deságios, regiões etc.) e também extrai o "conceito" (ex: `Carro Reserva`, `70% FIPE` → `% FIPE`, `Danos a Terceiros`, `Assistência 24h`, `Kit Gás`).

2. **Para cada conceito**, calcula:
   - `categoriasComAcesso` = conjunto de categorias (`placa_vermelha`, `taxi`, `leilao`, `aplicativo`, `nenhuma`, etc.) que têm **ao menos uma variante** desse conceito habilitada.
   - Se a categoria atual está em `categoriasComAcesso` → o conceito **NÃO** entra no alerta (ela tem alguma variante).
   - Se a categoria atual **não** está em `categoriasComAcesso`, mas a categoria `nenhuma` (perfil padrão) está → o conceito É uma exclusão real e entra no alerta.
   - Se nem `nenhuma` tem acesso → conceito experimental/restrito a casos específicos, ignora.

3. **Normalização de nome-base** mais robusta:
   - Remove tudo após primeiro ` - `, ` -`, ou `–`.
   - Colapsa whitespace.
   - Mapeia variantes "% FIPE" / "% Fipe" para o rótulo único `Cobertura FIPE`.
   - Mapeia "Taxa Administrativa..." → ignora (já filtrado).
   - Agrupa "Carro Reserva R$X" sob `Carro Reserva`, "Danos a Terceiros R$X" sob `Danos a Terceiros`, "Kit Gás R$X" sob `Kit Gás`, "Assistência 24h XXXkm" sob `Assistência 24h`.

4. Mantém o filtro de `Taxa Administrativa` e ignora itens cujo conceito agrupado já foi considerado.

## Exemplo do resultado esperado

Antes (Placa Vermelha): lista de 18 itens incluindo `70% FIPE`, várias `Assistência 24h 1000km`, `Carro Reserva 30 dias R$1.500`, `Carro Reserva 30 dias R$2.200`, `Danos a Terceiros R$10.000/40.000/100.000`, `Kit Gás R$1.500/2.200`, `Clube Gás`, `Chuva de Granizo`, `Colisão`, `Alagamento`, `Rastreador/Monitoramento`.

Depois (Placa Vermelha): vazio ou pequeno (provavelmente vazio, já que ela tem acesso à linha 75% completa). Se aparecer algo, será só o que **realmente** falta vs. um perfil sem categoria.

## Arquivos afetados

- `src/utils/alertaCategoriaElegibilidade.ts` — única alteração.

Os 2 callers (`CotacaoFormDialog.tsx` e `EtapaResultado.tsx` e `EtapaCategoriaVeiculo.tsx`) continuam chamando a mesma assinatura — só a implementação interna muda.

## Validação

1. Cotação Rápida → Placa Vermelha → alerta deve sumir (ou conter apenas exclusões reais que afetam todas as linhas).
2. Selecionar Leilão → alerta deve mostrar exclusões reais (provavelmente "Roubo", "Furto", coberturas que linhas 70%/75% normais bloqueiam para leilão).
3. Selecionar Táxi / Ex-Táxi → idem, validar que aparecem apenas itens que nenhuma linha aceita para essa categoria.
4. Selecionar Aplicativo → validar.
5. Conferir tela de Cotação completa (`/cotacao` etapa categoria) com mesmas categorias.

## Fora de escopo

- Não mexer em `entity_eligibility_rules` no banco.
- Não renomear coberturas no catálogo.
- Não ajustar lógica de filtragem de planos (continua igual — só o texto do alerta muda).
