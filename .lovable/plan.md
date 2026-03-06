

# Incluir TODAS as Ressalvas (nao apenas instalacao)

## Problema

Atualmente, 3 pontos filtram ressalvas apenas por `tipo = 'ressalva_registrada'` ou apenas de instalacao (`decisao_instalador = 'aprovado_ressalva'`). Tipos como `ressalva_aprovada_monitoramento` e `ressalva_declinada_monitoramento` sao ignorados na analise de eventos e no prompt da IA.

## Alteracoes

### 1. Hook `useEventoAnaliseDetalhe.ts` — ressalvasQuery (linha 153)

Trocar `.eq('tipo', 'ressalva_registrada')` por `.in('tipo', ['ressalva_registrada', 'ressalva_aprovada_monitoramento', 'ressalva_declinada_monitoramento'])` para buscar todos os tipos de ressalva do historico.

### 2. Edge Function `analise-risco-ia/index.ts` — query de ressalvas (linha 177)

Mesmo ajuste: trocar `.eq("tipo", "ressalva_registrada")` por `.in("tipo", ["ressalva_registrada", "ressalva_aprovada_monitoramento", "ressalva_declinada_monitoramento"])` para que a IA considere todas as ressalvas na pontuacao de risco.

### 3. Edge Function `sugerir-ressalva-ia/index.ts` — query de ressalvas anteriores (linha ~30)

Mesmo ajuste na query que busca ressalvas anteriores do associado: trocar `.eq("tipo", "ressalva_registrada")` por `.in("tipo", ["ressalva_registrada", "ressalva_aprovada_monitoramento", "ressalva_declinada_monitoramento"])`.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useEventoAnaliseDetalhe.ts` | Expandir filtro de tipos na ressalvasQuery |
| `supabase/functions/analise-risco-ia/index.ts` | Expandir filtro de tipos na query de ressalvas |
| `supabase/functions/sugerir-ressalva-ia/index.ts` | Expandir filtro de tipos na query de ressalvas anteriores |

3 arquivos, alteracoes pontuais (1 linha cada).

