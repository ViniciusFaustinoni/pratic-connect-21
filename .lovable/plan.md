
## Diagnóstico (por que não aparece)

Na rota **/configuracoes/usuarios/novo** a lista de “Perfis de Acesso” não é gerada a partir de `PERFIS_FUNCIONARIO` (do modal NovoFuncionarioModal). Ela é uma lista fixa (`perfisDisponiveis`) dentro de:

- **`src/pages/configuracoes/UsuarioForm.tsx`** (linhas ~17–29)

Esse array ainda **não contém** `vistoriador_base`, então a UI nunca vai renderizar essa opção — mesmo que o enum/labels já existam no sistema.

Além disso, encontrei outra lista fixa de perfis (para gerenciar perfis) que também precisa incluir o novo role:

- **`src/components/usuarios/GerenciarPerfisModal.tsx`**: `PERFIS_FUNCIONARIO` está sem `vistoriador_base` (apesar de já existir cor de badge para ele).

Opcionalmente (dependendo do seu uso), existe outra lista fixa para importação em massa que também não inclui `vistoriador_base`:

- **`src/components/usuarios/ImportarUsuariosDialog.tsx`**: `perfisDisponiveis` não inclui `vistoriador_base` (isso não afeta diretamente a tela /configuracoes/usuarios/novo, mas afeta importações).

---

## Objetivo da correção

1) Fazer **aparecer “Vistoriador Base”** na criação de usuário em **/configuracoes/usuarios/novo**.  
2) Garantir que ele também apareça nas telas de **gerenciar perfis** (para adicionar/remover perfis de um usuário).  
3) (Opcional) Permitir selecionar `vistoriador_base` na **importação** de usuários.

---

## Implementação (mudanças planejadas)

### 1) Adicionar “Vistoriador Base” na tela /configuracoes/usuarios/novo

**Arquivo:** `src/pages/configuracoes/UsuarioForm.tsx`  
**Mudança:** inserir `vistoriador_base` no array `perfisDisponiveis`, logo após `instalador_vistoriador` para manter ordem lógica.

Exemplo:

```ts
const perfisDisponiveis = [
  { value: 'diretor', label: 'Diretor', desc: 'Acesso total ao sistema' },
  { value: 'gerente_comercial', label: 'Gerente Comercial', desc: 'Vendas, relatórios e equipe' },
  { value: 'supervisor_vendas', label: 'Supervisor de Vendas', desc: 'Vendas da equipe' },
  { value: 'vendedor_clt', label: 'Vendedor CLT', desc: 'Vendas próprias' },
  { value: 'vendedor_externo', label: 'Vendedor Externo', desc: 'Vendas próprias' },
  { value: 'analista_cadastro', label: 'Analista de Cadastro', desc: 'Documentos e associados' },
  { value: 'coordenador_monitoramento', label: 'Coord. Monitoramento', desc: 'Instalações e rotas' },
  { value: 'analista_plataforma', label: 'Analista de Plataforma', desc: 'Rastreadores' },
  { value: 'instalador_vistoriador', label: 'Instalador/Vistoriador', desc: 'App instalador' },

  // NOVO:
  { value: 'vistoriador_base', label: 'Vistoriador Base', desc: 'Vistorias agendadas na base' },

  { value: 'analista_marketing', label: 'Analista de Marketing', desc: 'Campanhas e leads' },
  { value: 'analista_juridico', label: 'Analista Jurídico', desc: 'Processos e contratos' },
];
```

**Resultado esperado:** o card/checkbox “Vistoriador Base” aparecerá imediatamente na lista de perfis no formulário.

---

### 2) Permitir adicionar “Vistoriador Base” no modal de Gerenciar Perfis

**Arquivo:** `src/components/usuarios/GerenciarPerfisModal.tsx`  
**Mudança:** incluir `vistoriador_base` no `PERFIS_FUNCIONARIO`.

Hoje está assim:

```ts
const PERFIS_FUNCIONARIO: PerfilAcesso[] = [
  'diretor',
  'gerente_comercial',
  'supervisor_vendas',
  'vendedor_clt',
  'vendedor_externo',
  'analista_cadastro',
  'coordenador_monitoramento',
  'analista_plataforma',
  'instalador_vistoriador',
  'analista_marketing',
  'analista_juridico',
];
```

Vai ficar:

```ts
const PERFIS_FUNCIONARIO: PerfilAcesso[] = [
  'diretor',
  'gerente_comercial',
  'supervisor_vendas',
  'vendedor_clt',
  'vendedor_externo',
  'analista_cadastro',
  'coordenador_monitoramento',
  'analista_plataforma',
  'instalador_vistoriador',
  'vistoriador_base', // NOVO
  'analista_marketing',
  'analista_juridico',
];
```

**Resultado esperado:** ao abrir “Gerenciar Perfis”, o perfil “Vistoriador Base” aparecerá como opção disponível para atribuição.

---

### 3) (Opcional) Incluir “Vistoriador Base” na importação de usuários

**Arquivo:** `src/components/usuarios/ImportarUsuariosDialog.tsx`  
**Mudança:** adicionar um item ao `perfisDisponiveis`.

Exemplo:

```ts
const perfisDisponiveis = [
  { value: 'vendedor_clt', label: 'Vendedor CLT', shortLabel: 'CLT' },
  { value: 'vendedor_externo', label: 'Vendedor Externo', shortLabel: 'EXT' },
  { value: 'agencia', label: 'Agência', shortLabel: 'AGE' },
  { value: 'analista_cadastro', label: 'Analista Cadastro', shortLabel: 'CAD' },
  { value: 'instalador_vistoriador', label: 'Instalador/Vistoriador', shortLabel: 'INS' },
  { value: 'vistoriador_base', label: 'Vistoriador Base', shortLabel: 'VB' }, // NOVO
  { value: 'analista_marketing', label: 'Analista Marketing', shortLabel: 'MKT' },
];
```

**Observação:** isso não é necessário para “aparecer no /configuracoes/usuarios/novo”, mas evita inconsistência no sistema.

---

## Validação (como vamos testar)

1) Abrir **/configuracoes/usuarios/novo** e verificar que o card “Vistoriador Base” aparece em “Perfis de Acesso”.  
2) Criar um usuário selecionando esse perfil e confirmar que:
   - o usuário é criado com role `vistoriador_base` na tabela `user_roles`;
   - o login com esse usuário direciona para o app do vistoriador (mas sem mapa), conforme as regras já implementadas.  
3) Abrir um usuário existente e testar **Gerenciar Perfis**:
   - “Vistoriador Base” deve aparecer como perfil disponível para adicionar (quando não atribuído).  
4) (Se aplicarmos a etapa opcional) testar o fluxo de **Importar Usuários** selecionando “Vistoriador Base”.

---

## Arquivos que serão modificados

- `src/pages/configuracoes/UsuarioForm.tsx` (obrigatório)
- `src/components/usuarios/GerenciarPerfisModal.tsx` (obrigatório)
- `src/components/usuarios/ImportarUsuariosDialog.tsx` (opcional, recomendado para consistência)

---

## Risco/causa raiz e prevenção

Causa raiz: perfis estão duplicados em múltiplas listas fixas no front-end.  
Como melhoria futura (não incluída nesta correção): centralizar os perfis (e descrições) em um único arquivo (ex.: `src/constants/perfis.ts`) para evitar esse mesmo problema quando novos perfis forem adicionados.
