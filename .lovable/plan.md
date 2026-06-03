## Diagnóstico

Investiguei o fluxo `whatsapp-webhook` → `agente-consultor-ia` e a tabela `maya_ia_faq`. A pronta resposta de Assistência 24h existe, está `ativo=true` e tem `audiencias=[associado, lead]` — então a estrutura está correta. O problema tem **duas camadas independentes**, e a IA pode estar travando antes mesmo de chegar na FAQ.

### Camada 1 — Por que ela "não respondeu nada" (silêncio total)

Em `agente-consultor-ia/index.ts` (linhas 220-227) existe este gate:

```
if (contato?.status === "atendimento_humano") {
  return { ignored: "atendimento_humano" }   // sem mandar nada
}
```

Se o número do operador tiver passado em algum momento por um transbordo (tool `solicitar_atendente_humano`, "Atender" no ChatPanel, ou pausa em `whatsapp_ia_pausas`), o `agente_ia_contatos.status` virou `atendimento_humano` e/ou existe pausa ativa por 12 h. A partir desse ponto **toda mensagem que chega é ignorada em silêncio** — a IA nem chega a montar prompt nem a olhar para a FAQ. Isso bate exatamente com "a IA não respondeu nada".

O `whatsapp-webhook` por sua vez só usa `whatsapp_ia_pausas.contexto_cortado_em` para cortar histórico — ele não bloqueia, mas também não avisa ao operador que a IA está pausada. Resultado: o operador acha que a IA quebrou, quando na verdade a conversa ficou "presa" no humano.

### Camada 2 — Por que, mesmo desbloqueada, a IA pode "não olhar" para a pronta resposta

A FAQ é carregada (`loadMayaEditorialConfig`, linhas 25-66) e injetada como bloco de texto no system prompt (linhas 1103-1105). Não há retrieval nem matching por `palavras_chave` — a seleção é 100% responsabilidade do Gemini. Pontos que enfraquecem isso hoje:

1. A pronta resposta atual tem `palavras_chave: []` vazio. O modelo só dispõe do texto da pergunta ("Sempre que os associados perguntarem...") + da resposta. Sem âncoras explícitas como `reboque`, `guincho`, `pane`, ele pode passar batido quando o cliente fala direto "preciso de reboque".
2. A `REGRA DE ORDEM` que manda "procurar primeiro na FAQ" só existe no prompt do **associado** (linha 694). No prompt do **lead** (que cobre número desconhecido / pré-CPF) e no prompt do **diretor** essa regra não existe — se o operador testou logado como diretor, a FAQ é filtrada por `audiencias.includes("diretor")` (vazia) e o prompt do diretor só fala de relatórios, então pedir reboque devolve silêncio ou desvio.
3. As 15 FAQs ativas viram um único bloco corrido por ordem — sem destaque, sem prioridade por categoria/intent. Quanto mais FAQ entrar, mais difícil o modelo casar a certa.

### Como confirmar qual camada disparou neste caso

Antes de mexer em código eu rodaria duas consultas rápidas no telefone do operador (precisamos do número que ele testou):
- `SELECT status FROM agente_ia_contatos WHERE telefone = '<tel>'` → se vier `atendimento_humano`, é Camada 1.
- `SELECT motivo, pausada_ate, encerrada_em FROM whatsapp_ia_pausas WHERE telefone = '<tel>' ORDER BY criada_em DESC LIMIT 1` → se houver pausa ativa, é Camada 1.

Sem o número, o palpite mais provável é Camada 1 (sintoma "nada" é específico desse caminho).

## Plano de correção

### 1. Tirar o silêncio invisível (Camada 1)
- Em `agente-consultor-ia` (linha 220), em vez de só retornar `ignored`, **avisar o operador interno** uma única vez por janela: gerar uma `notificacoes_sistema` para Relacionamento informando "Maya recebeu mensagem em conversa pausada (telefone X)" — sem responder ao cliente, mas dando visibilidade.
- Adicionar a verificação de `whatsapp_ia_pausas` ativa também no `agente-consultor-ia` (hoje só existe lá em cima como corte de histórico em `whatsapp-webhook`), padronizando "pausa = silêncio justificado e logado".
- Adicionar saneamento da conversa do operador (zerar `status` e fechar pausa) via o botão "Concluir atendimento" do ChatPanel já existente — verificar se está limpando ambos (`agente_ia_contatos.status` e `whatsapp_ia_pausas.encerrada_em`). Se não estiver, ajustar.

### 2. Fazer a Maya realmente olhar para a pronta resposta (Camada 2)
- **Retrieval por palavra-chave antes de injetar a FAQ**: em `loadMayaEditorialConfig`, dado o texto da mensagem atual, marcar como "FAQ EM DESTAQUE" os itens cujo `palavras_chave` (ou tokens da `pergunta`/`resposta`) casam com a mensagem. O LLM continua vendo todas as FAQs, mas com um bloco `## FAQ EM DESTAQUE PARA ESTA MENSAGEM` no topo.
- **Auto-extrair palavras-chave** quando o operador salvar a FAQ vazia: na UI de `/relacionamento/maya-ia`, se `palavras_chave=[]`, gerar sugestão automática (tokenizar pergunta+resposta, remover stopwords) e mostrar como chips editáveis. Reduz o erro humano que aconteceu nesta pronta resposta de Assistência.
- **Estender a `REGRA DE ORDEM` para o branch de lead** (e mencionar FAQ no branch de diretor para casos operacionais). Hoje só associado tem essa instrução — é a razão de "se não fizer saudação a IA não entende o contexto" quando ainda não há CPF / quando é diretor testando.

### 3. Telemetria mínima
- Logar no `agente-consultor-ia` qual FAQ id casou (se alguma) e qual foi citada na resposta. Hoje não há registro — fica impossível auditar "a IA viu a pronta resposta?".

## Próximo passo

Preciso do telefone que o operador usou para confirmar se foi Camada 1 (silêncio por transbordo/pausa) ou Camada 2 (pronta resposta não casou). Pode me passar o número ou o nome do operador? Com isso eu trago o diagnóstico definitivo antes de mudar código.
