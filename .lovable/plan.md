# Plano — Mapa de monitoramento refletir atribuição via link público

## Diagnóstico

Quando o técnico assume a instalação via link público (`/vistoria/:token` → "Realizar Instalação" → login → `assumir-instalacao-vistoria-link`), a edge function tenta atualizar `instalacoes.tecnico_id`. **Esse campo não existe.** As colunas reais são `instalador_id` e `instalador_responsavel_id`.

Resultado: a atualização vira um no-op (PostgREST silenciosamente descarta), a `view_vistorias_mapa` não recebe a atribuição e o pin não aparece como "atribuído" no Mapa > Atribuições.

A `view_vistorias_mapa` define `vistoriador_id` para instalações como:
```
COALESCE(servicos.profissional_id, instalacoes.instalador_responsavel_id, rota_instaladores.instalador_id)
```

Ou seja, para o mapa refletir a atribuição manual, precisamos atualizar **dois** lugares: a instalação e o serviço materializado.

## Mudança

Reescrever o trecho final de `supabase/functions/assumir-instalacao-vistoria-link/index.ts` (depois da validação atômica de `tecnico_atribuido_id`) para:

1. **Atualizar `instalacoes`** com:
   - `instalador_id = userId`
   - `instalador_responsavel_id = userId` (campo lido pela view do mapa)
   - `status = 'agendada'` (mesmo padrão do `AtribuirInstaladorDialog`)

2. **Atualizar `servicos`** ativos derivados desta instalação:
   - `WHERE instalacao_origem_id = link.instalacao_id AND status NOT IN ('concluida','cancelada','nao_compareceu','imprevisto_pendente')`
   - `SET profissional_id = userId, status = 'agendada'`

3. **Registrar log** em `servicos_atribuicoes_log` (mesmo padrão do hook `useAtribuicaoManual`):
   - `tipo_atribuicao = 'manual'`
   - `observacoes = 'Auto-atribuição via link público de vistoria'`
   - `atribuido_por = userId` (o próprio técnico que assumiu)

Cada step trata erro com `console.error` sem abortar — a atribuição em `vistoria_links.tecnico_atribuido_id` (atômica, feita antes) permanece como garantia primária.

## Arquivos afetados

- `supabase/functions/assumir-instalacao-vistoria-link/index.ts` — substituir as linhas 186-192 pelo novo bloco descrito acima.

## Não-objetivos

- Sem mudanças de schema (todas as colunas já existem).
- Sem mudanças de RLS (a edge function usa `SUPABASE_SERVICE_ROLE_KEY`).
- Sem mudanças no frontend — o mapa já consulta `view_vistorias_mapa` corretamente, basta a view receber dados certos.

## Validação esperada

Depois do deploy, ao assumir uma instalação via link público:
- Pin da instalação no Mapa > Atribuições passa a aparecer com a cor do status `agendada` (não mais "sem atribuição").
- Popup do pin mostra o nome do técnico que assumiu.
- A entrada também aparece no painel de "Equipe" do técnico (já que `servicos.profissional_id` agora bate com seu profile).
