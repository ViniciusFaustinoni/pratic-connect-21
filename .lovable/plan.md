

# Substituir "Especialidades" por "Tipos de Pecas" no formulario de Auto Centers

## Problema

O formulario de Auto Centers exibe uma secao "Especialidades" com opcoes de servicos (Funilaria, Mecanica, Pintura, etc.). Auto Centers nao realizam servicos -- eles **vendem pecas**. A secao deve listar categorias de pecas, nao servicos.

## Correcoes

### 1. Criar constante TIPOS_PECAS

**Arquivo:** `src/lib/fornecedores-constants.ts`

Adicionar novo array com categorias de pecas:

```text
Peças Novas
Peças Usadas
Peças Recondicionadas
Peças Importadas
Peças Genuínas / Originais
Peças Paralelas / Alternativas
```

### 2. Criar componente TiposPecasSelect

**Arquivo:** `src/components/oficinas/TiposPecasSelect.tsx`

Componente com checkboxes (mesmo padrao visual do EspecialidadesSelect), mas usando a lista TIPOS_PECAS. Label: "Tipos de Pecas".

### 3. Substituir EspecialidadesSelect no formulario

**Arquivo:** `src/components/oficinas/AutoCenterFormDialog.tsx`

- Trocar o import de `EspecialidadesSelect` por `TiposPecasSelect`
- Renomear o state `especialidades` para `tiposPecas`
- No payload do submit, enviar `especialidades: tiposPecas` (manter o campo do banco como `especialidades` para nao precisar de migracao)

### 4. Atualizar filtro na listagem

**Arquivo:** `src/pages/oficinas/AutoCenters.tsx`

- No select de filtro "Especialidade", trocar label para "Tipo de Peca" e usar a lista TIPOS_PECAS em vez de ESPECIALIDADES
- Trocar o placeholder para "Todos os tipos de peca"

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/lib/fornecedores-constants.ts` -- adicionar TIPOS_PECAS |
| Criar | `src/components/oficinas/TiposPecasSelect.tsx` -- novo componente |
| Modificar | `src/components/oficinas/AutoCenterFormDialog.tsx` -- trocar EspecialidadesSelect por TiposPecasSelect |
| Modificar | `src/pages/oficinas/AutoCenters.tsx` -- atualizar filtro de especialidade para tipos de peca |

