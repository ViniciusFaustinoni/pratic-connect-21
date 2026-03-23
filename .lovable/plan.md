

# Plano: Jornada dos Vistoriadores — Configurável pela Diretoria

## Resumo

Tornar os 6 parâmetros de jornada configuráveis via Diretoria, lidos dinamicamente pelo hook e edge function, e visíveis em modo leitura pelo RH.

---

## PARTE 1 — Inserir chaves na tabela `configuracoes`

Inserir 6 registros via migration/insert:

| chave | valor padrão |
|---|---|
| `jornada_duracao_turno_horas` | `8` |
| `jornada_horas_ate_almoco` | `4` |
| `jornada_duracao_almoco_minutos` | `60` |
| `jornada_tolerancia_atraso_minutos` | `0` |
| `jornada_produtividade_minima` | `1` |
| `jornada_horas_alerta_improdutividade` | `2` |

---

## PARTE 2 — Seção "Jornada dos Vistoriadores" na Diretoria

Adicionar um **Bloco 5** ao final de `InstalacaoRotasConfig.tsx`:

- Card com título "Jornada dos Vistoriadores" e ícone `Clock`
- 6 campos numéricos (2 colunas em desktop):
  - Duração do turno (h), Horas até almoço (h), Duração almoço (min), Tolerância atraso (min), Produtividade mínima (serviços), Horas alerta improdutividade (h)
- Botão "Salvar Jornada"
- Aviso em `text-amber-600`: "Alterações têm efeito imediato na operação. Informe a equipe antes de alterar."
- Reutilizar o pattern existente: estado local, `useEffect` para popular do DB, `salvarConfig` helper

Adicionar as 6 chaves ao `CONFIG_CHAVES` e ao hook `useInstalacaoConfigs`.

---

## PARTE 3 — Hook `useJornadaTrabalho.ts`

- Adicionar query para buscar as 3 chaves de jornada (`jornada_duracao_turno_horas`, `jornada_horas_ate_almoco`, `jornada_duracao_almoco_minutos`) da tabela `configuracoes`
- Converter para minutos e usar como variáveis em vez das constantes hardcoded (linhas 52-54)
- Fallback: manter os valores atuais (480, 240, 60) se a query falhar ou retornar vazio
- Substituir todas as referências a `JORNADA_PADRAO_MINUTOS`, `TEMPO_ATE_ALMOCO_MINUTOS`, `DURACAO_ALMOCO_MINUTOS` pelas variáveis dinâmicas

---

## PARTE 4 — Edge Function `atribuir-proxima-tarefa`

Em `supabase/functions/atribuir-proxima-tarefa/index.ts` (linha 259):

- Antes da verificação de almoço, ler `jornada_horas_ate_almoco` da tabela `configuracoes` usando o `config-helper.ts` já existente
- Converter para minutos (`valor * 60`)
- Substituir o `240` hardcoded pelo valor lido
- Fallback: 240 (4h)

---

## PARTE 5 — Painel read-only no RH (`JornadasProfissionais.tsx`)

- Adicionar componente `ParametrosJornadaPanel` no topo da página, antes dos stats cards
- Usar `Collapsible` (já existe no projeto) — inicialmente colapsado
- Buscar as 6 chaves de configuração da tabela `configuracoes`
- Exibir em grid 3x2 com labels e valores formatados (ex: "8h", "60 min", "1 serviço")
- Botão "Editar configurações" que navega para `/diretoria/gestao-comercial` (aba Instalação e Rotas)

---

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `src/components/gestao-comercial/InstalacaoRotasConfig.tsx` | Novo bloco 5 + chaves no hook |
| `src/hooks/useJornadaTrabalho.ts` | Query dinâmica substituindo constantes |
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Ler config do banco em vez de 240 |
| `src/pages/rh/JornadasProfissionais.tsx` | Painel colapsável de parâmetros |
| DB (insert) | 6 registros na tabela `configuracoes` |

