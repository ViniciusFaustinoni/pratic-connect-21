# Bug: drawer e transbordo mostram associado errado quando 2 cadastros compartilham telefone

## Causa raiz

Dois associados ativos compartilham o telefone `21982244909`:
- MARCOS VINICIUS DATIVO MACHADO (autor real da conversa)
- LUIZ FERNANDO DE SOUZA FILHO

A resolução de "associado por telefone" no front (`ContatoDetalheDrawer.tsx`, e mesma lógica na lista de Transbordo) faz `select … .or(ilike %tel%) .limit(1).maybeSingle()` sem `order by` nem preferência por match exato — Postgres devolve qualquer linha, e está caindo no LUIZ. O cabeçalho do chat acerta porque vem da última mensagem em `whatsapp_mensagens` (que tem o `push_name`/contato real do WhatsApp).

Não é problema da IA, do boleto, da identificação, do roteador, nem do envio. É só a resolução de "qual associado pertence a este telefone" no front, quando há colisão.

## Escopo desta correção (frontend-only)

1. **`ContatoDetalheDrawer.tsx`** — trocar a busca por uma que:
   - Busque TODOS os associados que casam pelo telefone normalizado (sem `limit(1)`).
   - Prefira o associado cujo `nome` (case-insensitive, sem acento) corresponda ao `nomeContato` que o ChatPanel já passa via prop (o nome que veio do WhatsApp, ex.: "MARCOS VINICIUS DATIVO MAC...").
   - Fallback: se nenhum nome casar, NÃO escolher arbitrariamente — mostrar bloco "Mais de um cadastro vinculado a este telefone" listando os candidatos (nome + status + botão "Abrir cadastro"), e ocultar o "Abrir cadastro completo" único.
   - Match exato `telefone = '<norm>'` ganha prioridade sobre `ilike %…%` (evita pegar telefone que apenas contém os mesmos dígitos).

2. **Fila de Transbordo (`/relacionamento/transbordos`)** — aplicar a mesma desambiguação:
   - Localizar o hook/componente que resolve `associado` a partir do `telefone` da pausa de transbordo.
   - Quando houver colisão, exibir o nome que veio da própria conversa (`whatsapp_mensagens.push_name` ou `agente_ia_contatos.nome`) em vez do primeiro associado retornado. Se ainda assim ambíguo, marcar a linha com um chip discreto "⚠ múltiplos cadastros" e manter o nome do WhatsApp.

3. **Sem migração de dados.** Não fundir nem renumerar os dois cadastros — a duplicidade de telefone é dado real e pode existir legitimamente (familiares no mesmo número). Só corrigir a UI para não inventar associação.

## Fora de escopo

- IA / prompt / validador de saída / tool de transbordo.
- Boleto, situação do veículo, identificação, roteador, envio.
- Habilidade vendas.
- Receptiva no ar — não tocar.
- Gravação automática de resumo/eventos (etapa seguinte separada).

## Arquivos previstos

- `src/components/eventos/chat-ia/ContatoDetalheDrawer.tsx` — trocar query e renderização quando houver múltiplos.
- Componente/hook da tela `Transbordo` (a confirmar na implementação) — mesma desambiguação.

## Validação

- Abrir o chat do MARCOS (telefone 21982244909): drawer deve mostrar "MARCOS VINICIUS DATIVO MACHADO", não LUIZ.
- Abrir o chat de qualquer telefone sem colisão: comportamento inalterado.
- Tela `/relacionamento/transbordos` para esse telefone deve mostrar "MARCOS VINICIUS …" (nome da conversa), não LUIZ.
