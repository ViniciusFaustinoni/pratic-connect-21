
# Fluxo pos-envio do Termo de Saida

## Mudancas

### 1. `src/components/oficinas/OSConclusaoModal.tsx`
- Apos envio com sucesso do termo (`handleEnviarTermo`), **fechar o modal** com `onOpenChange(false)`
- Atualizar o status da OS para `pendente_assinatura` no banco (novo status intermediario entre `concluido` e `finalizado`)
- Quando o modal for reaberto (com `autentique_url` ja existente e nao assinado), mostrar opcoes de reenvio e o polling automatico
- Reduzir polling de 15s para 10s para detectar assinatura mais rapido

### 2. `src/pages/oficinas/OrdemServicoDetalhe.tsx`
- Alterar o texto do botao: se a OS ja tem `autentique_url` e nao esta assinado, mostrar **"Reenviar Termo de Saida"** em vez de "Termo de Saida"
- Manter visibilidade do botao para status `concluido` (e o novo `pendente_assinatura` se adicionado)

### 3. Status `pendente_assinatura`
- Verificar se o status ja existe em `src/types/database.ts` no mapeamento `STATUS_ORDEM_SERVICO_LABELS`/`COLORS`
- Se nao existir, adicionar como novo status com label "Pendente de Assinatura" e cor amarela/amber

## Fluxo resultante

1. Usuario clica "Enviar Termo para Assinatura" no modal
2. Termo e enviado com sucesso -> modal fecha, toast de sucesso
3. Botao na pagina muda para "Reenviar Termo de Saida"
4. Se usuario clica no botao novamente, modal abre mostrando: link de assinatura, botoes copiar/whatsapp, e botao "Reenviar Termo"
5. Polling automatico (a cada 10s) detecta assinatura -> modal mostra "Assinado" + botao "Liberar Veiculo"
6. Ao liberar: OS -> finalizado, Sinistro -> encerrado

## Arquivos alterados
- `src/components/oficinas/OSConclusaoModal.tsx` - fechar modal apos envio, logica de reenvio
- `src/pages/oficinas/OrdemServicoDetalhe.tsx` - texto do botao dinamico
- `src/types/database.ts` - verificar/adicionar status `pendente_assinatura` (se necessario)
