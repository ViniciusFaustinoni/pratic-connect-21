

## Plano: Equalizar Permissoes do Analista de Monitoramento com Coordenador

### Contexto
Atualmente o `analista_monitoramento` tem permissoes limitadas (`canManageInstalacoes`, `canManageRastreadores`, `canManageOuvidoria`, `canViewDashboard`), enquanto o `coordenador_monitoramento` tem adicionalmente `canManageEquipeEstoque`, `canResetPassword`, `canUpdateEmail`, `canCreateUser`. Alem disso, no frontend, diversas telas verificam apenas `isCoordenadorMonitoramento` sem incluir `isAnalistaMonitoramento`.

### Alteracoes

**1. Migracao SQL — Igualar permissoes no banco**
```sql
UPDATE app_roles_config 
SET permissions = (
  SELECT permissions FROM app_roles_config WHERE role = 'coordenador_monitoramento'
)
WHERE role = 'analista_monitoramento';
```

**2. Frontend — Adicionar `isAnalistaMonitoramento` em todos os checks**

Nos seguintes arquivos, onde existe `isCoordenadorMonitoramento`, adicionar `|| isAnalistaMonitoramento`:

| Arquivo | Logica atual |
|---------|-------------|
| `AbrirRetiradaModal.tsx` | `podeHabilitarEncaixe = isDiretor \|\| isCoordenadorMonitoramento` |
| `ManutencaoTabela.tsx` | `canManage = isDiretor \|\| isCoordenadorMonitoramento` |
| `ManutencaoRastreadoresTab.tsx` | `canManage = isDiretor \|\| isCoordenadorMonitoramento` |
| `MapaVistoriasContent.tsx` | `podeCancelarAtribuicao = isDiretor \|\| isCoordenadorMonitoramento \|\| ...` |
| `VistoriasManutencao.tsx` | usa `isCoordenadorMonitoramento` |
| `AgendarManutencaoUnificadoModal.tsx` | `podeHabilitarEncaixe = isDiretor \|\| isCoordenadorMonitoramento` |
| `VistoriasPrestadoresDashboard.tsx` | PermissionGate com `isCoordenadorMonitoramento` |
| `RegioesAtendimento.tsx` | PermissionGate com `isCoordenadorMonitoramento` |
| `PrestadoresParceiros.tsx` | PermissionGate com `isCoordenadorMonitoramento` |
| `Dashboard.tsx` | verificacoes com `isCoordenadorMonitoramento` |

Todos passam a incluir `isAnalistaMonitoramento` ao lado de `isCoordenadorMonitoramento`.

### Arquivos
- **Migracao SQL**: 1 UPDATE em `app_roles_config`
- **Editar**: ~10 arquivos frontend (adicionar `|| isAnalistaMonitoramento` ou `'isAnalistaMonitoramento'` nos PermissionGates)

