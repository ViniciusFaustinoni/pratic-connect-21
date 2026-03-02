

# Sistema de Notificacoes de Cobranca e Regua Automatica

## Situacao Atual

O sistema ja possui toda a infraestrutura de notificacoes:

- `disparar-notificacao` — hub centralizado (WhatsApp + Email + Sistema)
- `enviar-lembretes-vencimento` — lembretes D-3, D-1, D0, D+1, D+3, D+5 via WhatsApp e Email
- `executar-regua-cobranca` — regua configuravel de cobranca
- `cron-suspender-inadimplentes` — suspensao automatica de inadimplentes
- `cron-marcar-candidatos-spc` — marcacao SPC apos 30 dias
- `asaas-webhook` — confirmacao de pagamento com notificacao e reativacao

O que falta implementar:

1. **Disparo inicial "Boleto Disponivel"** apos conclusao da emissao em lote
2. **Ajuste nos dias de lembrete** para D-5 (em vez de D-3)
3. **Tela de Gestao de Notificacoes de Cobranca** no menu Financeiro
4. **Disparo manual individual** com historico por associado

## Arquivos a criar/modificar

### 1. Atualizar `src/pages/financeiro/EmissaoCobrancas.tsx`

Apos a emissao em lote concluir (todos emitidos com sucesso ou parcial), adicionar botao "Disparar Notificacoes" que:
- Chama uma nova edge function `disparar-boletos-lote` passando o `fechamento_id`
- Exibe progresso do disparo
- Mostra resultado: X notificados com sucesso, Y erros

### 2. Criar `supabase/functions/disparar-boletos-lote/index.ts` (nova edge function)

Edge function que recebe `fechamento_id` e para cada cobranca emitida (com `asaas_id` real):
- Busca dados do associado (nome, telefone, email)
- Envia WhatsApp com template: "Ola [Nome]! Seu boleto de contribuicao referente a [Mes/Ano] esta disponivel. Valor: R$ [X]. Vencimento: [Data]. Link: [boleto_url]"
- Envia Email via `send-email` com template `boleto-gerado` incluindo link do boleto e QR Code PIX
- Insere notificacao no sistema via `disparar-notificacao` (tipo: boleto, subtipo: gerado)
- Marca a cobranca com `notificacao_enviada = true`
- Retorna contagem de sucesso/erros

Processa em lotes de 10 com delay de 1s entre lotes para nao sobrecarregar a API do WhatsApp.

### 3. Atualizar `supabase/functions/enviar-lembretes-vencimento/index.ts`

Ajustar os dias padrao:
- `diasAntecedencia` de `[3, 1, 0]` para `[5, 1, 0]` (D-5 em vez de D-3)
- Adicionar tipo de mensagem `vencimento_5d` na funcao `getMensagemLembrete`
- Manter D+1, D+3, D+5 pos-vencimento como esta

### 4. Criar `src/pages/financeiro/NotificacoesCobranca.tsx` (nova pagina)

Tela de gestao com as seguintes secoes:

**Painel de Resumo (topo)**
- Total de boletos notificados com sucesso (do fechamento atual)
- Total com erro de envio (WhatsApp/email invalido)
- Ultimo disparo em lote realizado

**Inadimplentes por Faixa de Atraso**
- Cards com contagem por faixa: 1-5 dias / 6-15 dias / 16-29 dias / 30+ dias
- Busca de `asaas_cobrancas` com status `OVERDUE` agrupando por dias de atraso

**Lista de Inadimplentes**
- Tabela com: Nome, Placa, Valor pendente, Dias de atraso, Ultimo contato, Proxima acao, Acoes
- Filtro por faixa de atraso
- Busca por nome ou placa

**Disparo Manual Individual**
- Botao "Reenviar Boleto" em cada linha que:
  - Busca a cobranca mais recente PENDING/OVERDUE do associado
  - Reenvia WhatsApp + Email com link do boleto
  - Registra na tabela `whatsapp_mensagens` e `notificacoes`

**Historico de Notificacoes**
- Ao clicar em um associado, abre dialog mostrando historico de todas as notificacoes enviadas (da tabela `notificacoes` e `whatsapp_mensagens` filtradas por associado)

### 5. Adicionar rota e menu

- `src/App.tsx`: adicionar rota `/financeiro/notificacoes-cobranca`
- `src/components/layout/AppSidebar.tsx`: adicionar item "Notificacoes de Cobranca" com icone `Bell` no menu Financeiro, apos "Emissao de Cobrancas"

### 6. Registro no `supabase/config.toml`

Adicionar configuracao para a nova edge function:
```text
[functions.disparar-boletos-lote]
verify_jwt = false
```

## Fluxo Completo

```text
Emissao concluida (Prompt 3)
        |
Operador clica "Disparar Notificacoes"
        |
Edge function disparar-boletos-lote:
  - WhatsApp com link do boleto
  - Email com boleto + QR Code PIX
  - Notificacao no app
        |
Cron diario (enviar-lembretes-vencimento):
  D-5: Lembrete amigavel (WhatsApp)
  D-1: Ultimo aviso (WhatsApp + Email)
  D0:  Alerta venceu hoje (WhatsApp)
  D+1: Aviso atraso (WhatsApp)
  D+3: Cobranca vencida (WhatsApp)
  D+5: Suspensao iminente (WhatsApp + Email)
        |
Cron diario (cron-suspender-inadimplentes):
  Suspende e notifica Rede Veiculos
        |
D+30 (cron-marcar-candidatos-spc):
  Alerta interno para financeiro (sem mensagem ao associado)
        |
Pagamento confirmado (asaas-webhook):
  Sai da regua automaticamente
  WhatsApp: "Pagamento confirmado!"
```

## Detalhes tecnicos

- A edge function `disparar-boletos-lote` usa `SUPABASE_SERVICE_ROLE_KEY` para acessar dados
- O disparo WhatsApp usa a funcao existente `whatsapp-send-text`
- O disparo Email usa a funcao existente `send-email` com template `boleto-gerado`
- A tela de gestao busca dados de `asaas_cobrancas`, `notificacoes` e `whatsapp_mensagens`
- Nenhuma migration de banco necessaria — todas as tabelas e campos ja existem
