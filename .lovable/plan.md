
# Botao "Enviar Link de Agendamento de Vistoria" na Tela de Analise

## Contexto

Atualmente, apos o associado completar as 3 etapas da auto-vistoria (fotos, B.O., relato), ele precisa agendar a vistoria presencial do regulador (Etapa 4). O componente `EventoAgendamento` ja existe e funciona via link publico (`/evento/:token`). Porem, o analista de eventos nao tem um botao na tela de analise para enviar esse link de agendamento via WhatsApp ao associado.

## O que sera feito

### 1. Botao na tela de analise (`SinistroAnalise.tsx`)

Adicionar um botao **"Enviar Link de Agendamento"** no card de Acoes, visivel quando:
- O `linkEvento` existe
- As 3 etapas foram completadas (`etapa_atual >= 3` ou `etapa3_completada_em` preenchido)
- A etapa 4 (agendamento) ainda NAO foi completada (`etapa4_completada_em` nulo)

O botao ficara no bloco de acoes do analista, com icone de calendario.

### 2. Acao do botao — Enviar WhatsApp com link de agendamento

Ao clicar, o sistema:
1. Busca o telefone do associado (ja disponivel em `sinistro.associado`)
2. Monta a mensagem com saudacao e explicacao do agendamento
3. Inclui o link `{SITE_URL}/evento/{token}` (que ja leva a Etapa 4 automaticamente quando as 3 anteriores estao completas)
4. Envia via `whatsapp-send-text` edge function
5. Mostra toast de sucesso/erro

A mensagem enviada sera algo como:

```
Ola {nome}!

As informacoes do seu sinistro {protocolo} foram recebidas com sucesso!

Agora, para darmos andamento ao processo de reparo, voce precisa agendar a vistoria presencial do regulador.

Acesse o link abaixo para escolher a data e horario:
{link}

O regulador ira ate o endereco que voce informar para avaliar os danos.

ABP PraticCar
```

### 3. Tela do regulador — Atualizacao automatica

A tela do regulador (`ReguladorHome.tsx`) ja busca dados da tabela `vistorias_evento` via `useVistoriasEvento`. Quando o associado completa o agendamento (Etapa 4), o `agendar-vistoria-evento` edge function ja insere um registro em `vistorias_evento` e notifica reguladores via tabela `notificacoes`. Portanto, **a tela do regulador ja se atualiza automaticamente** — nenhuma mudanca necessaria la.

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar botao "Enviar Link de Agendamento" no card de Acoes + estado de loading + handler que chama `whatsapp-send-text` |

## Detalhes Tecnicos

No `SinistroAnalise.tsx`:

1. Adicionar estado `const [enviandoLinkAgendamento, setEnviandoLinkAgendamento] = useState(false)`
2. Criar funcao `handleEnviarLinkAgendamento` que:
   - Busca telefone de `associado.whatsapp || associado.telefone`
   - Monta mensagem com `linkEvento.token` usando SITE_URL `https://pratic-connect-21.lovable.app`
   - Chama `supabase.functions.invoke('whatsapp-send-text', { body: { telefone, mensagem } })`
   - Exibe toast de sucesso/erro
3. Renderizar o botao no card de acoes, apos o bloco de checklist do analista, condicionado a:
   - `linkEvento` existir
   - `linkEvento.etapa_atual >= 3` (3 etapas concluidas)
   - `!linkEvento.etapa4_completada_em` (agendamento ainda nao feito)
4. Se `linkEvento.etapa4_completada_em` existir, mostrar badge "Agendamento realizado" em vez do botao

## Resultado

- Analista ve botao claro para enviar link de agendamento ao associado
- Associado recebe WhatsApp com saudacao e link para agendar vistoria
- Apos agendamento, a vistoria aparece automaticamente no dashboard do regulador
