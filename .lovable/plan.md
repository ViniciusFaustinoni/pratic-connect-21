
# Pagamento da Cota como Etapa 5 no Link do Evento

## Objetivo

Unificar o fluxo do associado em uma unica tela. Em vez de enviar links diretos do Asaas para pagamento, o sistema enviara o link do evento (`/evento/:token`) onde o pagamento sera a **Etapa 5**, na mesma interface das etapas anteriores (Auto Vistoria, B.O., Relato, Agendamento).

## Situacao Atual

```text
Etapa 1: Auto Vistoria     -> /evento/:token
Etapa 2: B.O.               -> /evento/:token
Etapa 3: Relato             -> /evento/:token
Etapa 4: Agendamento        -> /evento/:token
---
Pagamento: /evento-aprovado/:token (pagina separada)
WhatsApp envia: link direto do Asaas (https://www.asaas.com/c/...)
```

## Fluxo Desejado

```text
Etapa 1: Auto Vistoria     -> /evento/:token
Etapa 2: B.O.               -> /evento/:token
Etapa 3: Relato             -> /evento/:token
Etapa 4: Agendamento        -> /evento/:token
Etapa 5: Pagamento          -> /evento/:token (PIX ou Cartao)
Sucesso                     -> /evento/:token
WhatsApp envia: /evento/:token
```

## Alteracoes

### 1. `src/components/evento/EventoStepper.tsx`
Adicionar etapa 5 "Pagamento" com icone `CreditCard` ao array de etapas. O stepper passara a ter 5 bolinhas.

### 2. `src/pages/public/EventoColisao.tsx`
- Importar `EventoPagamentoCota` (componente ja existente de pagamento com PIX/Cartao)
- Adicionar dados de `valor_cota_participacao`, `cota_paga`, `associado.cpf`, `associado.plano` ao tipo `EventoData`
- Ajustar logica de etapas:
  - `isCompleted` passa de `>= 3` para `>= 4` (apos agendamento)
  - Apos agendamento (etapa 4 completa), se nao pagou -> mostrar `EventoPagamentoCota` (etapa 5)
  - Se ja pagou -> mostrar `EventoSucesso`
- Ajustar stepper: `isAgendado ? 4 : etapaAtual` -> logica mais completa considerando pagamento

### 3. `supabase/functions/validar-link-evento/index.ts`
Retornar dados adicionais do sinistro necessarios para a tela de pagamento:
- `valor_cota_participacao`, `cota_paga`, `cota_paga_em`
- Dados do plano do associado (percentual, cota minima, nome do plano, valor FIPE do veiculo)
- CPF do associado

### 4. `supabase/functions/autentique-webhook/index.ts` (linhas 612-648)
Trocar a mensagem de WhatsApp: em vez de enviar `https://www.asaas.com/c/...`, enviar o link do evento `/evento/:token`. Para isso, buscar o token do link ativo do sinistro na tabela `sinistro_evento_links`.

### 5. `supabase/functions/retroativo-pagamento-termo/index.ts` (linhas 123-140)
Mesma correcao: trocar link direto Asaas pelo link do evento `/evento/:token`.

### 6. `src/pages/eventos/SinistroAnalise.tsx` (funcao `handleReenviarPagamento`, linhas 470-495)
Trocar `https://www.asaas.com/c/${cobranca.asaas_id}` pelo link do evento usando o token do `linkEvento`.

### 7. `supabase/functions/analisar-evento/index.ts`
Ja envia o link correto (`/evento-aprovado/:token`). Trocar rota para `/evento/:token` para manter consistencia, ja que agora o pagamento esta na mesma pagina do evento.

## Detalhes Tecnicos

### Logica de etapas no EventoColisao

```text
etapa_atual 0 -> Etapa 1 (Vistoria)
etapa_atual 1 -> Etapa 2 (B.O.)
etapa_atual 2 -> Etapa 3 (Relato)
etapa_atual 3 + sem etapa4_completada_em -> Etapa 4 (Agendamento)
etapa4_completada_em + cota_paga = false -> Etapa 5 (Pagamento)
cota_paga = true -> Sucesso
```

### Dados retornados pelo validar-link-evento (novos campos)

```text
sinistro: {
  ...campos_existentes,
  valor_cota_participacao,
  cota_paga,
},
cota: {
  valor_fipe,
  percentual,
  cota_minima,
  valor_cota,
  plano_nome,
},
associado: {
  ...campos_existentes,
  cpf
}
```

### Mensagem WhatsApp (padrao para todos os locais)

```text
Link de pagamento: https://pratic-connect-21.lovable.app/evento/{token}
```

Em vez de:

```text
Link de pagamento: https://www.asaas.com/c/{asaas_id}
```

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/components/evento/EventoStepper.tsx` | Adicionar etapa 5 (Pagamento) |
| `src/pages/public/EventoColisao.tsx` | Integrar pagamento como etapa 5 |
| `supabase/functions/validar-link-evento/index.ts` | Retornar dados de cota/pagamento |
| `supabase/functions/autentique-webhook/index.ts` | Trocar link Asaas por link evento |
| `supabase/functions/retroativo-pagamento-termo/index.ts` | Trocar link Asaas por link evento |
| `src/pages/eventos/SinistroAnalise.tsx` | Trocar link Asaas por link evento no reenvio |
| `supabase/functions/analisar-evento/index.ts` | Trocar rota `/evento-aprovado/` por `/evento/` |

Nenhuma migration de banco necessaria. A pagina `/evento-aprovado/:token` continuara funcionando para links ja enviados.
