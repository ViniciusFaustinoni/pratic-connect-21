

# Corrigir Fluxo de Assistencia 24h via WhatsApp

## Problema

Quando o associado pede reboque pelo WhatsApp, a IA tem 3 falhas:

1. **Nao pergunta endereco detalhado de retirada** (proximo a qual numero, ponto de referencia)
2. **Nao pergunta o destino** (para onde o veiculo sera levado — oficina, residencia, etc.)
3. **Nao cria o chamado na fila** — registra apenas uma "solicitacao pendente de aprovacao" na tabela `chat_solicitacoes_ia`, ao inves de criar o chamado diretamente na tabela `chamados_assistencia` (que e a fila real vista na tela "Assistencia 24h > Chamados")

## Solucao

### Mudanca 1 — Atualizar System Prompt (coleta de dados para assistencia)

No `WHATSAPP_SYSTEM_PROMPT`, a secao "Coleta de Dados para ASSISTENCIA 24H" sera expandida de 4 para 6 itens:

**Antes:**
1. Tipo do servico
2. Localizacao atual
3. Descricao do problema
4. Tipo de veiculo

**Depois:**
1. Tipo do servico (guincho, chaveiro, troca de pneu, pane seca, pane eletrica)
2. Localizacao de retirada — endereco completo com numero ou ponto de referencia proximo. Perguntar: "Proximo a qual numero ou ponto de referencia voce esta?"
3. Destino — para onde o veiculo sera levado. Perguntar: "Para onde o veiculo deve ser levado? (oficina, residencia, outro endereco)"
4. Descricao do problema
5. Tipo de veiculo (carro ou moto)
6. Se for guincho vinculado a sinistro, o local do sinistro ja serve como origem

### Mudanca 2 — Atualizar tool `criar_solicitacao_assistencia` (parametros)

Adicionar campos `destino` e `endereco_numero` ao schema da tool:

```
properties: {
  tipo_servico: { type: "string", enum: [...] },
  localizacao: { type: "string", description: "Endereco completo de retirada com numero ou referencia" },
  destino: { type: "string", description: "Endereco de destino (oficina, residencia, etc.)" },
  descricao: { type: "string" },
}
required: ["tipo_servico", "localizacao", "destino", "descricao"]
```

### Mudanca 3 — Criar chamado diretamente na fila (principal)

Alterar o case `criar_solicitacao_assistencia` para inserir diretamente na tabela `chamados_assistencia` (ao inves de `chat_solicitacoes_ia`). O fluxo sera:

1. Verificar cobertura total (ja existe)
2. Verificar se ja tem chamado em aberto (novo)
3. Buscar veiculo ativo do associado
4. Inserir na `chamados_assistencia` com:
   - `protocolo`: gerado no formato `ASS-YYYYMMDD-XXXX`
   - `associado_id`: do contexto
   - `veiculo_id`: do veiculo ativo
   - `tipo_servico`: guincho, chaveiro, etc.
   - `origem_endereco`: localizacao informada
   - `destino_endereco`: destino informado
   - `descricao`: descricao do problema
   - `canal`: 'whatsapp'
   - `status`: 'aberto'
5. Inserir historico em `chamados_assistencia_historico`
6. Retornar protocolo ao associado

Isso faz o chamado aparecer imediatamente na fila de "Assistencia 24h > Chamados" com status "Aberto".

### Mudanca 4 — Aplicar mesma correcao no assistente do App

O `assistente-chat/index.ts` tambem tem uma tool `criar_solicitacao_assistencia` que salva em `chat_solicitacoes_ia`. Aplicar a mesma mudanca para criar diretamente em `chamados_assistencia`.

---

## Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/whatsapp-webhook/index.ts` | System prompt (coleta assistencia), tool schema (destino), case handler (inserir em chamados_assistencia) |
| `supabase/functions/assistente-chat/index.ts` | Mesma mudanca no handler de criar_solicitacao_assistencia |

---

## Detalhes Tecnicos

**Geracao de protocolo no webhook:**
```typescript
const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
const protocolo = `ASS-${dateStr}-${random}`;
```

**Insert em chamados_assistencia:**
```typescript
const { data: chamado, error } = await supabase
  .from("chamados_assistencia")
  .insert({
    protocolo,
    associado_id: associadoId,
    veiculo_id: veiculo.id,
    tipo_servico: args.tipo_servico,
    descricao: args.descricao,
    origem_endereco: args.localizacao,
    destino_endereco: args.destino,
    canal: 'whatsapp',
    status: 'aberto',
    data_abertura: new Date().toISOString(),
  })
  .select("id, protocolo")
  .single();
```

**Historico:**
```typescript
await supabase.from("chamados_assistencia_historico").insert({
  chamado_id: chamado.id,
  status_novo: 'aberto',
  observacao: `Chamado aberto via WhatsApp - ${args.tipo_servico}`,
});
```

**Verificacao de chamado duplicado:**
```typescript
const { data: chamadoExistente } = await supabase
  .from("chamados_assistencia")
  .select("id, protocolo, status")
  .eq("associado_id", associadoId)
  .in("status", ['aberto', 'aguardando_prestador', 'prestador_despachado', 'prestador_a_caminho', 'em_atendimento'])
  .maybeSingle();

if (chamadoExistente) {
  return JSON.stringify({
    sucesso: false,
    message: `Voce ja tem um chamado em aberto (${chamadoExistente.protocolo}). Aguarde a conclusao antes de abrir outro.`
  });
}
```

