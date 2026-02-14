
# Separar Especialidades por Contexto (Oficina vs Prestador)

## Problema

A lista `ESPECIALIDADES` em `fornecedores-constants.ts` e compartilhada entre Oficinas e Prestadores de Evento, mas contem itens que nao pertencem a oficinas:

- **Pecas** (Pecas Novas, Pecas Recondicionadas, Pecas Importadas) -- pertencem aos Auto Centers
- **Servicos de prestador** (Reboque / Guincho, Vistoria Cautelar) -- pertencem aos Prestadores de Evento

## Solucao

Criar listas separadas para cada contexto, mantendo a lista original para compatibilidade com prestadores.

### Alteracoes

**Arquivo: `src/lib/fornecedores-constants.ts`**

Criar uma nova constante `ESPECIALIDADES_OFICINAS` contendo apenas as especialidades de servico de oficina (11 itens), removendo as 5 que nao se aplicam:

| Manter (Oficinas) | Remover |
|---|---|
| Funilaria / Lanternagem | Pecas Novas |
| Pintura Automotiva | Pecas Recondicionadas |
| Mecanica Geral | Pecas Importadas |
| Mecanica Especializada (cambio, motor) | Reboque / Guincho |
| Eletrica Automotiva | Vistoria Cautelar |
| Vidros e Farois | |
| Ar Condicionado | |
| Suspensao e Freios | |
| Polimento e Estetica | |
| Tapecaria / Estofamento | |
| Martelinho de Ouro | |

Criar tambem `ESPECIALIDADES_PRESTADORES` com a lista completa (ou especifica para prestadores) para uso no formulario de prestadores.

**Arquivo: `src/components/oficinas/EspecialidadesSelect.tsx`**

Adicionar uma prop `contexto` (opcional, default "oficina") para determinar qual lista usar. Quando `contexto="oficina"`, usa `ESPECIALIDADES_OFICINAS`. Quando `contexto="prestador"`, usa `ESPECIALIDADES` (lista completa).

**Arquivo: `src/pages/oficinas/Oficinas.tsx`**

Trocar a importacao de `ESPECIALIDADES` por `ESPECIALIDADES_OFICINAS` no filtro de especialidades da listagem de oficinas.

**Arquivo: `src/components/oficinas/PrestadorFormDialog.tsx`**

Passar `contexto="prestador"` ao componente `EspecialidadesSelect` para manter a lista completa.

Nenhum arquivo de oficina (OficinaFormDialog) precisa de alteracao alem do componente `EspecialidadesSelect`, pois ele ja o utiliza e herdara o comportamento default "oficina".
