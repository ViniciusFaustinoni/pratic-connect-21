

## Causa raiz

No fluxo público (`EtapaVistoria.tsx`), quando o usuário clica em "Agendar Vistoria Presencial", a lógica das **linhas 159–168** decide para onde ir baseando-se em `tipoInstalacao`:

```ts
if (tipoInstalacao === 'rota')      setModo('agendada');        // pula escolha de base
else if (tipoInstalacao === 'base') setModo('agendada-base');   // ❌ pula escolha de qual base!
else                                 setModo('escolha-local');
```

Quando o consultor pré-define `tipoInstalacao = 'base'`, o código **pula direto para `agendada-base`**, mas `oficinaIdSelecionada` está vazio (`''`). O `AgendamentoBase` então cai no fallback da linha 113–118 (`useOficina('')` retorna nada → usa `configBase`) e mostra "Base PRATIC" com endereço da Av. Brigadeiro Lima e Silva (config global), sem deixar o usuário escolher entre as bases reais cadastradas (Oficina Praticcar / Auto GJ).

Quando o usuário clica "Voltar" a partir dessa tela, o handler é `setModo('escolha-base')` (linha 265) — e aí sim aparece a tela correta com as 2 bases. Daí o sintoma: o `EscolhaBase` existe e funciona, mas **só é alcançado pelo botão Voltar**, nunca no fluxo direto.

Mesmo bug existe em `AgendamentoVistoriaCompleta.tsx` linhas 45–47: `tipoInstalacao === 'base' ? 'escolha-base'` — esse arquivo **acerta** (vai para `escolha-base`). O divergente é o `EtapaVistoria.tsx`.

## Correção

**`src/components/cotacao-publica/EtapaVistoria.tsx`** — linha 164:

```diff
  } else if (tipoInstalacao === 'base') {
-   setModo('agendada-base');
+   setModo('escolha-base');
  }
```

E ajustar o "Voltar" da `escolha-base` (linha 242) para refletir corretamente: quando `tipoInstalacao === 'base'` o passo anterior é `escolha` (não `escolha-local`, que é pulado). Já está correto: `setModo(tipoInstalacao ? 'escolha' : 'escolha-local')` ✓.

## Auditoria

- `AgendamentoVistoriaCompleta.tsx` (usado pós-autovistoria): já direciona corretamente para `escolha-base`. Sem mudança.
- `EscolhaLocalVistoria.tsx`: filtra opções por `tipoInstalacao` corretamente. Sem mudança.
- Quando há 1 só base cadastrada, o `EscolhaBase` ainda renderiza ela como cartão clicável — UX consistente, sem auto-skip (intencional).

## Validação

1. Link público com cotação onde consultor marcou `tipo_instalacao = 'base'`.
2. Etapa Vistoria → "Agendar Vistoria Presencial" → deve cair em **"Escolha a base"** com as 2 unidades (Oficina Praticcar e Auto GJ), **não** direto na agenda.
3. Selecionar base → tela de horários da base escolhida (endereço bate com a base clicada).
4. Botão Voltar da agenda → volta para "Escolha a base".
5. Botão Voltar de "Escolha a base" → volta para a tela inicial de tipo de vistoria (autovistoria/agendar).
6. Cotação sem `tipo_instalacao` definido: mantém fluxo `escolha-local` → escolha-base → agenda.
7. Cotação com `tipo_instalacao = 'rota'`: vai direto para agenda no endereço do cliente (inalterado).

## Resultado

Usuário sempre vê a lista de bases disponíveis antes dos horários, eliminando a seleção automática indevida da Base PRATIC global.

