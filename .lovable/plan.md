# Criar Sinistro Diretamente via IA (sem chat_solicitacoes_ia)

## Problema

Quando o associado reporta um sinistro via IA (WhatsApp ou App), o sistema apenas cria um registro em `chat_solicitacoes_ia` com status "pendente". O sinistro real nunca aparece na lista de sinistros ate que um diretor aprove manualmente. Isso causa confusao, pois a assistencia 24h ja e criada diretamente.

## Solucao

Substituir o INSERT em `chat_solicitacoes_ia` por a criacao direta do sinistro na tabela `sinistros`, replicando a logica essencial da edge function `criar-sinistro`. O registro em `chat_solicitacoes_ia` sera eliminado completamente deste fluxo.

## Alteracoes

### 1. Edge Function: `supabase/functions/whatsapp-webhook/index.ts`

No case `criar_solicitacao_sinistro` (linhas 767-826), substituir toda a logica por:

1. Buscar veiculo ativo do associado (com cobertura)
2. Validar cobertura (manter logica existente)
3. Verificar duplicatas (sinistro aberto no mesmo veiculo)
4. Gerar protocolo SIN-YYYYMMDD-XXXX
5. INSERT na tabela `sinistros` com status "comunicado" e canal "whatsapp"
6. INSERT em `sinistro_historico`
7. INSERT em `sinistro_documentos` (documentos obrigatorios por tipo)
8. Enviar notificacoes internas (analistas/diretores) e email para [sinistros@praticprotect.com.br](mailto:sinistros@praticprotect.com.br)
9. Agendar (se o associado ainda não se antecipou e prosseguiu com a IA) contato D+1 via `agendar-contato-sinistro`
10. Retornar protocolo para a IA informar ao associado

### 2. Edge Function: `supabase/functions/assistente-chat/index.ts`

No case `criar_solicitacao_sinistro` (linhas 484-525), mesma substituicao:

1. Buscar veiculo ativo + validar cobertura
2. Verificar duplicatas
3. Gerar protocolo e INSERT em `sinistros` (canal "ia")
4. Historico, documentos, notificacoes
5. Retornar protocolo

### 3. Prompt da IA (ambas edge functions)

- Alterar descricao da tool de "Cria solicitacao para aprovacao" para "Registra sinistro diretamente no sistema"
- Mensagem de retorno: informar protocolo SIN-XXXX ao associado em vez de "aguardando aprovacao"

## Detalhes Tecnicos

### Documentos obrigatorios por tipo (replicados de criar-sinistro)

```text
colisao:           CNH, CRLV, Fotos dos Danos, Fotos do Local, B.O.
roubo:             CNH, CRLV, B.O.
furto:             CNH, CRLV, B.O., Declaracao de Chaves
incendio:          CNH, CRLV, B.O., Laudo Bombeiros, Fotos
fenomeno_natural:  CNH, CRLV, Fotos, Comprovante Evento
vandalismo:        CNH, CRLV, B.O., Fotos
terceiros:         CNH, CRLV, Fotos, Dados do Terceiro
vidros:            CNH, CRLV, Fotos
```

### Mapeamento de tipos IA para tipos do sistema

Os tipos da tool (`roubo_furto`, `fenomenos_naturais`, `danos_terceiros`) precisam ser mapeados para os tipos da tabela sinistros (`roubo`, `furto`, `fenomeno_natural`, `terceiros`, etc.). A IA coleta o tipo generico e o mapeamento sera feito no codigo.

### Fluxo antes vs depois

```text
ANTES:
  Associado reporta via IA -> chat_solicitacoes_ia (pendente) -> Diretor aprova -> sinistro criado

DEPOIS:
  Associado reporta via IA -> sinistro criado (comunicado) -> Equipe analisa diretamente
```

### Tabelas impactadas


| Tabela               | Operacao                                     |
| -------------------- | -------------------------------------------- |
| sinistros            | INSERT (sinistro real com status comunicado) |
| sinistro_historico   | INSERT (registro de abertura)                |
| sinistro_documentos  | INSERT (documentos obrigatorios por tipo)    |
| notificacoes         | INSERT (notificar analistas/diretores)       |
| chat_solicitacoes_ia | NAO SERA MAIS USADO neste fluxo              |


### Arquivos modificados


| Arquivo                                        | Alteracao                                  |
| ---------------------------------------------- | ------------------------------------------ |
| `supabase/functions/whatsapp-webhook/index.ts` | Substituir case criar_solicitacao_sinistro |
| `supabase/functions/assistente-chat/index.ts`  | Substituir case criar_solicitacao_sinistro |
