## Objetivo

Padronizar o primeiro contato da IA no WhatsApp: ela **só** responde a mensagem fixa abaixo até o usuário enviar um CPF válido, e só depois disso passa a conversar/vender/atender:

> "Olá! Tudo bem? Para iniciarmos o seu atendimento e localizarmos seu cadastro, por gentileza, informe o seu CPF. 😁"

Quando o CPF chegar, o sistema consulta o SGA (Hinova) via `sga-buscar-associado-completo` e usa o resultado para rotear:
- **CPF encontrado** → roteia para o prompt de associado já com os dados ("Encontrei seu cadastro, …").
- **CPF não encontrado no SGA** → roteia para o prompt de lead (vendas), informando ao usuário que não localizou cadastro e seguindo o fluxo de cotação.

## Onde o gate vive

Tudo no edge `agente-consultor-ia` (já é o cérebro da IA). Nada muda no `whatsapp-webhook` nem no `processar-fila-ia`. O `ChatPanel`/UI não é tocado.

## Diagnóstico

- `agente_ia_contatos` hoje guarda: `telefone, nome, status, ultima_interacao, dados_cotacao, resetado_em`. **Não tem coluna `cpf`** — precisa criar.
- `agente-consultor-ia/index.ts` decide o caminho em 3 ramos: diretor (por telefone+role), associado (por telefone na tabela `associados`), lead (default).
- `sga-buscar-associado-completo` já existe e aceita `{ cpf }` retornando associado + veículos + boletos. Reusar.
- `detectar-associado-por-cpf` já tem a validação canônica de CPF (`validateCpf` com dígitos verificadores) — reusar a função.

## Decisões de escopo

1. **Quem é exigido a passar CPF**: lead novo OU contato detectado como "associado por telefone" mas sem CPF no `agente_ia_contatos`. O gate só é pulado quando o telefone bate com um **diretor** (uso interno, não faz sentido pedir CPF).
2. **Validação**: regex de 11 dígitos (aceita com pontuação) + dígitos verificadores (mesma função do `detectar-associado-por-cpf`). CPF inválido → tratada como "não enviou CPF" + resposta curta "Esse CPF não parece válido. Pode conferir e me enviar de novo? 😉".
3. **Reenvio da mensagem fixa**: enquanto o usuário não mandar CPF válido, cada mensagem recebida dispara a mensagem padrão **uma única vez por janela de 10 min** (evita poluir o chat quando o cliente digita várias coisas seguidas). Janela controlada por timestamp em `agente_ia_contatos.cpf_solicitado_em`.
4. **Confirmação ao identificar**: ao salvar o CPF, a IA confirma o achado na mesma resposta:
   - SGA achou: "Encontrei seu cadastro, *{NOME}*! Como posso te ajudar hoje?" + segue prompt de associado.
   - SGA não achou: "Não localizei cadastro com esse CPF. Vamos seguir com uma cotação?" + segue prompt de lead.
5. **Pausa/transbordo**: gate respeita `whatsapp_ia_pausas` (já tratado a montante em `processar-fila-ia`) e `contato.status='atendimento_humano'` (já tratado no edge).

## Mudanças

### 1. Migration: campos no `agente_ia_contatos`

```sql
ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS cpf_capturado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cpf_solicitado_em timestamptz,
  ADD COLUMN IF NOT EXISTS sga_associado_encontrado boolean;

CREATE INDEX IF NOT EXISTS idx_agente_ia_contatos_cpf
  ON public.agente_ia_contatos(cpf) WHERE cpf IS NOT NULL;
```

Sem mudança em RLS/GRANTs — a tabela já existe e o edge usa service role.

### 2. `supabase/functions/agente-consultor-ia/index.ts`

Após o bloco 1B (resolver nome) e **antes** do "VERIFICAR ATENDIMENTO HUMANO" decisão de prompt, inserir bloco **"GATE DE CPF"**:

