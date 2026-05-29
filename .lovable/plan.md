## Objetivo

Padronizar validação e máscara de **e-mail** e **telefone** no fluxo de cotação interno e no link público, usando exclusivamente os utilitários canônicos de `src/lib/validations/index.ts`. E-mail mantém obrigatoriedade atual de cada campo (não vira obrigatório onde é opcional). Telefone passa a exigir 11 dígitos com feedback em tempo real.

---

## 1. Ajuste no schema canônico (não cria utilitário novo, corrige o existente)

`src/lib/validations/index.ts` — `telefoneSchema` (linhas 129-131)

Hoje: `z.string().min(14).max(15)` — aceita 10 dígitos (fixo) e não valida formato.

Trocar por:
```ts
export const telefoneSchema = z.string()
  .refine((val) => val.replace(/\D/g, '').length === 11, 'Telefone deve ter 11 dígitos (DDD + celular)');
```

Justificativa: a regra canônica solicitada é "exatamente 11 dígitos (DDD + 9 móvel)". `emailSchema` já está adequado (`.email().or(z.literal(''))`) — não muda.

Risco: outros consumidores de `telefoneSchema` (ex.: `leadSchema`, `associadoSchema`) passam a exigir 11 dígitos. Isto é o comportamento desejado segundo a regra canônica; se algum formulário hoje aceita fixo de 10, ficará vermelho até receber celular. Aceitar isso como hardening intencional.

---

## 2. CotacaoFormDialog (fluxo interno)

`src/components/cotacoes/CotacaoFormDialog.tsx`

**Telefone (linha 2284)** — hoje já usa `<TelefoneInput>` (máscara OK). Adicionar:
- Erro inline abaixo do campo quando `telefoneAssociado.replace(/\D/g,'').length > 0 && length !== 11`.
- Bloquear submit já existente (`length < 10`) trocar para `length !== 11`.

**E-mail (linha 2302)** — hoje só `type="email"`. Adicionar:
- Validar com `emailSchema.safeParse(emailAssociado)` no `onChange` (debounce não necessário).
- Mostrar erro inline "E-mail inválido" abaixo do input quando preenchido e inválido.
- Não bloquear submit (campo continua opcional).
- Adicionar bloqueio condicional: se preenchido e inválido, impedir submit (toast).

---

## 3. EtapaDadosAssociado (stepper interno)

`src/components/cotacao/EtapaDadosAssociado.tsx`

- **Remover** `formatPhone` local (linha 51).
- **Manter** `formatCPF` local (fora do escopo desta task).
- **Importar** `maskTelefone` e `telefoneSchema` de `@/lib/validations`.
- **Importar** `emailSchema` de `@/lib/validations`.
- Trocar `setTelefone1(formatPhone(...))` → `setTelefone1(maskTelefone(...))` (linha 313).
- Trocar `setTelefone2(formatPhone(...))` → `setTelefone2(maskTelefone(...))` (linha 328).
- Adicionar erro inline em `telefone1`: vermelho + texto quando `digits.length > 0 && digits.length !== 11`. (Obrigatório → bloqueia avançar.)
- Adicionar erro inline em `telefone2`: igual ao acima, **mas** só valida se preenchido (opcional). Máscara aplicada sempre.
- E-mail (linha 295): trocar uso da `EMAIL_REGEX` (em `Cotacao.tsx:290`) por `emailSchema.safeParse(...)`. Mostrar erro inline em tempo real no input do `EtapaDadosAssociado`. O bloqueio no submit (`Cotacao.tsx:289-291`) também passa a usar `emailSchema`.

---

## 4. EtapaDadosPessoaisDocumentos (link público)

`src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

- **Remover** `formatTelefone` local (linha 226).
- **Importar** `maskTelefone`, `telefoneSchema`, `emailSchema` de `@/lib/validations`.
- Trocar `setTelefone(formatTelefone(...))` → `setTelefone(maskTelefone(...))` (linha 1296).
- **Telefone (1291)**: adicionar erro inline quando dígitos !== 11. Como é obrigatório (`temContato`), o check `temContato` passa a exigir `telefoneSchema.safeParse(telefone).success`.
- **E-mail (1277)**: adicionar `emailSchema.safeParse(email).success` no `temContato`. Erro inline visual abaixo do input.

---

## 5. FormularioDadosPessoais (decisão pontual)

`src/components/cotacao-publica/FormularioDadosPessoais.tsx:79` é a **terceira duplicata** (`formatTelefone`).

Conforme diagnóstico anterior, é fallback **fora do fluxo principal** (RHF+Zod legado). Duas opções:

- **(A) Recomendado:** substituir também — manter consistência total. Remove a duplicata e usa `maskTelefone` no `onChange` (linha 175). O `telefoneSchema` já é importado/usado no schema do form, então ganha 11-dígitos automaticamente após o passo 1.
- **(B)** Deixar como está — fora do fluxo principal.

Plano adota **(A)** por padrão (custo trivial, zero risco, alinhamento total). Se preferir (B), avise antes de eu executar.

---

## 6. Fora do escopo (não tocar)

- CPF, CNH, data de nascimento, placa, CEP, chassi, RENAVAM, qualquer campo monetário.
- Outras telas que usam `formatPhone` apenas para **exibição** (tabelas, cards, termos): `CotacoesTable`, `CotacoesMobileList`, `LeadDetalhe`, `ContratoDetalhe`, `AssociadoHeroHeader`, `TermoFiliacaoTemplate`, `ModalDetalhesTroca`, etc. — não são inputs, ficam intocados.
- `EMAIL_REGEX` em `CorrigirEmailDialog.tsx:18` — não é input de cotação (ferramenta admin de correção pós-fato); fica fora do escopo, sinalizo para limpeza futura.
- Regras de obrigatoriedade existentes (e-mail opcional onde já é opcional).

---

## Validação pós-implementação

1. `rg "formatPhone|formatTelefone" src/components/cotacao src/components/cotacao-publica src/components/cotacoes/CotacaoFormDialog.tsx` deve retornar zero matches (somente o `formatCPF` em `EtapaDadosAssociado` permanece, fora deste escopo).
2. `rg "EMAIL_REGEX" src/components/cotacao src/components/cotacao-publica src/pages/vendas/Cotacao.tsx` zero matches.
3. Smoke manual:
   - CotacaoFormDialog: digitar `(11) 99999-99` → erro inline; completar até 11 → erro some. E-mail vazio = OK; `foo@bar` → erro inline; `foo@bar.com` → OK.
   - EtapaDadosAssociado: idem para telefone1/telefone2 e email.
   - Link público (EtapaDadosPessoaisDocumentos): idem; botão "Continuar" só libera com e-mail válido + telefone 11 dígitos.

---

## Resumo das alterações por arquivo

| Arquivo | Mudança |
|---|---|
| `src/lib/validations/index.ts` | `telefoneSchema` → refine 11 dígitos |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | E-mail: erro inline + emailSchema; telefone: 11 dígitos no canProceed/submit |
| `src/components/cotacao/EtapaDadosAssociado.tsx` | Remove `formatPhone`, usa `maskTelefone`+`telefoneSchema`+`emailSchema`, erro inline tel1/tel2/email |
| `src/pages/vendas/Cotacao.tsx` | Troca `EMAIL_REGEX` por `emailSchema` no submit |
| `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` | Remove `formatTelefone`, usa canônicos, `temContato` valida com schemas |
| `src/components/cotacao-publica/FormularioDadosPessoais.tsx` | Remove `formatTelefone`, usa `maskTelefone` (opção A) |
