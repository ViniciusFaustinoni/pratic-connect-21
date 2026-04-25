## Diagnóstico do estado atual

| Item | Status hoje |
|---|---|
| Botão **"Enviar Boletos"** (PDF em massa) | Envia PDF via `whatsapp-send-media` — **deve ser removido** |
| Botão **"WhatsApp"** em massa | Abre `wa.me` no navegador para cada cobrança (uma aba por contato). Não usa template Meta, não envia código de barras de fato. **Inviável** para 333 cobranças |
| Botão **"E-mail"** em massa | Apenas exibe `toast.info(...)` — **não envia nada** |
| Template Meta `d1_a_d4_boleto_vencido_v1` (vencido) | Aprovado, mas **não tem variável de código de barras** (só `{{1}} = nome`) |
| Template Meta `emissao_boleto_gerado_v2` | Aprovado, com **6 variáveis incluindo a linha digitável** ({{6}}) |
| Templates de e-mail (`boleto-vencendo`, `boleto-gerado`) | Existem, mas **não enviam código de barras** — só link |
| Coluna `cobrancas.linha_digitavel` | 100% das 141.512 linhas SGA preenchidas ✅ |

## O que será feito

### 1. WhatsApp em massa (botão "WhatsApp" da barra azul)

Substituir o `wa.me` por envio real via API Meta usando template aprovado, com a linha digitável como variável. Como o template de "vencido" hoje aprovado (`d1_a_d4_boleto_vencido_v1`) não tem slot de código de barras, vamos:

- Reusar `emissao_boleto_gerado_v2` (já aprovado, contém os 6 campos: nome, modelo, placa, vencimento, valor, **linha digitável**) — mesmo padrão usado pela régua automatizada.
- Criar um hook `handleEnviarWhatsAppLote` que:
  - Itera as cobranças selecionadas
  - Carrega `associado.nome`, `veiculo.modelo`, `veiculo.placa`, `valor`, `data_vencimento`, `linha_digitavel`
  - Chama `whatsapp-send-text` com `template_name: 'emissao_boleto_gerado_v2'` + `template_params`
  - Aguarda 800ms entre envios (mesma cadência da régua) para evitar rate-limit
  - Mostra progresso ("Enviando 12/333…") e resumo final (enviados / sem telefone / sem linha digitável / falhas)
  - Em cobranças sem `linha_digitavel`, marca como ignorada e reporta no resumo

### 2. E-mail em massa (botão "E-mail" da barra azul)

- Atualizar template `boleto-vencendo` em `supabase/functions/send-email/index.ts` para incluir bloco com **linha digitável copiável** (fonte monospace, destaque visual) + link do boleto.
- Implementar `handleEnviarEmailLote` real:
  - Filtra selecionadas com `associado.email` válido
  - Para cada uma, chama `send-email` com `template: 'boleto-vencendo'` e `data: { nome, valor, vencimento, competencia, boletoUrl, linhaDigitavel, diasRestantes/atraso }`
  - 500ms entre envios; progresso e resumo final igual ao WhatsApp

### 3. Remoção do "Enviar Boletos PDF"

- Remover o botão **"Enviar Boletos"** da `BatchActionsBar` em `CobrancasList.tsx`.
- Remover `handleEnviarBoletosLote` e o estado `enviandoLote` associado.
- Manter `handleEnviarBoletoPDF` individual no menu de cada linha (caso use), apenas se você quiser — confirme se também devo removê-lo da ação por linha.

### 4. Garantias técnicas

- Idempotência: usa o log natural de `whatsapp_logs` / `email_send_log` (cobranças sem `linha_digitavel` nunca disparam, evitando envio incompleto).
- Toast com botão "Ver detalhes" listando até 5 falhas com motivo.
- Limite de segurança: confirma com modal antes de disparar > 100 envios.

## Arquivos afetados

- `src/pages/financeiro/CobrancasList.tsx` — novos handlers, remoção do botão PDF
- `src/components/financeiro/BatchActionsBar.tsx` — remover `Enviar Boletos` do helper `getCobrancasBatchActions`
- `supabase/functions/send-email/index.ts` — atualizar template `boleto-vencendo` adicionando linha digitável

Nenhuma migração de banco é necessária. Nenhum template Meta novo é necessário (o `emissao_boleto_gerado_v2` já está APROVADO e cobre o caso).
