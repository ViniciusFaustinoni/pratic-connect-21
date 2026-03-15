
## Diagnóstico: Trajeto não exibido

**Causa raiz confirmada nos logs:**

A edge function `rastreador-historico` chamou a API Softruck e recebeu **0 pontos** para o período 14/03 13:00–17:00 UTC. Porém, o banco local (`rastreador_posicoes`) possui **20 posições** nesse mesmo período, coletadas pelo cron.

O problema: quando a API Softruck retorna vazio, a função retorna `success: true, trajeto: []` — sem fazer fallback para os dados locais. O fallback local só existe quando `!plataforma.suporta_historico_trajeto` (linhas 218-263), mas Softruck "suporta", então nunca cai nesse branch.

## Correção

**Arquivo:** `supabase/functions/rastreador-historico/index.ts`

Após receber 0 pontos da API Softruck (linha 302), adicionar fallback automático para `rastreador_posicoes`:

```text
API Softruck → 0 pontos?
  ↓ SIM
  Buscar rastreador_posicoes no período
  Se encontrar dados → retornar com fonte: 'local'
  Se não → retornar vazio (comportamento atual)
```

Concretamente, após a linha 302 (`console.log`), se `trajeto.length === 0`, executar query local idêntica à do branch `!suporta_historico_trajeto` (linhas 221-240) e retornar esses dados com `fonte: 'local'` e mensagem explicativa.

Isso garante que os dados do cron nunca sejam desperdiçados quando a API externa falha ou retorna vazio.
