## Objetivo
Fazer a consulta de situação financeira no SGA funcionar de forma confiável no fluxo de Troca de Titularidade, sem exibir falso erro quando o associado/veículo local ainda não tem códigos Hinova reconciliados.

## O que vou corrigir
1. Ajustar o backend `sga-sync-financeiro-veiculo` para distinguir melhor:
   - ausência real de vínculo/código no SGA
   - erro transitório de autenticação/token
   - associado indisponível para consulta por CPF
   - veículo sem histórico de boletos, mas ainda com situação financeira consultável
2. Revisar o helper Hinova usado na reconciliação por placa/CPF para reduzir falhas por reautenticação concorrente e normalizar respostas `406` da Hinova.
3. Corrigir o comportamento do modal `TrocaTitularidadeDialog` para não tratar qualquer `success:false` como “indisponível no SGA”; a UI deve interpretar:
   - `retry/transitório` → aviso temporário com retry
   - `not_found` sem código reconciliado → estado de “não foi possível reconciliar no SGA”
   - `ADIMPLENTE/INADIMPLENTE` → seguir fluxo normal
4. Testar os endpoints implantados diretamente:
   - `sga-sync-financeiro-veiculo`
   - `sga-listar-boletos-associado`
   - `importar-associado-sga`
5. Validar no caso real da placa `LTB4J74` e confirmar o resultado final no modal.

## Diagnóstico confirmado
- A placa `LTB4J74` está localmente sem `veiculos.codigo_hinova`.
- O associado atual também está sem `associados.codigo_hinova`.
- O endpoint `sga-sync-financeiro-veiculo` hoje retorna `success:false, not_found:true` com mensagem `Veículo sem codigo_hinova válido após reconciliação`.
- Nos logs há também 401 por invalidação de token Hinova e 406 na busca por CPF (`Associado não encontrado ou está em alguma situação indisponível para consulta`).
- O modal atual colapsa esses cenários diferentes em `Situação financeira: indisponível no SGA`, então o usuário não recebe o estado correto.

## Arquivos prováveis
- `supabase/functions/sga-sync-financeiro-veiculo/index.ts`
- `supabase/functions/sga-listar-boletos-associado/index.ts`
- `supabase/functions/importar-associado-sga/index.ts`
- `supabase/functions/_shared/hinova-client.ts`
- `src/components/associados/TrocaTitularidadeDialog.tsx`
- possivelmente `src/hooks/useBoletosSgaPorAssociado.ts`

## Resultado esperado
- O fluxo para de quebrar silenciosamente.
- Quando o SGA responder corretamente, a situação financeira aparece e os boletos em atraso são carregados.
- Quando não houver reconciliação suficiente no SGA, a interface mostra uma mensagem precisa e acionável, sem mascarar tudo como erro genérico.
- Os endpoints ficam testados com retorno validado após a correção.

## Detalhes técnicos
```text
UI abre modal
 -> lista veículos via sga-listar-boletos-associado / fallback local
 -> seleciona veículo
 -> chama sga-sync-financeiro-veiculo
    -> tenta reconciliar codigo_veiculo/codigo_associado
    -> consulta situacao financeira
    -> se inadimplente, sincroniza cobrancas
 -> UI interpreta resposta corretamente
 -> só então lê cobrancas locais para mostrar boletos
```

## Observação importante
Também há uma solicitação de troca anterior em andamento para `LTB4J74`, que continuará bloqueando a criação de nova solicitação até ser cancelada. Isso é separado da correção da situação financeira, mas eu preservarei esse bloqueio porque ele está funcionando corretamente.