Pseudocódigo:
```ts
// ---- 1C. GATE DE CPF (skip diretores) ----
const isDiretorPorTelefone = /* lookup direto profiles+user_roles, mantém código atual */;

if (!isDiretorPorTelefone && !contato.cpf) {
  const cpfExtraido = extrairCpf(texto);            // regex /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/
  
  if (cpfExtraido && validateCpf(cpfExtraido)) {
    // Salva CPF + consulta SGA
    const cpfLimpo = cpfExtraido.replace(/\D/g, '');
    const sga = await invokeEdge('sga-buscar-associado-completo', { cpf: cpfLimpo });
    
    await supabase.from('agente_ia_contatos').update({
      cpf: cpfLimpo,
      cpf_capturado_em: new Date().toISOString(),
      sga_associado_encontrado: !!sga?.encontrado,
      nome: sga?.associado?.nome || contato.nome,
    }).eq('id', contato.id);
    
    contato.cpf = cpfLimpo;
    contato.sga = sga;                              // injetado abaixo no prompt
    // Cai no fluxo normal logo abaixo, que agora terá contexto de associado/lead
  } else if (cpfExtraido) {
    // Veio algo que parece CPF mas inválido
    await enviarWhatsApp(telefone, 'Esse CPF não parece válido. Pode conferir e me enviar de novo? 😉');
    return 200;
  } else {
    // Não veio CPF — reenvia padrão (debounce 10 min)
    const ultimaSolicitacao = contato.cpf_solicitado_em ? new Date(contato.cpf_solicitado_em) : null;
    const podeReenviar = !ultimaSolicitacao || (Date.now() - ultimaSolicitacao.getTime()) > 10 * 60_000;
    if (podeReenviar) {
      await enviarWhatsApp(telefone,
        'Olá! Tudo bem? Para iniciarmos o seu atendimento e localizarmos seu cadastro, por gentileza, informe o seu CPF. 😁'
      );
      await supabase.from('agente_ia_contatos').update({
        cpf_solicitado_em: new Date().toISOString(),
      }).eq('id', contato.id);
    }
    return 200;
  }
}
```

Reaproveitar:
- `validateCpf` — copiar a função do `detectar-associado-por-cpf` para um helper local (ou importar via `_shared`).
- `enviarWhatsApp` — fetch para `whatsapp-send-text` (já usado em outras partes do edge).
- `sga-buscar-associado-completo` — chamado via `supabase.functions.invoke()`.

### 3. Ajuste no prompt (mesmo arquivo)

Quando o contato **já tem CPF** + SGA encontrado, usar o ramo `isAssociado` que já existe (passar `associadoNome` da resposta SGA). Quando SGA não encontrou, segue ramo lead — mas o `systemPrompt` recebe um trecho extra no topo:

```
## CONTEXTO DE IDENTIFICAÇÃO
O cliente acabou de informar o CPF {mascarado}. ${sga.encontrado
  ? `Identificamos como associado: ${nome} (status ${status}).`
  : `Não encontramos cadastro com esse CPF — trate como lead em cotação.`}
NÃO peça o CPF de novo. NÃO repita a saudação de identificação.
```

### 4. Reset

O reset existente (`agente_ia_contatos.resetado_em`) NÃO limpa o CPF — operador que resetar a conversa não quer pedir CPF de novo do mesmo telefone (a menos que limpe manualmente). Se quiser limpar, faz UPDATE explícito de `cpf=NULL` (fora deste plano — pode virar follow-up de UI).

## Comportamento resultante

| Situação | Antes | Depois |
|---|---|---|
| Lead novo manda "oi" | IA inicia fluxo de venda do nada | Manda mensagem padrão pedindo CPF; só responde dúvidas depois do CPF |
| Lead manda CPF válido na 1ª msg | IA inicia venda sem identificar | Salva CPF, consulta SGA, confirma resultado e segue |
| CPF válido bate com associado SGA | Não conhece | Vira atendimento de associado (encaminha p/ central) |
| CPF inválido | — | Pede pra revisar |
| Diretor manda mensagem | Vai pro prompt de diretor | Igual (pulado pelo gate) |
| Contato já passou CPF antes | Volta a iniciar fluxo | Não pede de novo; segue conversa |
| Sem CPF, manda 5 mensagens seguidas | IA respondia (e iniciava venda) | Manda padrão 1x; ignora as outras dentro de 10 min |

## Fora de escopo

- UI para resetar/editar CPF manualmente (pode entrar depois no drawer do contato).
- Templates Meta — a mensagem padrão sai por `whatsapp-send-text` (texto livre dentro da janela 24h, que sempre existe quando o cliente está mandando msg).
- Persistir snapshot completo do SGA em outra tabela — usamos a chamada on-demand no momento do match e re-chamamos se necessário em mensagens subsequentes (já barato).

## Arquivos tocados

- `supabase/migrations/<timestamp>_agente_ia_contatos_cpf.sql` (4 colunas + 1 índice)
- `supabase/functions/agente-consultor-ia/index.ts` (bloco GATE DE CPF + injeção de contexto SGA no prompt)
