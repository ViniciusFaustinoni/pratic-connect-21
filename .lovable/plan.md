## 1. Corrigir erro "null value in column valor_mensal"

**Diagnóstico (confirmado no banco)**
- Cotação `COT-20260510-0010` (troca de titularidade) está com `valor_total_mensal = 0.00` e `plano_id = NULL`.
- O vendedor não definiu plano. O novo titular escolheu, no link público, o "Plano atual do veículo" (fallback `plano_vigente_antigo` introduzido recentemente).
- O hook `selecionarPlano` (em `useCotacaoContratacao.ts`) só persiste `plano_escolhido_id` e `status_contratacao` — **não atualiza `valor_total_mensal`**.
- `contrato-gerar` (linha 994) faz `valor_mensal: cotacao.valor_total_mensal || cotacao.valor_mensal`. Como `valor_total_mensal=0` é falsy e `valor_mensal` não existe na tabela `cotacoes`, vai `undefined` → `NULL` → viola NOT NULL → erro 400.

**Correção (duas camadas)**

A) Front — `src/hooks/useCotacaoContratacao.ts` (`selecionarPlano`)
- Receber o `PlanoOpcao` inteiro (não só o id) e gravar também:
  - `valor_total_mensal` (= `plano.valor_mensal_total`)
  - `valor_adesao` (se vier do plano)
  - `plano_id` (espelhar `plano_escolhido_id` para compatibilidade com leitores legados)
- Ajustar `EscolhaPlano.tsx` para passar o plano completo no `onSelecionar`.

B) Backend — `supabase/functions/contrato-gerar/index.ts` (rede de segurança)
- Quando `tipo_entrada === 'troca_titularidade'` e `valor_total_mensal` ainda for `0`/`null`, buscar do contrato ativo do `associado_antigo_id` (`valor_mensal`, `cota_participacao`, `dia_vencimento`) e usar como fallback antes do `INSERT`.
- Mantém o fluxo idempotente e evita 400 em qualquer cenário onde a UI não persistiu o valor.

**Reset da cotação travada**
- Limpar `status_contratacao` da `COT-20260510-0010` para o novo titular conseguir reescolher o plano (ou já gravar `valor_total_mensal` direto via SQL pontual).

## 2. Notificar vendedor por WhatsApp ao enviar Termo de Filiação

Hoje, em `supabase/functions/autentique-create/index.ts` (linhas 833–855), o helper `enviar-termo-filiacao-whatsapp.ts` envia o link **só ao cliente**. Vou estender para também notificar o vendedor.

**Mudanças**
- `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts`
  - Adicionar parâmetros opcionais: `vendedorTelefone`, `vendedorNome`, `clienteNome`, `tipoEntrada` (para texto contextual: "troca de titularidade", "nova adesão", etc.).
  - Após enviar ao cliente, se houver `vendedorTelefone`, disparar uma 2ª chamada `whatsapp-send-text` com mensagem livre (sem template Meta — é comunicação interna):
    ```
    Olá, {primeiroNomeVendedor}! O Termo de Filiação do contrato {numero} ({veiculo}) foi enviado para {clienteNome} assinar via Autentique. Acompanhe pelo painel.
    ```
  - Best-effort (try/catch isolado); falha não bloqueia.

- `supabase/functions/autentique-create/index.ts`
  - Já carrega `vendedorNome` (linha 245). Adicionar `vendedorTelefone` (buscar `profiles.telefone` ou `profiles.whatsapp` do `vendedor_id`).
  - Passar os novos campos para `enviarTermoFiliacaoWhatsApp(...)`.

## Fora de escopo
- Notificação ao consultor antigo na troca (já existe outro hook).
- Refatoração do `selecionarPlano` para múltiplos vendedores/agências.
- Redesenho do fluxo de cotações sem plano definido.

## Arquivos afetados
- `src/hooks/useCotacaoContratacao.ts` (mutação `selecionarPlano`)
- `src/components/cotacao-publica/EscolhaPlano.tsx` (callback `onSelecionar`)
- `supabase/functions/contrato-gerar/index.ts` (fallback troca)
- `supabase/functions/autentique-create/index.ts` (carrega telefone do vendedor)
- `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts` (notifica vendedor)
- Migration pontual: zerar `status_contratacao` da cotação atual para destravar o teste.
