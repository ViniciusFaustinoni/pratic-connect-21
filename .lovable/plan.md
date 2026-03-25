

# Permissoes Granulares: Analista vs Coordenador de Monitoramento

## Contexto

As permissoes **ja existem** no banco e diferenciam os dois perfis:

| Permission | Coordenador | Analista |
|---|---|---|
| `canManageInstalacoes` | Sim | Sim |
| `canManageRastreadores` | Sim | Sim |
| `canManageOuvidoria` | Sim | Sim |
| `canViewDashboard` | Sim | Sim |
| `canManageEquipeEstoque` | Sim | **Nao** |
| `canCreateUser` | Sim | **Nao** |
| `canResetPassword` | Sim | **Nao** |
| `canUpdateEmail` | Sim | **Nao** |

O analista ve todas as abas, mas nao pode: atribuir servicos, excluir equipamento, gerenciar equipe, mudar credenciais. O problema e que alguns componentes usam `isDiretor` como gate ou nao tem gate nenhum.

## Alteracoes

### 1. `RastreadorDetailDrawer.tsx` — Proteger botao Excluir
O botao de excluir rastreador no drawer nao tem nenhum gate. Adicionar `usePermissions()` e condicionar o botao com `isDiretor` (somente diretores excluem rastreadores — politica atual). Botao fica desabilitado com Tooltip para quem nao tem permissao.

### 2. `RastreadorTableView.tsx` — Trocar `isDiretor` por `canManageEquipeEstoque`
- **Excluir**: manter `isDiretor` (somente diretor exclui)
- **Atribuir Portador** (`onAssignPortador`): adicionar gate com `canManageEquipeEstoque` — coordenador pode, analista nao. Renomear prop `isDiretor` para `canManageEquipeEstoque` (ou adicionar prop separada)
- **Enviar para Manutencao** e **Retirar Rastreador**: ja sao visiveis quando `isInstalled`, ambos perfis podem — manter sem gate adicional

### 3. `RastreadorBatchActions.tsx` — Proteger "Atribuir Portador"
Adicionar prop `canAssign` e desabilitar botao "Atribuir Portador" quando false. O componente pai (`Rastreadores.tsx`) passa `hasPerm('canManageEquipeEstoque')`.

### 4. `Rastreadores.tsx` — Passar permissions corretas
Trocar `isDiretor` por `hasPerm('canManageEquipeEstoque')` para atribuicao. Manter `isDiretor` para exclusao. Passar ambos como props separadas para `RastreadorTableView` e `RastreadorBatchActions`.

### 5. `ManutencaoInterna.tsx` — Analista pode acessar
Atualmente `temAcesso = isDiretor || isCoordenadorMonitoramento`. Adicionar `isAnalistaMonitoramento`:
```
temAcesso = isDiretor || isCoordenadorMonitoramento || isAnalistaMonitoramento
```
`podeDescartar` continua `isDiretor` (somente diretor descarta).

### 6. `VistoriasManutencao.tsx` — Analista pode visualizar
Mesmo padrao: adicionar `isAnalistaMonitoramento` ao check de acesso.

## Arquivos editados

| Arquivo | Alteracao |
|---|---|
| `src/components/rastreadores/RastreadorDetailDrawer.tsx` | Gate no Excluir com `isDiretor`, botao desabilitado com Tooltip |
| `src/components/rastreadores/RastreadorTableView.tsx` | Separar props: `isDiretor` (excluir) + `canManageEquipe` (atribuir portador) |
| `src/components/rastreadores/RastreadorBatchActions.tsx` | Prop `canAssign`, desabilitar "Atribuir Portador" |
| `src/pages/monitoramento/Rastreadores.tsx` | Passar `hasPerm('canManageEquipeEstoque')` como prop de atribuicao |
| `src/pages/monitoramento/ManutencaoInterna.tsx` | Adicionar `isAnalistaMonitoramento` ao check de acesso |
| `src/pages/monitoramento/VistoriasManutencao.tsx` | Adicionar `isAnalistaMonitoramento` ao check de acesso |

Nenhuma permission nova criada. Nenhum hardcode de role name nas verificacoes de acao — tudo usa `hasPerm()` ou identity flags ja existentes. O coordenador pode ajustar as permissions do analista pela tela de Perfis existente.

