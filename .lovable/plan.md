# Atualização do tutorial: Troca de Titularidade

## Objetivo
Refletir no tutorial que, após a aprovação do Monitoramento, o consultor pode abrir o processo de troca em **Vendas › Cotações › Outros Processos** e reenviar o link público ao novo associado, que então escolhe o plano e segue o restante do fluxo como uma nova adesão.

## Escopo
Apenas conteúdo do tutorial — nenhuma mudança de código de funcionalidade.

**Arquivo:** `src/data/tutoriais/troca-titularidade.ts`

## Mudanças

1. **Ajustar o passo 10 (Monitoramento aprova a solicitação)** para deixar claro que, após a aprovação do Monitoramento, a cotação volta a ficar acessível ao consultor na aba **Outros Processos** para reenvio do link público ao novo associado.

2. **Inserir um novo passo entre o atual 10 e 11** — "Consultor reabre a cotação e envia o link ao novo associado":
   - Em **Vendas › Cotações › aba Outros Processos**, localizar a cotação da troca (badge "Liberada p/ assinatura").
   - Usar o botão **"Abrir página da cotação"** (ícone vermelho) ou **"Copiar link"** para enviar ao novo titular por WhatsApp/e‑mail.
   - O novo associado acessa o link público, **escolhe o plano**, envia documentos e assina — exatamente como uma nova adesão, porém preservando a carência cumprida.
   - Dicas: link único por cotação; reenviar não invalida o anterior; a aba Outros Processos é específica para trocas/substituições/inclusões.

3. **Renumerar** os passos seguintes (atual 11 → 12, atual 12 → 13) e revisar referências internas para manter coerência da numeração.

4. Manter o restante do conteúdo (vistoria de campo, ativação via `ativar-associado`, criação de senha) inalterado.

## Fora de escopo
- Não alterar lógica de negócio, edge functions, hooks ou UI.
- Não alterar os tutoriais `aprovacao-troca-titularidade-cadastro.ts` nem `aprovacao-troca-titularidade-monitoramento.ts` (a menção é só no tutorial principal do consultor).
