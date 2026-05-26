## Bug atual

`src/components/troca-titularidade/ModalDetalhesTroca.tsx:518` amarra `bloqueadoPorRastreador` a `precisaVinculoRastreador` (= `!jaTemRastreador`), mas o vínculo só é gravado dentro de `garantirImeiValidado` (linhas 125-131), que só roda no clique do Aprovar (linha 197). Botão nunca habilita → paradoxo.

Nova UX: validação acontece **no próprio card do IMEI**, com botão explícito **Validar**. Aprovar só libera depois.

## Mudanças

### 1. `src/components/troca-titularidade/ValidarImeiPorPlacaCard.tsx`

- Trocar `Props.onChange` por par `onChange` + `onValidar` (callback do clique). Novos estados são controlados pelo pai (`validando`, `validado`, `origem`, `erro`).
- Adicionar `<Button>` "Validar" dentro do card, ao lado/embaixo do input.
  - `disabled = validando || validado || imei.replace(/\D/g,'').length < 15 || disabled`
  - Label: "Validar" → "Validando…" (com spinner) → some quando `validado=true` (substituído pelo badge verde existente).
- Estado visual já presente cobre:
  - `validando` → spinner + texto "Validando IMEI nas plataformas externas…"
  - `validado` → badge verde "Validado em Softruck/Rede Veículos"
  - `erro` → Alert vermelho com mensagem (já existe)
- Sem mudança em prop `placa`, `imei`, `disabled`.

### 2. `src/components/troca-titularidade/ModalDetalhesTroca.tsx`

- Estados `imeiInput`, `validandoImei`, `imeiValidado`, `origemValidacao`, `erroValidacao` já existem (linhas 73-77) — manter.
- Extrair o miolo de `garantirImeiValidado` (linhas 100-144) para uma função `validarImeiAgora()` chamável pelo card. Mantém set de estados, toast, gravação em `rastreadores` (linhas 125-131) e `qc.invalidateQueries`.
- Passar para o card (linhas 317-330):
  - `onValidar={validarImeiAgora}`
  - `onChange` reseta `imeiValidado=false`, `origemValidacao=null`, `erroValidacao=null` (linhas 321-327 já fazem parte disso — só ajustar).
- Linha 518: `const bloqueadoPorRastreador = precisaValidarImei && !imeiValidado;`
- Linha 526-527 (`motivoBloqueio`): texto vira **"Valide o IMEI do rastreador antes de aprovar."**
- `handleAprovar` (linha 195): manter chamada a `garantirImeiValidado` como **camada de segurança secundária** — função fica idempotente (retorna `true` imediatamente quando `imeiValidado=true`, comportamento já existente na linha 102).
- `handleSolicitarVistoria` e `handleAbrirManutencao`: idem, `garantirImeiValidado` permanece como guarda. Sem alteração.

### 3. Fora de escopo

- Nada de backend, edge function, hook de mutação, schema.
- Sem alteração em `validarImeiPorPlaca` (lib), `rastreadores.plataforma`, nem na escrita de vínculo (continua gravando no momento da validação).

## Verificação manual

Caso GABRIEL → Anderson, placa **KPJ4994**, IMEI **354522186314659**:

1. Abrir aprovação → IMEI vazio, badge ausente, **Validar** disabled, **Aprovar** disabled (tooltip "Valide o IMEI…").
2. Digitar IMEI → **Validar** habilita aos 15 dígitos; **Aprovar** segue disabled.
3. Clicar **Validar** → spinner "Validando…" → badge verde "Validado em Softruck" (ou Rede) → **Aprovar** habilita.
4. Apagar/digitar outro IMEI → `imeiValidado` reseta → badge some → **Aprovar** trava de novo.
5. Falha de validação → Alert vermelho no card com mensagem específica; **Aprovar** segue disabled.
