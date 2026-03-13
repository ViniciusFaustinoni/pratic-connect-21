

## O Que Já Funciona Hoje vs. O Que Precisa Mudar

### Já funciona (reativo, automático)

O hook `usePlanosCotacao` **já é 100% reativo**. Ele recebe `parametrosPlanos` via `useMemo` e recalcula automaticamente quando qualquer campo muda. Todos os 9 portões de filtragem já rodam em tempo real internamente:

| Portão | Dados que usa | Já reativo? |
|---|---|---|
| 1. Variante Aplicativo | tipo_uso do plano | ✅ Sim — filtro fixo interno |
| 2. Tipo de veículo | marca/modelo → carro/moto | ✅ Sim — `tipoVeiculoDetectado` no useMemo |
| 3. Ano mínimo | ano do veículo | ✅ Sim — `anoVeiculo` no parametrosPlanos |
| 4. Faixa FIPE do plano | valor FIPE | ✅ Sim — `valorFipe` no parametrosPlanos |
| 5. Ano recente | ano do veículo | ✅ Sim — reutiliza anoVeiculo |
| 6. Categorias bloqueadas | categoriaVeiculo | ✅ Sim — `categoria` no parametrosPlanos |
| 7. Categorias aceitas | categoriaVeiculo | ✅ Sim — mesmo campo |
| 8. Elegibilidade modelo | marca + modelo + ano + combustível | ✅ Sim — todos no parametrosPlanos |
| 9. Faixa de preço válida | FIPE + região + combustível + uso | ⚠️ Parcial — região hardcoded como `'rj'` |

**Resumo: a lógica de negócio já funciona.** O motor já filtra corretamente por todas as regras. O problema é **apenas de UI**.

---

### O que NÃO funciona (bloqueio de UI)

O único bloqueio é o booleano `cotacaoCalculada`. Ele controla se os planos aparecem ou não na tela:

```
Linha 1247: {!cotacaoCalculada ? (
              "Nenhuma cotação gerada — clique em Calcular"
            ) : (
              <planos filtrados>  ← já corretos, já reativos
            )}
```

**O problema concreto** — 6 pontos no código resetam `cotacaoCalculada = false` quando o consultor muda campos:

| Local | Quando reseta | Efeito |
|---|---|---|
| Linha 533 | Busca nova placa | Esconde planos ❌ |
| Linha 555 | Troca marca | Esconde planos ❌ |
| Linha 578 | Seleciona lead com FIPE | Esconde planos ❌ |
| Linha 1021 | Troca modelo | Esconde planos ❌ |
| Linha 1047 | Troca ano | Esconde planos ❌ |
| Linha 419 | Limpar tudo | Esconde planos ✅ (correto) |

Ou seja: o consultor preenche tudo, calcula, vê os planos. Depois muda a categoria para "leilão" — os planos **já se refiltram corretamente** (o hook é reativo). Mas se ele mudar o modelo ou o ano, os planos **somem** e ele precisa clicar "Calcular" de novo, mesmo que o hook já tenha os resultados prontos.

---

### O que precisa ser feito (resumo)

1. **Remover os 5 resets desnecessários** de `setCotacaoCalculada(false)` — manter apenas no `limparTudo`
2. **Adicionar um `useEffect`** que seta `cotacaoCalculada = true` automaticamente quando `valorFipe > 0` e `planosDB` retorna resultados
3. **Adicionar campo de Região** substituindo o hardcode `'rj'` — a filtragem do Portão 9 já suporta, só falta o campo na UI
4. **Auto-atualizar a tab** quando a lista de planos muda (para não ficar em um plano que saiu)

**Nenhuma regra de negócio precisa ser criada ou alterada.** Todas já existem e já funcionam. A mudança é exclusivamente de comportamento de exibição.

