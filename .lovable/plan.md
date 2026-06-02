# Leva 3 — Mudança 2 de 3: guard no efeito #9 (`cotacaoParaEditar` / edição)

## Escopo

Aplicar o mesmo padrão de guard do efeito #8 ao efeito #9 do `CotacaoFormDialog.tsx` (atualmente em `~L1440`, `useEffect(() => { if (cotacaoParaEditar && open) { ... } }, [cotacaoParaEditar, open, form, restaurarVeiculoPorPlaca])`).

Diferença em relação ao #8: aqui o tipo do prop é `CotacaoBaseParaFormulario & { id: string }` (linha 145). O `id` existe, é canônico e estável — **chave do guard é `cotacaoParaEditar.id`**, sem fingerprint improvisado.

## Implementação

```ts
const cotacaoEditarPrefilledIdRef = useRef<string | null>(null);
useEffect(() => {
  if (!open) {
    cotacaoEditarPrefilledIdRef.current = null;
    return;
  }
  if (!cotacaoParaEditar) return;
  if (cotacaoEditarPrefilledIdRef.current === cotacaoParaEditar.id) return;
  cotacaoEditarPrefilledIdRef.current = cotacaoParaEditar.id;

  // ... corpo atual do efeito inalterado ...
}, [open, cotacaoParaEditar, form, restaurarVeiculoPorPlaca]);
```

- Dependências do array **mantidas exatamente como estão** — não troco `cotacaoParaEditar` por `.id` no array, só uso o `.id` como chave do ref (early-return interno). Isso preserva o ESLint exhaustive-deps original e evita qualquer mudança de timing.
- Reset no `!open` garante que reabrir a mesma cotação re-executa o pre-fill.
- Troca de `id` (A → B sem fechar) → ref não bate → re-executa pre-fill com os dados de B.

## Por que não altera comportamento

| Cenário | Hoje | Depois |
|---|---|---|
| Abrir editar A | Pre-fill roda | Pre-fill roda (ref era null) |
| Re-render do pai com mesma A (ref nova) | Pre-fill **re-roda** (derruba estado) | Pre-fill **não re-roda** (id bate) ✅ corrige o ruído |
| Trocar A → B sem fechar | Pre-fill roda com B | Pre-fill roda com B (id diferente) |
| Fechar e reabrir A | Pre-fill roda | Pre-fill roda (ref resetou em `!open`) |

## O que NÃO entra

- Efeito #7 (lead) — fica para a próxima leva.
- Demais 8 efeitos — intocados.
- Nenhuma mudança de cálculo, de valores ou de fluxo.

## Validação no preview (fluxo edição)

1. Abrir uma cotação para editar → conferir todos os campos: placa, FIPE, plano(s) selecionado(s), indicador, região, categoria, 0KM, nome/telefone/email do associado.
2. Fechar e reabrir a mesma → pré-preenche idêntico.
3. **Teste crítico:** editar cotação A → sem fechar, abrir cotação B → campos viram os de B (não grudam em A).
4. Salvar a edição → mesma payload de hoje.

Se algum dos 4 falhar, reverter e investigar.

Aguardando OK para aplicar.
