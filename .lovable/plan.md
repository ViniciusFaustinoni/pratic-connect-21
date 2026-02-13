
# Reestruturar fluxo de conclusao da OS no modal

## Fluxo desejado (6 etapas)

```text
Status: em_execucao (ou similar)
  |
  [Botao: Concluir e Notificar]  -- envia WhatsApp, status -> concluido
  |
Status: concluido
  |
  [Botao: Reenviar Notificacao]  +  [Botao: Enviar Termo]
  |                                        |
  |                              Envia termo Autentique, status -> pendente_assinatura
  |
Status: pendente_assinatura
  |
  [Botao: Reenviar Notificacao]  +  [Botao: Reenviar Termo]
  |
  ... assinatura detectada pelo polling ...
  |
  Botoes de notificacao e termo SOMEM
  [Botao: Visualizar PDF Assinado]
  [Botao: Liberar Veiculo]
  |
  Click "Liberar Veiculo" -> status finalizado, sinistro encerrado, custos lancados, modal fecha
```

## Mudancas necessarias

### 1. Modal `OSConclusaoModal.tsx` - Reestruturar botoes

**Remover** a logica de steps (`confirm` / `signature`). Usar diretamente o `os.status` e flags (`signatureLink`, `assinado`) para decidir quais botoes mostrar:

- **Status antes de `concluido`**: Mostrar apenas "Concluir e Notificar"
- **Status `concluido` (sem termo enviado)**: Mostrar "Reenviar Notificacao" + "Enviar Termo"
- **Status `concluido` ou `pendente_assinatura` (com termo, sem assinatura)**: Mostrar "Reenviar Notificacao" + "Reenviar Termo" + link/copiar
- **Assinado**: Mostrar apenas "Visualizar PDF" + "Liberar Veiculo"

Adicionar funcao `handleReenviarNotificacao` que reenvia o WhatsApp de conclusao sem mudar status.

### 2. Webhook `autentique-webhook/index.ts` - Reverter auto-finalizacao

O webhook **nao deve** mudar status para `finalizado` nem encerrar sinistro. Deve apenas:
- Marcar `termo_saida_assinado = true`
- Registrar historico
- Baixar PDF assinado

Remover do webhook:
- `status: "finalizado"` no update da OS
- Encerramento automatico do sinistro
- WhatsApp de liberacao (sera feito no botao "Liberar Veiculo")

### 3. Pagina `OrdemServicoDetalhe.tsx` - Ajustar botoes do header

Simplificar para um unico botao contextual que abre o modal:
- Status antes de concluido: "Concluir OS"
- Status concluido/pendente_assinatura: "Gerenciar Conclusao"
- Status finalizado: nenhum botao de conclusao

### Arquivos alterados
- `src/components/oficinas/OSConclusaoModal.tsx` - reestruturar botoes e fluxo
- `supabase/functions/autentique-webhook/index.ts` - reverter auto-finalizacao
- `src/pages/oficinas/OrdemServicoDetalhe.tsx` - simplificar botoes do header
