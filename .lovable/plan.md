# Fechar os 2 pontos pendentes do isolamento

A remoção das 7 linhas de `vendas` e a limpeza da resposta `institucional` estão confirmadas. Faltam dois ajustes que não entraram na rodada anterior.

## 1. Substituir apresentação e instruções da habilidade `relacionamento`

Estado atual no banco (idêntico ao `vendas` — vazamento confirmado):

- `apresentacao_inicial`: "Olá! Sou o Vinicius, consultor virtual da Praticcar Proteção Veicular. Estou aqui para te ajudar a encontrar a melhor proteção para o seu veículo. Posso começar fazendo uma cotação gratuita para você?"
- `instrucoes_comportamento`: "Seja cordial e profissional. Use linguagem simples e direta. Em caso de dúvidas sobre sinistros, encaminhe para atendimento humano."

Substituir por texto canônico de atendimento receptivo ao associado, sem qualquer menção a cotação/venda, alinhado ao que já existe nas demais colunas da habilidade (`nome_agente='Atendimento Pratic'`, persona/regras/saudação) e no comportamento Maya de audiência `associado` da tabela legada `maya_ia_comportamento`:

- `apresentacao_inicial` (nova): "Olá! Aqui é o Atendimento Pratic. Sou o canal receptivo da Praticcar para os associados — ajudo com dúvidas sobre o plano, boletos, assistência 24h, agendamentos e direciono o que estiver fora do escopo para o time certo. Em emergências (sinistro, acidente, roubo, furto), aciono nossa equipe humana na mesma hora."
- `instrucoes_comportamento` (nova): "Atenda associados de forma cordial, objetiva e empática. Nunca ofereça plano, cotação, valor de adesão ou condições comerciais — isso não é receptiva. Sempre que o pedido fugir do escopo de atendimento ao associado (cotação de novo veículo, RH, imprensa, parcerias, comercial), responda com o item correspondente da categoria `direcionamento` do conhecimento; se o item estiver inativo ou sem destino, chame `solicitar_atendente_humano`. Em sinistro/emergência, chame `solicitar_atendente_humano` com motivo='sinistro_emergencia' e prioridade='alta' na mesma rodada. Nunca prometa ação humana ('vou avisar o time', 'vou pedir retorno') sem chamar a tool junto."

Operação: `UPDATE ia_habilidades SET apresentacao_inicial=..., instrucoes_comportamento=... WHERE slug='relacionamento'`. A linha `vendas` fica intocada (continua sendo backup do Vinicius). Tabelas legadas (`agente_ia_config`, `maya_ia_comportamento`) não são tocadas.

## 2. Corrigir texto da tela `src/pages/relacionamento/ConfigIA.tsx`

Dois trechos ainda mencionam "leads" e "diretoria":

- Linha 57 (subtítulo do cabeçalho): "Personalidade, conhecimento (FAQ), exemplos de resposta e ferramentas da IA que atende **leads e associados** no WhatsApp." → trocar por "...da IA que atende **associados** no WhatsApp."
- Linha 77 (texto do Alert principal): "Esta IA atende **leads**, **associados** e **diretoria** 24/7." → trocar por "Esta IA atende **associados** 24/7 (atendimento receptivo)."

O restante do Alert (kill-switch, parágrafo de direcionamento, frase sobre desligar) fica como está.

## Fora do escopo

- Nada na habilidade `vendas`.
- Nada no roteador, no transbordo, no kill-switch, nas tabelas legadas, na edge `agente-consultor-ia`.
- Sem nova migração de schema — só `UPDATE` em `ia_habilidades` (1 linha) e edição de 2 linhas de texto em 1 arquivo.

## Verificação ao final

- `SELECT apresentacao_inicial, instrucoes_comportamento FROM ia_habilidades WHERE slug='relacionamento'` — confirmar que não contém "Vinicius", "consultor", "cotação" nem "venda".
- Re-leitura de `ConfigIA.tsx` linhas 55–82 — confirmar ausência de "leads" e "diretoria".
- Reportar diff exato dos textos e contagem final inalterada (12 linhas de conhecimento na `relacionamento`).
