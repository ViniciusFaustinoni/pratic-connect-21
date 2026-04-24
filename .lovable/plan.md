## Plano de implementação — Alternância temporária Instalador/Vistoriador ↔ Vistoriador Base

### Objetivo
Adicionar, na aba existente **Monitoramento → Equipe**, um controle seguro para o Coordenador de Monitoramento alternar o perfil operacional atual de um técnico entre:

- **Instalador/Vistoriador**: operação em rota/campo.
- **Vistoriador Base**: operação na base administrativa.

A alternância será persistente até reversão manual, sem alterar o perfil permanente do cadastro e sem redistribuir serviços já atribuídos.

---

### Mapa do que já existe

- A tela principal é `src/pages/monitoramento/Equipe.tsx`.
- Cada técnico é exibido por `src/components/equipe/EquipeCard.tsx`.
- A lista de equipe vem de `src/hooks/useEquipe.ts`, hoje lendo `user_roles` e priorizando `instalador_vistoriador` sobre `vistoriador_base`.
- Os papéis `instalador_vistoriador` e `vistoriador_base` já existem e não serão recriados.
- Já existe lógica operacional por alocação/base em `alocacoes_diarias`, mas ela é diária e não resolve a troca persistente de perfil operacional.
- Existem pontos que consultam diretamente `user_roles` para decidir “instalador” ou “base”; esses pontos precisam passar por uma camada única de “perfil operacional efetivo”.

---

### Banco de dados

Criar uma tabela nova apenas para o estado temporário da cobertura, preservando `user_roles` como perfil permanente:

```text
tecnico_perfil_operacional
- id
- profissional_id          referência ao profiles.id do técnico
- role_permanente          instalador_vistoriador | vistoriador_base
- role_operacional         instalador_vistoriador | vistoriador_base
- ativo                    true/false
- criado_por               usuário que iniciou a cobertura
- encerrado_por            usuário que reverteu
- criado_em
- encerrado_em
- observacoes
```

Regras:
- Apenas um registro ativo por técnico.
- Se não houver registro ativo, o perfil operacional efetivo é o perfil permanente em `user_roles`.
- A alternância não altera nem remove `user_roles`.

Criar também a tabela de auditoria:

```text
tecnico_perfil_operacional_historico
- id
- profissional_id
- alterado_por
- role_anterior
- role_novo
- acao                    ativar_cobertura | reverter_cobertura
- criado_em
```

RLS:
- Coordenador de Monitoramento, Diretor, Admin Master e Desenvolvedor podem consultar e alterar.
- Técnicos podem, no máximo, consultar o próprio estado operacional se necessário para o app profissional.
- Histórico consultável por Coordenação/Diretoria/Admin/Desenvolvedor.

---

### Camada central de perfil efetivo

Criar uma função/hook central para resolver o perfil operacional efetivo, evitando espalhar regras em vários módulos:

```text
perfil efetivo = registro ativo em tecnico_perfil_operacional.role_operacional
                 senão perfil permanente em user_roles
```

No frontend, `useProfissionaisEquipe()` será atualizado para retornar:

```text
role_permanente
role_operacional
em_cobertura
tipo_cobertura: base | rota | null
```

Isso permite que qualquer componente use `role_operacional` sem recalcular a regra.

---

### Interface na aba Equipe

Atualizar os cards existentes, sem criar rota/tela nova:

1. Exibir selo de perfil atual:
   - “Instalador/Vistoriador”
   - “Vistoriador Base”

2. Se estiver em cobertura, destacar:
   - Permanente: Instalador/Vistoriador → Atual: Vistoriador Base = “Em cobertura de Base”
   - Permanente: Vistoriador Base → Atual: Instalador/Vistoriador = “Em cobertura de Rota”

3. Exibir o botão somente para usuários com permissão:
   - `coordenador_monitoramento`
   - `diretor`
   - `admin_master`
   - `desenvolvedor`
   - ou capability equivalente já existente, como `canManageEquipe`, se estiver configurada no banco.

4. Ao clicar, abrir confirmação curta:

```text
Confirmar alternância?
Mover [Nome do técnico] de [Perfil atual] para [Novo perfil]?
```

5. Após confirmar:
   - aplicar cobertura se estiver no perfil permanente;
   - reverter cobertura se já estiver alternado;
   - invalidar queries da equipe, alocações, vistoriadores realtime e serviços para refletir imediatamente.

---

### Mutation / segurança da ação

Implementar a alternância preferencialmente por RPC SQL `alternar_perfil_operacional_tecnico(profissional_id)` com `SECURITY DEFINER`, para garantir:

- validação server-side de permissão;
- validação de que o técnico possui perfil permanente técnico (`instalador_vistoriador` ou `vistoriador_base`);
- alternância simétrica;
- escrita atômica do estado atual e do histórico;
- proteção contra manipulação via frontend.

Fluxo da função:

```text
1. Verifica se auth.uid() é coordenador/diretor/admin/desenvolvedor.
2. Busca profile do técnico.
3. Descobre perfil permanente em user_roles.
4. Se não há cobertura ativa:
   cria cobertura ativa para o outro perfil.
5. Se há cobertura ativa:
   encerra cobertura e volta ao permanente.
6. Registra histórico.
7. Retorna o novo perfil operacional.
```

---

### Integração com o restante do sistema

Atualizar os pontos que hoje usam `user_roles` diretamente para lógica operacional de técnico:

- `src/hooks/useEquipe.ts`
  - passa a exibir o perfil operacional efetivo.

- `src/hooks/useServicosAtribuidos.ts`
  - modo “todos instaladores” deve considerar técnicos cujo perfil operacional atual seja `instalador_vistoriador`, não apenas `user_roles` fixo.

- `src/hooks/useVistoriadoresRealtime.ts`
  - incluir o perfil operacional efetivo para permitir filtrar/ocultar base ou rota corretamente nos mapas.

- `src/components/mapa/MapaVistoriasContent.tsx`
  - manter a lógica existente de `alocacoes_diarias`, mas considerar o perfil operacional efetivo ao decidir quem aparece como equipe de rota/base.

- `src/hooks/useAtribuicaoManual.ts`
  - validar atribuição com base no perfil operacional efetivo quando a decisão depender de rota/base.

- `src/hooks/useAlocacaoDiaria.ts` e `src/hooks/useIniciarServico.ts`
  - manter a lógica diária existente, mas complementar com perfil operacional efetivo para que um técnico em cobertura de base herde regras de base até reversão.

Importante: serviços já atribuídos permanecem como estão. A alteração afeta apenas novas decisões, filtros e validações feitas após o clique.

---

### O que não será feito

- Não recriar os perfis existentes.
- Não alterar o perfil permanente em `user_roles`.
- Não redistribuir serviços, instalações ou vistorias antigas.
- Não criar nova tela, nova rota ou novo menu.
- Não embutir regras de negócio dos perfis no código; o sistema apenas resolverá qual perfil existente está ativo operacionalmente.

---

### Validação

Após implementar:

1. Verificar build TypeScript.
2. Testar na tela **Monitoramento → Equipe**:
   - card de técnico com perfil permanente de rota;
   - alternância para base;
   - selo “Em cobertura de Base”;
   - reversão para rota;
   - técnico permanente base alternando para rota.
3. Confirmar que usuário sem permissão não vê o botão.
4. Confirmar registro em histórico.
5. Confirmar que consultas operacionais passam a usar o perfil efetivo.
