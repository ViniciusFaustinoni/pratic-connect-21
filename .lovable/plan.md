

# Plano: Saldo de Horas com Bloqueio e Visibilidade

## Resumo

Transformar os campos `minutos_faltantes` e `saldo_anterior_minutos` em regras ativas: bloqueio de turno por debito acumulado, visibilidade do saldo no perfil do vistoriador, e coluna de saldo + cards resumo no RH.

---

## PARTE 1 — Configuracao na Diretoria

**`InstalacaoRotasConfig.tsx`**:

- Adicionar 2 chaves ao `CONFIG_CHAVES`: `jornada_limite_debito_horas`, `jornada_exibir_saldo_vistoriador`
- Adicionar ao hook: parsing dos 2 valores novos
- Adicionar state vars: `limiteDebito` (string, default '0'), `exibirSaldo` (boolean, default true)
- Populate no `useEffect`
- No Bloco 5, adicionar 2 campos apos os 6 existentes:
  - Input numerico "Limite de debito para bloqueio (horas)" — com nota "(0 = desativado)"
  - Toggle "Exibir saldo de horas para o vistoriador"
- Salvar junto no botao "Salvar Jornada" existente

**DB**: Insert 2 registros na tabela `configuracoes`:
- `jornada_limite_debito_horas` = `0`
- `jornada_exibir_saldo_vistoriador` = `true`

---

## PARTE 2 — Bloqueio no `useGarantirTurno.ts`

Antes de criar novo turno (linha 58), adicionar verificacao:

1. Ler `jornada_limite_debito_horas` da tabela `configuracoes` (fallback: 0)
2. Se limite > 0:
   - O `saldoAcumulado` ja e calculado na linha 71 — se for negativo e `Math.abs(saldoAcumulado) > limite * 60`:
   - Throw error com mensagem amigavel
3. Se limite === 0: prosseguir normalmente

No `onError`, detectar essa mensagem especifica e exibir `toast.error` com a mensagem de debito em vez do erro generico.

Retornar tambem `debitoBloqueado: boolean` e `mensagemDebito: string | null` para que o `BotaoIniciarServico` possa exibir o alerta visualmente.

---

## PARTE 3 — Perfil do Vistoriador (`InstaladorPerfil.tsx`)

Adicionar secao "Minha Jornada" entre o card de perfil e o card de menu:

1. Query `configuracoes` para `jornada_exibir_saldo_vistoriador` e `jornada_limite_debito_horas`
2. Query ultimo turno encerrado do profissional para pegar `saldo_anterior_minutos` + extras/faltantes → calcular saldo atual
3. Query turnos do mes corrente para total dias trabalhados e soma de `minutos_trabalhados`
4. Exibir:
   - **Saldo atual**: verde se positivo ("+ Xh Ymin de credito"), vermelho se negativo ("- Xh Ymin de debito") — so se config `exibir_saldo` = true
   - **Resumo do mes**: "X dias trabalhados" e "Xh Ymin total"
   - **Alerta de bloqueio**: se debito > limite configurado, card vermelho com aviso

---

## PARTE 4 — Painel RH (`JornadasProfissionais.tsx`)

### 4a. Cards de resumo de saldo (acima da tabela de turnos)

Adicionar apos os cards de estatisticas existentes (linha 285), um novo grid com 3 cards:
- "Vistoriadores com debito": count de turnos do dia com saldo negativo
- "Debito consolidado da equipe": soma dos saldos negativos formatado
- "Credito consolidado da equipe": soma dos saldos positivos formatado

Calcular com base nos turnos ja carregados na query existente (usando `saldo_anterior_minutos` + `minutos_extras` - `minutos_faltantes`).

### 4b. Coluna "Saldo" no JornadaProfissionalCard

No `JornadaProfissionalCard.tsx`, na secao de turno encerrado (linha 163), adicionar apos extras/faltantes:
- Linha "Saldo do dia": `minutos_extras - minutos_faltantes`, verde se positivo, vermelho se negativo

### 4c. Parametros read-only

Adicionar ao painel colapsavel de parametros os 2 novos campos:
- "Limite debito bloqueio": Xh (ou "Desativado" se 0)
- "Exibir saldo vistoriador": Sim/Nao

Adicionar as 2 chaves na query de parametros.

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| DB (insert) | 2 registros: `jornada_limite_debito_horas`, `jornada_exibir_saldo_vistoriador` |
| `src/components/gestao-comercial/InstalacaoRotasConfig.tsx` | 2 campos novos no Bloco 5 |
| `src/hooks/useGarantirTurno.ts` | Verificacao de debito antes de criar turno |
| `src/pages/instalador/InstaladorPerfil.tsx` | Secao "Minha Jornada" |
| `src/components/rh/JornadaProfissionalCard.tsx` | Linha "Saldo do dia" |
| `src/pages/rh/JornadasProfissionais.tsx` | 3 cards resumo + 2 parametros read-only |

