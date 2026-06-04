# Fix: data de vencimento do boleto exibida 1 dia antes

## Causa raiz (confirmada)

Em `supabase/functions/agente-consultor-ia/index.ts`, linhas 3415–3422, a função `fmtData` faz:

```ts
const dt = new Date(String(d));                 // "2026-06-10" → UTC midnight
return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
// → "09/06/2026" (UTC-3 puxa para o dia anterior)
```

É o único ponto de formatação de data de boleto no agente. Nenhum outro `toLocaleDateString` está no arquivo — os demais `new Date(...)` lidam com timestamps ISO completos (gates de saudação, pausas, etc.) e não sofrem do bug.

## Correção

Substituir `fmtData` por um parser que trata `YYYY-MM-DD` como data civil (sem timezone), preservando timestamps ISO completos como fallback:

```ts
const fmtData = (d: any) => {
  if (!d) return null;
  try {
    const s = String(d);
    // DATE puro "YYYY-MM-DD" (ou "YYYY-MM-DDT..." cortando a parte de hora):
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const [, ano, mes, dia] = m;
      return `${dia}/${mes}/${ano}`;
    }
    // Fallback para outros formatos (ISO com offset): respeita o instante.
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return s;
    return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch { return String(d); }
};
```

Resultado: `2026-06-10` → `10/06/2026`, sem deslocamento.

## Escopo

- Único arquivo alterado: `supabase/functions/agente-consultor-ia/index.ts` (apenas o bloco de `fmtData`, linhas 3415–3422).
- Deploy: `agente-consultor-ia`.
- **Não toca**: tratamento `erro_transitorio` do boleto (já corrigido), formato de envio, situação do veículo, identificação, roteador, envio (`whatsapp-send-text`), habilidade vendas, datas de saudação/pausa.

## Validação em produção

1. `curl_edge_functions` em `sga-listar-boletos-associado` com CPF `14194896742` → confirmar `data_vencimento: "2026-06-10"`.
2. Inspecionar o prompt/tool result do agente para o mesmo CPF (via `edge_function_logs` filtrando o turno mais recente) e confirmar que a string formatada do vencimento é `10/06/2026`.
3. Frase de fechamento: data exibida agora bate com a data do SGA; fallback é o comportamento antigo (apenas para strings com offset explícito, que não é o caso dos boletos Hinova).
