# IA: 2ª via de boleto via SGA + transbordo

Adicionar à IA do WhatsApp Meta (assistente que já atende associados via `whatsapp-meta-webhook` → `whatsapp_fila_ia` → `assistente-chat`) um sub-fluxo dedicado a **2ª via de boleto**: associado pede boleto → IA pergunta CPF → consulta SGA → confirma veículo/placa → consulta boletos no SGA → envia boleto **ou** faz transbordo conforme regra de prazo.

## Escopo

- **Quando dispara:** quando o associado conhecido envia mensagem com intenção de boleto/2ª via (palavras-chave + reconhecimento pela IA). Não afeta o fluxo de sinistro, assistência, troca, etc.
- **Quando NÃO dispara:** mensagens de número desconhecido continuam indo para `agente-consultor-ia` (não é alvo desta entrega).

## Comportamento desejado (passo a passo)

1. **IA pergunta CPF** do associado (mesmo já estando vinculado pelo telefone, porque a consulta no SGA usa CPF).
2. **Busca SGA** via `sga-buscar-associado-completo` (endpoint `/buscar/cpf`, já existente — não cria nada novo).
3. **1 veículo** → IA responde: "Encontrei seu cadastro e o veículo placa **XXX-0000**. Quer a 2ª via do boleto?". Confirmação positiva → vai pro passo 5 com essa placa.
4. **>1 veículo** → IA lista as placas e pergunta de qual veículo é o boleto. Cliente responde com a placa.
5. **Consulta boletos** no SGA via endpoint `/listar/boleto-associado-veiculo` filtrando por `placa` e janela `data_vencimento_inicial`/`final` = hoje−30d até hoje+60d, `link_boleto: true`. Pega o **boleto aberto mais relevante** (preferência: vencimento mais próximo).
6. **Decisão por prazo do boleto (regra do usuário):**
   - **Não vencido OU vencido há ≤ 5 dias** → IA envia mensagem com: linha digitável, link do boleto, PIX copia-e-cola e QR Code (imagem).
   - **Vencido há ≥ 6 dias** → IA envia mensagem amigável "vou transferir você para um humano" e dispara o **transbordo** (sem mandar o boleto).

## Transbordo

- Atualiza `contato_ia.status='atendimento_humano'` (padrão já usado por `agente-consultor-ia`) para a IA parar de responder esse telefone.
- O chat em `/eventos/chat-ia` passa a destacar esse contato com **badge "Transbordo (boleto)"** em cor de alerta (amber/orange) e cor de borda diferente no card da lista, para o Relacionamento priorizar.
- Mensagem ao cliente: "Vou te transferir para um atendente humano agora. Em breve alguém vai continuar o atendimento por aqui."

## Mudanças técnicas

**Sem mudanças de schema.** `contato_ia` e `whatsapp_meta_templates` já existem; o status `atendimento_humano` já é o canônico.

**Edge function `assistente-chat`** (`supabase/functions/assistente-chat/index.ts`):
- Adicionar 3 tools novas:
  - `identificar_associado_sga(cpf)` — invoca `sga-buscar-associado-completo`; retorna nome, lista de veículos.
  - `consultar_boletos_placa(placa)` — invoca um novo wrapper edge `sga-listar-boletos-placa` (chama `POST /listar/boleto-associado-veiculo` com `placa` + janela 90d e `link_boleto:true`) ou estende `sga-listar-boletos-associado` para aceitar placa direta — a escolha vai depender da assinatura atual da função (avaliar em build).
  - `transbordo_atendimento(motivo)` — seta `contato_ia.status='atendimento_humano'` para o telefone da conversa e devolve OK.
- Atualizar o **system prompt** com o fluxo acima (regras explícitas: pedir CPF antes de qualquer outra coisa quando intenção for boleto/2ª via; nunca enviar boleto sem confirmação da placa; regra dos 6 dias).
- A IA decide envio do boleto via mensagem direta (linha digitável + link + PIX) e, quando houver `pix.qrcode` no retorno SGA, dispara `whatsapp-send-media` com a imagem do QR.

**UI `/eventos/chat-ia`** (`src/components/eventos/chat-ia/*` — lista de contatos):
- Adicionar leitura de `agente_consultor_contatos.status` (ou tabela equivalente onde a IA pausa) pelo telefone do contato.
- Renderizar badge "Transbordo" (cor amber) e destacar borda do card quando `status='atendimento_humano'`.
- Filtro opcional na toolbar: "Somente transbordo".

## Detalhes técnicos

```text
WhatsApp (Meta)
   │
   ▼
whatsapp-meta-webhook  ──► (associado conhecido) ──► whatsapp_fila_ia
                                                          │
                                                          ▼
                                                   assistente-chat
                                       (novo) ─── tools SGA + transbordo
                                                          │
                                  ┌───────────────────────┼────────────────────────┐
                                  ▼                       ▼                        ▼
                       identificar_associado    consultar_boletos_placa     transbordo_atendimento
                            (CPF→SGA)              (placa→SGA boletos)        (contato_ia=atendimento_humano)
```

Critérios de decisão do boleto (calculados na própria tool):
- `diasVencido = max(0, hoje - data_vencimento)` em dias úteis-cor (corridos basta).
- `≤ 5` → envia conteúdo. `≥ 6` → transbordo.
- Quando vários boletos abertos: prioriza o **mais antigo em aberto**; se todos ≥6d, transbordo imediato.

## O que NÃO faz parte desta entrega

- Não altera o fluxo de número desconhecido (`agente-consultor-ia`).
- Não altera o fluxo de cobrança em massa via CSV (`disparar-cobranca-csv-meta`).
- Não muda schema do banco.
- Não cria tela de relatório de transbordos (só o badge no chat).

## Verificação pós-deploy

1. Mensagem "preciso do boleto" enviada por um associado conhecido com 1 veículo → IA pede CPF → após CPF, confirma placa e envia boleto.
2. Mesma mensagem para associado com 2+ veículos → IA pergunta a placa → envia boleto da placa escolhida.
3. Simular boleto vencido há 7+ dias (associado de teste) → IA não envia, marca transbordo e badge aparece em `/eventos/chat-ia`.
4. Conferir logs de `assistente-chat` para confirmar chamadas às novas tools e às edges SGA.
