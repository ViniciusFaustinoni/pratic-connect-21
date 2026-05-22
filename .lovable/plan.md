## Caso ROSIMEIRE — Yamaha Aerox Connected ABS 2026 (0KM, chassi 9C6SGA210T0008483)

### Estado atual

- Associada **sincronizada** no Hinova (codigo 30456).
- Veículo **fila `pendente`**, 8 tentativas, `etapa_parou='veiculo'`, erro fixo: **"O MODELO enviado não foi encontrado"**.
- `codigo_fipe=827144-5`, `valor_fipe=19.912`, `ano_modelo=2026`, `aguardando_placa_definitiva=true`, placa interna `0KM751A9`.
- Última execução (22/05 14:22) já testou as **3 variantes** do retry: `827144-5`, `8271445`, `827144`. Todas → "MODELO não encontrado".

### Diagnóstico

O retry de FIPE (implementado na sessão anterior) está fazendo seu trabalho — não é mais bug de formato. **O catálogo regional Hinova não tem o modelo Aerox Connected ABS 2026** vinculado a esse FIPE. Como ela é 0KM/lançamento, o catálogo Hinova ainda não reconhece o pacote `FIPE 827144-5 + ano 2026`.

Hinova aceita dois caminhos no `POST /veiculo/cadastrar`: `codigo_fipe` **ou** `codigo_modelo` (catálogo interno da regional). Hoje o sistema só envia `codigo_fipe`. Quando o catálogo é mais novo que o FIPE-lookup da regional, a única saída é mandar `codigo_modelo`.

### Plano

**1. Edge function nova: `hinova-listar-modelos`**
Envelope POST autenticado para `GET /buscar/modelo` (e fallbacks `/buscar/modelos`, `/listar/modelos`) — Hinova varia o caminho entre versões, replicar o padrão já usado em `findVeiculoByChassiHinova`. Parâmetros: `marca`, `texto`, opcional `ano`. Retorna `[{codigo_modelo, descricao, ano, codigo_fipe}]`. Cache curto em memória da edge (5 min) por marca, igual já é feito em outros lookups.

**2. Resolver `codigo_modelo` quando FIPE falha**
Em `supabase/functions/sga-hinova-sync/index.ts` (loop de retry de FIPE, linhas 986–1020):
- Manter as 3 variantes de FIPE.
- Se TODAS falharem com "MODELO não encontrado", chamar `hinova-listar-modelos` com `marca=veiculo.marca`, `texto=veiculo.modelo`, `ano=veiculo.ano_modelo`.
- Se houver match (matching simples por substring case-insensitive, mesma heurística do `pontuarFipe` do `plate-lookup`), montar payload **sem** `codigo_fipe` e **com** `codigo_modelo`.
- Persistir `veiculos.codigo_modelo_hinova` (campo novo) quando a variante funcionou — evita re-busca em reprocessos.

**3. Estender `buildVeiculoPayload`**
- Adicionar `codigo_modelo?: number` em `VeiculoCtx`.
- Quando presente, payload envia `codigo_modelo` **em vez** de `codigo_fipe` (regra Hinova: um ou outro).
- Manter `valor_fipe` (Hinova continua exigindo).

**4. Migration**
- `ALTER TABLE veiculos ADD COLUMN codigo_modelo_hinova INT NULL;`
- Sem trigger, sem RLS adicional.

**5. Reprocessar Rosimeire**
- Após o deploy, disparar manualmente `sga-hinova-sync` para o `veiculo_id=6f20a5df…`.
- Esperado: o lookup de modelo encontra o Aerox Connected ABS 2026 na regional → cadastro do veículo OK → `sga_sync_queue` zera, `veiculos.status_sga='sincronizado'`.
- Fallback humano se o catálogo regional REALMENTE não tem o 2026 ainda: log `cadastrar_veiculo` traz a lista de modelos retornados pelo Hinova; operador escolhe o que mais se aproxima (ex.: Aerox 2025) e digita o `codigo_modelo_hinova` na tela do veículo. Sem essa rota manual o caso continua travado por catálogo externo.

**6. Memória nova** — `mem://logic/integrations/hinova-codigo-modelo-fallback`:
> "Quando `cadastrar_veiculo` Hinova falha com 'MODELO não encontrado' após esgotar as 3 variantes de `codigo_fipe`, sga-hinova-sync busca `codigo_modelo` via `hinova-listar-modelos` (marca + texto modelo + ano) e reenvia o payload usando `codigo_modelo` em vez de `codigo_fipe`. Match persistido em `veiculos.codigo_modelo_hinova`."

### Arquivos envolvidos

- **novo** `supabase/functions/hinova-listar-modelos/index.ts`
- `supabase/functions/sga-hinova-sync/index.ts` (loop de retry)
- `supabase/functions/_shared/hinova-payloads.ts` (campo + render condicional)
- 1 migration adicionando `veiculos.codigo_modelo_hinova`
- 1 leaf de memória + update do índice

### Fora do escopo

- Não tocar nas regras de RENAVAM 0KM (`aguardando_placa_definitiva`) — já corretas.
- Não tocar no fluxo de associado (já sincronizado).
- Sem UI nova nesta rodada — o `codigo_modelo_hinova` pode ser editado pelo Drawer do veículo na rodada seguinte se for necessário.
