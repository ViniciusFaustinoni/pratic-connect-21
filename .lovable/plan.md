

## Bug: "Aguardando envio de documentos" mesmo com tudo aprovado

### Causa raiz
A flag `tem_documento_pendente` (que dispara o aviso amarelo e bloqueia o botão "Aprovar Proposta") é calculada em `usePropostasPendentes.ts` (linhas 273-281 e 752-760) por:

```ts
SELECT COUNT(*) FROM documentos_solicitados
WHERE associado_id = X AND status = 'pendente'
```

No caso do **ALEX DE OLIVEIRA SOBRINHO / TUB9C24** existem **5 registros** em `documentos_solicitados` com `status='pendente'` e `enviado_em=NULL`:
- `odometro`, `painel`, `chassi`, `banco_dianteiro`, `banco_traseiro`

Esses registros foram criados em 20/04/2026 16:23 (provavelmente via "Solicitar Reenvio" pelo analista, pedindo fotos extras do veículo). O cliente nunca enviou.

**O efeito visível:**
- Os 4 documentos cadastrais aparecem como `4/4 aprovado(s)` ✅
- A autovistoria (vídeo 360 + chassi + motor da `cotacoes_vistoria_fotos`) é mostrada como concluída ✅
- Mas o sistema continua bloqueado pelos 5 pedidos extras nunca enviados — e **eles não aparecem em lugar nenhum na tela do analista**, porque `DocumentosSolicitadosCard` só renderiza os já enviados (`documentos_solicitados_enviados`). Por isso parece um bug "fantasma".

### Solução em duas frentes

**1. Desbloquear o ALEX agora (caso real do cliente)**

Marcar manualmente os 5 pedidos pendentes como `cancelado` (não `aprovado`, para preservar histórico) e seguir com a aprovação normal:

```sql
UPDATE documentos_solicitados
SET status = 'cancelado', updated_at = now()
WHERE associado_id = '28a82785-ee88-4df5-a051-4874e8c1eb71'
  AND status = 'pendente';
```

Após isso, abrir a proposta novamente → o botão "Aprovar Proposta" libera e o fluxo segue para instalação. (Se `cancelado` não estiver no enum, usaremos `'enviado'` + `enviado_em = now()` ou criaremos a opção, conforme o schema permitir.)

**2. Eliminar o bug de UX (correção definitiva)**

Tornar visíveis e gerenciáveis os pedidos pendentes na tela do analista:

- **`src/hooks/usePropostasPendentes.ts`**: além de `documentos_solicitados_enviados`, retornar também `documentos_solicitados_pendentes` (status='pendente', `enviado_em IS NULL`).
- **`src/components/cadastro/DocumentosSolicitadosCard.tsx`**: renderizar uma seção adicional "Documentos solicitados ainda não enviados pelo cliente" listando cada `tipo_documento` (com label amigável reutilizando o mapa de `DocumentosPendentesPublico`) + botão por linha **"Cancelar solicitação"** e botão geral **"Cancelar todas"**. Cancelar = `UPDATE documentos_solicitados SET status='cancelado'`.
- **`src/components/cadastro/proposta/PropostaApprovalStepper.tsx`**: quando `tem_documento_pendente=true`, o aviso amarelo passa a citar a quantidade ("Aguardando envio de **5** documento(s) solicitado(s) ao cliente") e oferecer botão direto "Cancelar solicitações pendentes" que chama o mesmo hook acima.
- **Stepper**: o `step1Complete` continua exigindo docs aprovados; mas o bloqueio de aprovação final passa a usar `tem_documento_pendente_visivel` (somente quando o analista realmente pediu e ainda quer esperar) — após cancelar, a proposta libera para aprovação imediatamente.

### Arquivos tocados
- `src/hooks/usePropostasPendentes.ts` — incluir lista `documentos_solicitados_pendentes` no retorno (interface + 2 pontos onde é montado o objeto).
- `src/components/cadastro/DocumentosSolicitadosCard.tsx` — nova seção "pendentes" com ações de cancelar.
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx` — banner com contagem + botão de cancelar tudo.
- `src/components/cadastro/proposta/PropostaMidiaGrid.tsx` — passar a nova lista para o card.

### Validação
1. Rodar o `UPDATE` acima → recarregar `/cadastro/propostas/{contrato_id}` do ALEX → botão "Aprovar Proposta" libera → confirmar aprovação → proposta avança para instalação (status `aprovado` / `aguardando_instalacao`).
2. Em outra proposta com `documentos_solicitados` pendentes não enviados, conferir que o card "Documentos solicitados ainda não enviados" aparece, lista os tipos corretos e o botão "Cancelar solicitação" funciona (status vira `cancelado`, badge some, aprovação libera).
3. Proposta sem nenhum `documentos_solicitados` segue funcionando como hoje (sem regressão).
4. Proposta onde o cliente realmente envia o documento solicitado: `DocumentosSolicitadosCard` continua mostrando o item como **enviado** para revisão (lógica atual preservada).

