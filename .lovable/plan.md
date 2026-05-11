## Diagnóstico

### 1) Documentos / laudo no modal de aprovação (Monitoramento → Aprovações de Troca)

O `ModalDetalhesTroca` já renderiza `VeiculoCompletoCard`, que **já exibe**:
- Dados completos do veículo + rastreador
- Fotos da vistoria (com viewer)
- Documentos do associado (`useDocumentosAssociadoCompleto` une `documentos_associados` + `documentos_cotacao` — inclui `laudo_vistoria`, `cnh`, `crlv`, `comprovante_residencia`)
- Resumo de eventos (sinistros + assistências)

O screenshot anexado confirma que esses blocos estão aparecendo. **Nenhuma alteração necessária aqui** — caso queira ajustes específicos (ex.: separar laudo em destaque, adicionar coluna “última vistoria aprovada”), me avise.

### 2) Posição do rastreador não retorna (Mapa Monitoramento, Detalhes do Veículo, Modal Troca)

**Investigação:**

Os 3 locais usam o hook `useRastreadorTempoReal` → edge `rastreador-posicao` (Mapa do app/assistência usa `posicao-veiculo`, mesma família).

Logs reais da `rastreador-posicao`:
```
[Softruck] Buscando posição (tentativa 1/3) → 404 {"error":{"message":"Internal Service Error"}}
[Softruck] Buscando posição (tentativa 2/3) → 404
[Softruck] Buscando posição (tentativa 3/3) → 404
Erro posição: API Softruck temporariamente indisponível (404)
```

Testei a mesma URL via `softruck-api` (operation `tracking`):
- Rastreador A (`89cb309d-…`, IMEI 867689063760369, IDs Softruck `BelkQWv4KqLjERo / ekgzQoWoylQdAr8`): **200 OK** com lat/lng atuais.
- Rastreador B (`41accc39-…`, IMEI 869412077334305, IDs `7yN6L82l7AZKgM5 / 7yN6L84a0OLKgM5`): **404 “Internal Service Error”** em todos os endpoints.

Conclusão: **a função em si funciona**. O 404 acontece em rastreadores cujos `plataforma_veiculo_id` / `plataforma_device_id` ficaram **stale** na Softruck (provavelmente por reativação/recriação no enterprise correto via `softruck-recriar-veiculos-enterprise-correta`). O código atual só re-resolve IDs quando eles parecem IMEI bruto (`isRawImei`); para hashes inválidos ele desiste e cai no fallback “sem última posição registrada”.

Por isso:
- Rastreadores cujos IDs Softruck ainda batem → posição volta normal.
- Rastreadores recriados / migrados → 404 permanente até alguém rodar reconciliação manual.

## Plano

### A) `supabase/functions/rastreador-posicao/index.ts` — auto-recuperação de IDs stale

1. Quando `getPosicaoSoftruckComRetry` lançar erro com `404` + `Internal Service Error` (ou regex `Internal Service Error|invalid vehicle|invalid device|not found`), **chamar `resolverSoftruckDeviceId(IMEI)`** uma única vez (mesma rotina já existente no arquivo) e tentar de novo com os IDs frescos.
2. Se a re-resolução resolver IDs diferentes dos atuais, eles já são persistidos em `rastreadores` (a função já faz isso). Logar `re_resolvido=true` em `rastreadores_logs`.
3. Se mesmo após re-resolver continuar 404, manter o fallback atual (última posição conhecida + mensagem clara).
4. Pequena melhoria de mensagem: distinguir “IDs Softruck inválidos — re-resolução falhou” de “API Softruck indisponível (5xx)” no campo `mensagem`.

### B) `supabase/functions/posicao-veiculo/index.ts` — mesma lógica

Replicar o passo de re-resolução por IMEI (porta o helper `resolverSoftruckDeviceId` da `rastreador-posicao` para um arquivo compartilhado em `_shared/softruck-resolver.ts` para evitar duplicação) e usar dentro do `catch` do bloco Softruck antes de cair no `ultimaPosicaoConhecida`.

### C) Frontend — sem mudança

`useRastreadorTempoReal` e `useChamadoPosicaoTempoReal` já lidam corretamente com:
- `success:true, tempo_real:true` → posição atual
- `success:true, tempo_real:false, posicao:{...}` → fallback (banner amarelo)
- `success:false` sem fallback → erro vermelho “Erro de comunicação”

Após (A) e (B) os 3 locais (Monitoramento → Mapa, Detalhes do Veículo, Modal Troca de Titularidade) voltam a exibir lat/lng atuais nos rastreadores cujos IDs ficaram stale, sem precisar de reconciliação manual.

### D) Reconciliação em massa (opcional / executável já)

Para destravar imediatamente todos os trackers afetados (sem esperar usuários abrirem cada veículo), posso disparar `rastreador-reconciliar-softruck` em background — mas isto fica como passo separado depois que (A)/(B) estiverem no ar.

## Arquivos a editar

- `supabase/functions/rastreador-posicao/index.ts`
- `supabase/functions/posicao-veiculo/index.ts`
- `supabase/functions/_shared/softruck-resolver.ts` (novo, extraído da função existente)

Sem migração de banco. Sem mudança de UI/hooks.
