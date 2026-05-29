# Refatoração — CotacaoFormDialog (3.686 linhas → ~700)

## Objetivo

Quebrar o JSX monolítico em sub-componentes **por bloco visual**. Estado, hooks, validações, mutations e handlers **continuam todos no componente pai** — extraímos só apresentação. Zero mudança de lógica de negócio, zero risco no fluxo canônico de cotação.

## Princípios (não negociáveis)

1. **Nada de lógica nova.** Só recortar JSX e passar props.
2. **Estado fica no pai.** Hooks (`useState`, `useEffect`, `useMemo`, mutations, busca FIPE, validação de placa, detecção de tipo, cenário de adesão, modo 0KM, geração de PDF, WhatsApp) **não se movem**.
3. **Sem novos contextos.** Passamos props explícitas — fica verboso, mas mantém o grafo de dados rastreável.
4. **Modais externos saem com seu próprio arquivo** (já existem: `PlacaDuplicadaModal`, `VeiculoSGAModal`, `PlacaOutroAssociadoModal`) — só conferir que continuam isolados.
5. **Memorias respeitadas:** fluxo canônico 8 etapas, gate 0KM, `normalizarTipoEntrada`, tri-fonte FIPE, regra 1%, dispensa de rastreador, integração SGA — nada disso é tocado.

## Estrutura proposta

Nova pasta: `src/components/cotacoes/form-sections/`

| Componente | Linhas atuais (origem) | Responsabilidade visual |
|---|---|---|
| `SectionAssociado.tsx` | 2259–2415 | Nome, telefone, email, indicação |
| `SectionVeiculo.tsx` | 2416–2788 | Busca por placa, gate 0KM, FIPE com seletor de versão, seleção manual marca/modelo/ano, combustível, valor FIPE, alerta dupla aprovação |
| `SectionCondicoes.tsx` | 2856–3056 | Região, uso, tipo da cotação, observação SGA, tipo de placa + alertas |
| `SectionPlanos.tsx` | 3057–3342 | Grade de planos, valor adicional, cenário de adesão, taxa de filiação, alertas de adesão mínima e repasse volante |
| `SectionComercial.tsx` | 3343–3433 | Consultor responsável, dia de vencimento |
| `SectionResumo.tsx` | 3434–3575 | Resumo inline com planos selecionados, benefícios "ver mais", filiação/validade |
| `SectionAcoes.tsx` | 3576–3594 | Footer sticky com botões salvar/cancelar |

Os blocos pré-formulário (banners `DraftRestoreBanner`, sem-permissão) ficam **inline no pai** — são 1–2 linhas cada.

## Como cada seção recebe estado

Padrão único: a seção recebe um objeto `props` com os campos que lê e os setters/handlers que dispara. Exemplo:

```ts
// SectionVeiculo.tsx (assinatura ilustrativa)
type Props = {
  placa: string;
  setPlaca: (v: string) => void;
  isZeroKm: boolean | null;
  onResponderGate0Km: (v: boolean) => void;
  fipeResult: FipeResult | null;
  variantesFipe: FipeVariante[];
  versaoSelecionada: string | null;
  onSelecionarVersao: (v: string) => void;
  marca: string; modelo: string; ano: string; combustivel: string;
  setMarca: ...; setModelo: ...; setAno: ...; setCombustivel: ...;
  valorFipe: number; setValorFipe: ...;
  alertaFipeAcimaLimite: boolean;
  buscandoFipe: boolean;
  // ... (apenas o que esta seção realmente usa)
};
```

O pai monta cada bloco assim:

```tsx
<SectionVeiculo
  placa={placa} setPlaca={setPlaca}
  isZeroKm={isZeroKm} onResponderGate0Km={handleGate0Km}
  // ...
/>
```

## Passos de execução (ordem obrigatória)

1. **Snapshot inicial** — `wc -l` antes e linhas dos `{/* BLOCO N */}` mapeadas (já feito, ver tabela).
2. **Criar pasta** `src/components/cotacoes/form-sections/` com um `index.ts` que re-exporta.
3. **Extrair uma seção por vez**, na ordem: Associado → Comercial → Acoes → Condicoes → Resumo → Planos → Veículo (das mais simples para as mais densas, para reduzir risco).
4. Para cada extração:
   - Copiar o JSX cru para o novo arquivo.
   - Listar todos os símbolos referenciados → vira a `Props` da seção.
   - Substituir o trecho no pai por `<SectionX ...props />`.
   - Conferir build TS (`tsc --noEmit` roda automático no harness).
5. **Não tocar** nas mutations, no `useEffect` de busca FIPE, no cálculo de planos, no `normalizarTipoEntrada`, nem nos modais externos.
6. **Validação manual** ao final: abrir uma cotação nova, uma de substituição (com `normalizarTipoEntrada`), uma 0KM, e o fluxo Troca de Titularidade (que reusa este dialog via `TrocaTitularidadeDialog`).

## O que NÃO está no escopo (explicitamente)

- ❌ Mover hooks para custom hooks (`useCotacaoForm`, `useFipeLookup`, etc.) — fica para outra dívida técnica.
- ❌ Introduzir Context/Zustand/Jotai.
- ❌ Renomear campos, mudar validações, mexer em qualquer edge function ou query.
- ❌ Refatorar `CotacaoFormDialog` para componente controlado/uncontrolled diferente.
- ❌ Testes unitários novos (o objetivo declarado é só preparar o terreno; testes virão em ticket separado).

## Resultado esperado

- `CotacaoFormDialog.tsx`: ~3.686 → ~700–900 linhas (só hooks, handlers, montagem das seções e modais).
- 7 arquivos novos em `form-sections/`, cada um <500 linhas.
- Diff revisável: cada seção é um commit lógico de "mover JSX + criar Props".
- Zero mudança comportamental observável pelo usuário.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Props explodirem (20+ por seção) | Aceitar verbosidade nesta fase; é o preço por não introduzir contexto. Agrupar em objetos só quando ≥30 props. |
| Re-render do pai a cada keystroke vazar para todas as seções | Aceitável — comportamento já é esse hoje. Otimização com `React.memo` fica para depois (e exige estabilizar handlers com `useCallback`, que é mudança de lógica). |
| Esquecer um símbolo no recorte | TS pega no build; reforçado pela ordem "simples → complexa". |
| Quebrar `TrocaTitularidadeDialog` que consome este dialog | Conferir manualmente após extração; assinatura pública do `CotacaoFormDialog` não muda. |

Aprovação para começar pela `SectionAssociado` (a mais isolada)?
