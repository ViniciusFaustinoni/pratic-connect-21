## Objetivo
Fazer o fluxo de 2ª via no WhatsApp reconhecer boletos já gerados para a placa `QOO5C17` sem quebrar os casos que hoje já funcionam.

## Diagnóstico confirmado
- A resposta "não encontrei boleto" já nasce no backend, antes da fala da IA.
- O gate final está em `supabase/functions/whatsapp-webhook/index.ts`, quando `consultar_boletos_sga_por_placa` recebe `veiculo.boletos_abertos` vazio.
- Hoje, tanto `sga-buscar-associado-completo` quanto `sga-listar-boletos-associado` estão retornando `boletos_abertos: []` para o CPF/placa do caso informado.
- O problema, portanto, está na camada canônica de consulta/normalização dos boletos do SGA, não na memória de identidade do WhatsApp.

## Plano
1. **Corrigir a classificação canônica de boleto aberto no SGA**
   - Ajustar a lógica compartilhada que decide se um boleto do Hinova é "aberto" ou "pago".
   - Cobrir explicitamente estados de boleto já gerado/emitido/registrado/aguardando pagamento para que não sejam descartados como se o veículo estivesse em dia.
   - Endurecer a regra para não excluir boleto válido apenas por um campo auxiliar ambíguo vindo do SGA.

2. **Aplicar a correção nas duas edges canônicas de cobrança**
   - `supabase/functions/sga-buscar-associado-completo/index.ts`
   - `supabase/functions/sga-listar-boletos-associado/index.ts`
   - Garantir que ambas usem o mesmo critério final, sem divergência entre fluxo de WhatsApp e consultas internas.

3. **Adicionar observabilidade mínima para casos invisíveis**
   - Registrar, no log das edges, o motivo resumido de descarte dos boletos retornados pelo SGA (ex.: pago, cancelado, valor zero, sem correspondência de placa).
   - Isso evita novo falso "em dia" sem rastreabilidade quando o SGA vier com payload inconsistente.

4. **Manter o comportamento do WhatsApp igual no restante**
   - Sem mudar o gate de CPF já corrigido.
   - Sem alterar o fluxo de confirmação de placa.
   - Apenas fazer o webhook receber um payload correto quando existir boleto gerado.

5. **Validar com os cenários certos**
   - Caso real: CPF `14194896742` / placa `QOO5C17` deve passar a retornar boleto em vez de "em dia".
   - Telefone compartilhado: continuar usando o CPF confirmado no `agente_ia_contatos`.
   - Cliente sem boleto: continuar recebendo a resposta de que não há boleto aberto.
   - Cliente com boleto vencido há 6+ dias: continuar indo para transbordo humano.

## Detalhes técnicos
- Arquivos principais:
  - `supabase/functions/_shared/hinova-client.ts`
  - `supabase/functions/sga-buscar-associado-completo/index.ts`
  - `supabase/functions/sga-listar-boletos-associado/index.ts`
  - `supabase/functions/whatsapp-webhook/index.ts` (só se precisar alinhar consumo/logs)
- Não prevejo migração de banco para essa correção.
- Depois da implementação, vou validar chamando as edges diretamente com o CPF/placa do caso real antes de considerar fechado.