

# Correção na Raiz: Mensagens Meta API Não Entregues

## Diagnóstico

Analisei profundamente os logs, as edge functions e o banco de dados. O problema **não é que a API está travada** -- a Meta API **aceita** as mensagens (retorna status 200 e message_id). O problema real é:

### A Meta API descarta silenciosamente mensagens de texto livre fora da janela de 24h

A API Oficial da Meta tem uma regra rígida: mensagens de **texto livre** (não-template) só são entregues se o destinatário interagiu com o número nos últimos **24 horas**. Fora dessa janela, a Meta aceita a requisição com sucesso (200 OK) mas **nunca entrega** a mensagem.

### Evidência nos logs

```
[notificar-cliente] ⚠️ Meta ativo mas sem template mapeado para tipo 'tecnico_em_rota'.
    Enviando texto livre (pode não ser entregue fora da janela 24h).

[whatsapp-send-text] ⚠️ Enviando TEXTO LIVRE via Meta para 5521992593830.
[whatsapp-send-text] ⚠️ Enviando TEXTO LIVRE via Meta para 5521969434281.
[whatsapp-send-text] ✓ Meta: 5521992593830 - ID: wamid.HBg...  ← aceita mas NÃO entregue
```

### O mapeamento atual é insuficiente

Dos ~20 tipos de notificação do sistema, apenas **4** estão mapeados para templates Meta:
- `cadastro_aprovado` → `boas_vindas_associado`
- `proposta_aprovada_roubo_furto` → `boas_vindas_associado`
- `proposta_aprovada_cobertura_total` → `boas_vindas_associado`
- `cobertura_total_ativada` → `boas_vindas_associado`

Todos os demais (tecnico_em_rota, vistoria_aprovada, instalacao_agendada, etc.) são enviados como texto livre e **não chegam**.

Além disso, a `atribuir-proxima-tarefa` envia mensagens para o profissional e cliente **sem nenhum template**.

### Templates aprovados disponíveis mas não utilizados

A Meta já aprovou **12 templates** que não estão sendo usados:
- `assistencia_confirmada` ({{1}} nome, {{2}} prestador, {{3}} minutos)
- `cobranca_mensalidade` ({{1}} nome, {{2}} referência, {{3}} vencimento)
- `documentacao_pendente` ({{1}} nome, {{2}} documentos)
- `sinistro_aberto` ({{1}} nome, {{2}} protocolo)
- `sinistro_atualizado` ({{1}} nome, {{2}} protocolo, {{3}} atualização)
- `orcamento_oficina` ({{1}} nome, {{2}} veículo, {{3}} placa, {{4}} problema)
- Templates de reboque (já usados pelo despacho)

## Plano de Correção

### 1. Expandir mapeamento no `notificar-cliente` (Edge Function)

Mapear todos os tipos de notificação para os templates aprovados existentes:

| Tipo notificação | Template Meta | Parâmetros |
|---|---|---|
| `cadastro_aprovado` | `boas_vindas_associado` | nome, placa |
| `proposta_aprovada_*` | `boas_vindas_associado` | nome, placa |
| `cobertura_total_ativada` | `boas_vindas_associado` | nome, placa |
| `vistoria_aprovada` | `boas_vindas_associado` | nome, placa |
| `tecnico_em_rota` | `assistencia_confirmada` | nome, técnico, período |
| `instalacao_agendada` | `assistencia_confirmada` | nome, técnico, data |
| `instalacao_concluida` | `boas_vindas_associado` | nome, placa |
| `documentos_solicitados` | `documentacao_pendente` | nome, documentos |
| `lembrete_documentos` | `documentacao_pendente` | nome, documentos |
| `assistencia_prestador_acionado` | `assistencia_confirmada` | nome, prestador, previsão |

Para tipos sem template correspondente (vistoria_reprovada, documento_reprovado, followups), manter texto livre mas logar claramente que a entrega não é garantida.

### 2. Atualizar `atribuir-proxima-tarefa` para usar template

A notificação do profissional (vistoriador/instalador) e a notificação do cliente via `notificar-cliente` precisam usar templates. A função já chama `notificar-cliente` para o cliente (tipo `tecnico_em_rota`), mas envia mensagem direta ao profissional sem template.

Para o profissional: usar `assistencia_confirmada` com parâmetros adaptados, ou manter texto livre (profissionais geralmente interagem frequentemente, então a janela 24h tende a estar aberta).

### 3. Melhorar rastreamento de status

Atualmente todas as mensagens ficam como "enviada" mesmo quando a Meta não entrega. Adicionar um flag ou status intermediário para diferenciar:
- `enviada` → Meta aceitou com template (alta chance de entrega)
- `enviada_texto_livre` → Meta aceitou sem template (pode não entregar)

Isso será feito no `whatsapp-send-text` ao salvar na tabela `whatsapp_mensagens`.

### Arquivos afetados

- `supabase/functions/notificar-cliente/index.ts` — expandir META_TEMPLATE_MAP
- `supabase/functions/whatsapp-send-text/index.ts` — diferenciar status de envio
- `supabase/functions/atribuir-proxima-tarefa/index.ts` — usar template na notificação do profissional

