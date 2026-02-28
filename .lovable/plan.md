

# Exibir visibilidade de modulos na edicao de usuario

## Problema

Ao editar um usuario em Configuracoes > Usuarios > Detalhes, so aparece a secao "Perfis de Acesso" (checkboxes de roles). Nao ha nenhuma indicacao visual de quais modulos/areas aquele usuario pode **visualizar** ou **editar** com base nos perfis selecionados.

O usuario espera ver essa informacao diretamente na tela de edicao do usuario.

## Solucao

Adicionar um novo Card **"Acesso a Modulos"** no formulario de edicao (`UsuarioForm.tsx`) que mostra, em tempo real, a **uniao dos modulos visiveis e editaveis** com base nos perfis selecionados. Este card sera **somente leitura** (a configuracao por perfil continua sendo feita na Matriz de Visibilidade em Usuarios e Acessos > aba Visibilidade).

### Comportamento

- Conforme o usuario marca/desmarca perfis nos checkboxes, o card atualiza automaticamente
- Consulta a tabela `role_module_visibility` com os perfis selecionados
- Mostra lista de modulos com indicadores visuais:
  - Icone de olho = pode visualizar
  - Icone de lapis = pode editar
  - Modulos sem acesso aparecem esmaecidos ou ocultos
- Inclui um link "Configurar permissoes por perfil" que leva a aba Visibilidade

### Onde sera posicionado

Logo abaixo do card "Perfis de Acesso", na coluna principal (col-span-2), para que o usuario veja imediatamente o impacto dos perfis selecionados.

## Alteracoes tecnicas

| Arquivo | Alteracao |
|---|---|
| `src/pages/configuracoes/UsuarioForm.tsx` | Adicionar card "Acesso a Modulos" que consulta `role_module_visibility` com base nos perfis selecionados e exibe a uniao dos modulos visiveis/editaveis em tempo real |

### Detalhes da implementacao

1. **Query reativa**: Criar uma query com `useQuery` que recebe `formData.perfis` como dependencia e busca os registros de `role_module_visibility` para os perfis selecionados
2. **Calculo de uniao**: Agregar os resultados (uniao de `visible=true` e `can_edit=true`) para exibir o acesso consolidado
3. **UI**: Grid com badges coloridas por modulo mostrando status de visualizacao e edicao
4. **Link**: Botao discreto "Gerenciar na Matriz de Visibilidade" apontando para `/configuracoes/usuarios-acessos?tab=visibilidade`

