
# Revisao Completa - Fluxo de Atualizacao de Dados do Cliente na Rede Veiculos

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint POST /atualizarDadosCliente | **NAO EXISTE** | Nao ha edge function para atualizacao de dados |
| Atualizacao quando associado edita no App | **NAO IMPLEMENTADO** | Apenas atualiza banco local |
| Atualizacao quando atendimento corrige dados | **NAO IMPLEMENTADO** | Apenas atualiza banco local |
| Atualizacao quando associado muda endereco | **NAO IMPLEMENTADO** | Apenas atualiza banco local |
| Atualizacao de permissoes (alertas, acesso web) | **NAO IMPLEMENTADO** | Permissoes fixas na vinculacao |
| Envio apenas de campos alterados | **NAO** | Nenhuma integracao ativa |
| CPF/CNPJ como identificador imutavel | **NAO** | Nenhuma integracao ativa |
| Sincronizacao imediata com plataforma | **NAO** | Dados ficam dessincronizados |

---

## Analise Detalhada

### 1. Estado Atual - Nenhuma Integracao de Atualizacao

A plataforma Rede Veiculos possui apenas dois endpoints implementados para gestao de clientes:

| Endpoint | Edge Function | Status |
|----------|---------------|--------|
| POST /vincularClienteVeiculo | `rede-veiculos-vincular-cliente` | Implementado |
| POST /desvincularClienteVeiculo | `rede-veiculos-desvincular-cliente` | Implementado |
| POST /atualizarDadosCliente | **NAO EXISTE** | **Gap critico** |

### 2. Cenarios Onde Deveria Chamar /atualizarDadosCliente

#### 2.1 Quando o Associado Atualiza Dados no App

**Arquivo:** `src/pages/app/AppPerfil.tsx` (linhas 686-743)

O modal `ModalEditarDadosPessoais` permite ao associado alterar:
- Nome
- Email
- Telefone
- WhatsApp
- Data de Nascimento

```typescript
// AppPerfil.tsx - linha 727-735
const handleSalvar = async () => {
  await onSave({ 
    nome, 
    email, 
    telefone, 
    whatsapp,
    data_nascimento: dataNascimento ? format(dataNascimento, 'yyyy-MM-dd') : null
  });
  // APENAS atualiza banco local via useUpdateAssociado
  // NAO notifica plataforma Rede Veiculos
};
```

**Hook utilizado:** `src/hooks/useMyData.ts` (linhas 492-510)

```typescript
export function useUpdateAssociado() {
  return useMutation({
    mutationFn: async (data: Partial<Associado>) => {
      // APENAS atualiza Supabase local
      await supabase.from('associados').update(data).eq('user_id', user.id);
      // NAO chama API Rede Veiculos
    },
  });
}
```

**Gap:** Associado pode atualizar telefone no app, mas na Rede Veiculos permanece o telefone antigo.

#### 2.2 Quando o Atendimento Corrige Dados

**Arquivo:** `src/components/associados/AssociadoEditDialog.tsx` (linhas 154-191)

O atendente pode editar todos os campos do associado pelo painel administrativo:

```typescript
const handleSubmit = async (data: FormData) => {
  await updateAssociado.mutateAsync({
    id: associado.id,
    ...data,  // Todos os campos
  });
  // APENAS atualiza banco local
  // NAO sincroniza com Rede Veiculos
};
```

**Hook utilizado:** `src/hooks/useAssociados.ts` (linhas 712-732)

```typescript
export function useUpdateAssociado() {
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      await supabase.from('associados').update(updates).eq('id', id);
      // NAO chama API externa
    },
  });
}
```

#### 2.3 Quando o Associado Muda de Endereco

**Arquivo:** `src/pages/app/AppPerfil.tsx` (possui modal de endereco)

O associado pode atualizar endereco pelo app, mas a alteracao nao e propagada para a plataforma Rede Veiculos.

#### 2.4 Quando Ha Alteracao nas Permissoes

**Estado atual das permissoes:**

Na vinculacao (`rede-veiculos-vincular-cliente`), as permissoes sao enviadas **hardcoded**:

```typescript
// rede-veiculos-vincular-cliente/index.ts - linhas 273-279
permissoes: {
  acessoWeb: true,        // Fixo
  pushNotifications: true, // Fixo
  alertaVelocidade: true,  // Fixo
  alertaCercaVirtual: true,// Fixo
  alertaIgnicao: true,     // Fixo
},
```

**Nao existe:**
- Tela para o associado configurar preferencias de alertas
- Tela para o atendente alterar permissoes
- Endpoint para atualizar permissoes na Rede Veiculos

---

## Campos de Permissoes no Banco Local

A tabela `veiculos` possui campos para alertas que **NAO estao sendo usados**:

| Campo | Tipo | Uso Atual |
|-------|------|-----------|
| `alerta_velocidade_ativo` | boolean | Nao utilizado na integracao |
| `alerta_cerca_ativo` | boolean | Nao utilizado na integracao |
| `alerta_ignicao_ativo` | boolean | Nao utilizado na integracao |
| `rede_veiculos_cliente_id` | varchar | ID do cliente na plataforma |
| `rede_veiculos_veiculo_id` | varchar | ID do veiculo na plataforma |

---

## Impactos dos Gaps

### Impacto 1: Dados Dessincronizados

Quando um associado atualiza o telefone no app:
- Banco local: telefone atualizado
- Rede Veiculos: telefone antigo
- Consequencia: Central de monitoramento tem contato errado

### Impacto 2: Email de Recuperacao Incorreto

Se o associado mudar o email no sistema:
- Associado nao consegue acessar portal Rede Veiculos
- Notificacoes da plataforma vao para email errado

### Impacto 3: Endereco para Atendimento Errado

Quando o associado muda de endereco:
- Guincho/assistencia podem ir para endereco antigo
- Analise de cercas virtuais fica incorreta

### Impacto 4: Permissoes Nao Configuráveis

Associado nao pode:
- Desativar alertas indesejados
- Configurar limite de velocidade personalizado
- Gerenciar notificacoes push

---

## Plano de Implementacao

### Fase 1: Criar Edge Function rede-veiculos-atualizar-cliente

**Novo arquivo:** `supabase/functions/rede-veiculos-atualizar-cliente/index.ts`

```typescript
interface RequestBody {
  associadoId: string;
  camposAlterados: {
    nome?: string;
    email?: string;
    celular?: string;
    endereco?: {
      cep?: string;
      logradouro?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
    };
    permissoes?: {
      acessoWeb?: boolean;
      pushNotifications?: boolean;
      alertaVelocidade?: boolean;
      alertaCercaVirtual?: boolean;
      alertaIgnicao?: boolean;
    };
  };
}

// Fluxo:
// 1. Buscar associado e veiculos com rastreador Rede Veiculos
// 2. Validar que ha vinculo ativo (rede_veiculos_cliente_id)
// 3. Montar payload apenas com campos alterados
// 4. Usar CPF/CNPJ como identificador (nao pode ser alterado)
// 5. Chamar POST /atualizarDadosCliente na API Rede Veiculos
// 6. Registrar log de atualizacao
```

**Payload esperado para API:**
```json
{
  "cpfCnpj": "12345678901",
  "camposAlterados": {
    "celular": "21999998888",
    "email": "novo@email.com"
  }
}
```

### Fase 2: Integrar nos Hooks de Atualizacao

#### 2.1 No App do Associado

**Modificar:** `src/hooks/useMyData.ts`

```typescript
export function useUpdateAssociado() {
  return useMutation({
    mutationFn: async (data: Partial<Associado>) => {
      // 1. Atualizar banco local
      await supabase.from('associados').update(data).eq('user_id', user.id);
      
      // 2. Verificar se associado tem veiculo com rastreador Rede Veiculos
      const { data: associado } = await supabase
        .from('associados')
        .select('id, veiculos(rede_veiculos_cliente_id)')
        .eq('user_id', user.id)
        .single();
      
      const temRedeVeiculos = associado?.veiculos?.some(v => v.rede_veiculos_cliente_id);
      
      // 3. Se tem, sincronizar com plataforma
      if (temRedeVeiculos) {
        await supabase.functions.invoke('rede-veiculos-atualizar-cliente', {
          body: {
            associadoId: associado.id,
            camposAlterados: data,
          },
        });
      }
    },
  });
}
```

#### 2.2 No Painel Administrativo

**Modificar:** `src/hooks/useAssociados.ts`

```typescript
export function useUpdateAssociado() {
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      // 1. Atualizar banco local
      await supabase.from('associados').update(updates).eq('id', id);
      
      // 2. Verificar se tem vinculo Rede Veiculos
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('rede_veiculos_cliente_id')
        .eq('associado_id', id);
      
      const temRedeVeiculos = veiculos?.some(v => v.rede_veiculos_cliente_id);
      
      // 3. Se tem, sincronizar
      if (temRedeVeiculos) {
        await supabase.functions.invoke('rede-veiculos-atualizar-cliente', {
          body: { associadoId: id, camposAlterados: updates },
        });
      }
    },
  });
}
```

### Fase 3: Criar Tela de Configuracao de Alertas

**Novo arquivo:** `src/components/app/ConfiguracaoAlertasCard.tsx`

Card no app do associado para configurar:
- Ativar/desativar alertas de velocidade
- Ativar/desativar alertas de cerca virtual
- Ativar/desativar alertas de ignicao
- Ativar/desativar notificacoes push
- Definir limite de velocidade personalizado

**Novo arquivo:** `src/hooks/useAtualizarPermissoesRastreador.ts`

```typescript
export function useAtualizarPermissoesRastreador() {
  return useMutation({
    mutationFn: async ({ veiculoId, permissoes }) => {
      // 1. Atualizar campos locais na tabela veiculos
      await supabase.from('veiculos').update({
        alerta_velocidade_ativo: permissoes.alertaVelocidade,
        alerta_cerca_ativo: permissoes.alertaCercaVirtual,
        alerta_ignicao_ativo: permissoes.alertaIgnicao,
      }).eq('id', veiculoId);
      
      // 2. Sincronizar com Rede Veiculos
      await supabase.functions.invoke('rede-veiculos-atualizar-cliente', {
        body: {
          veiculoId,
          camposAlterados: { permissoes },
        },
      });
    },
  });
}
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/rede-veiculos-atualizar-cliente/index.ts` | Edge Function principal |
| `src/hooks/useAtualizarPermissoesRastreador.ts` | Hook para permissoes |
| `src/components/app/ConfiguracaoAlertasCard.tsx` | Card de configuracao |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/hooks/useMyData.ts` | Integrar sincronizacao apos update |
| `src/hooks/useAssociados.ts` | Integrar sincronizacao apos update |
| `src/pages/app/AppPerfil.tsx` | Adicionar card de alertas |
| `supabase/config.toml` | Registrar nova edge function |

---

## Payload Esperado para POST /atualizarDadosCliente

Baseado no padrao da API de vinculacao:

```typescript
interface AtualizarDadosClienteRequest {
  // Identificador (obrigatorio, imutavel)
  cpfCnpj: string;
  
  // Campos alterados (apenas os que mudaram)
  camposAlterados: {
    nome?: string;
    email?: string;
    celular?: string;
    
    endereco?: {
      cep?: string;
      logradouro?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
    };
    
    permissoes?: {
      acessoWeb?: boolean;
      pushNotifications?: boolean;
      alertaVelocidade?: boolean;
      alertaCercaVirtual?: boolean;
      alertaIgnicao?: boolean;
    };
  };
}
```

---

## Checklist de Verificacao Pos-Implementacao

- [ ] Edge function `rede-veiculos-atualizar-cliente` criada
- [ ] Ao atualizar dados no App, plataforma e sincronizada
- [ ] Ao atualizar dados pelo painel, plataforma e sincronizada
- [ ] Ao mudar endereco, plataforma e atualizada
- [ ] Apenas campos alterados sao enviados (nao cadastro completo)
- [ ] CPF/CNPJ e usado como identificador imutavel
- [ ] Permissoes podem ser alteradas pelo associado
- [ ] Campos locais de alerta funcionam (alerta_velocidade_ativo, etc)
- [ ] Atualizacao reflete imediatamente na Rede Veiculos
- [ ] Log de atualizacao registrado em `rastreadores_api_logs`

---

## Teste Recomendado: Atualizacao de Telefone

### Pre-requisitos

1. Associado ativo com veiculo e rastreador Rede Veiculos instalado
2. `REDE_VEICULOS_TOKEN` valido e configurado
3. Acesso ao painel da Rede Veiculos para verificar

### Passos do Teste

1. **Login como associado no App** (`/app/login`)
2. **Acessar Perfil** (`/app/perfil`)
3. **Clicar em "Editar" nos Dados Pessoais**
4. **Alterar apenas o telefone** para um novo numero
5. **Salvar**
6. **Verificar no banco:**
   - `associados.telefone` atualizado
   - `rastreadores_api_logs` com registro de atualizacao
7. **Verificar na plataforma Rede Veiculos:**
   - Cliente com telefone atualizado
   - Outros dados inalterados

### Resultado Esperado

- Telefone atualizado no SGA e na Rede Veiculos simultaneamente
- Apenas campo `celular` enviado para API (nao cadastro completo)
- Log de auditoria registrado

---

## Consideracoes Finais

**IMPORTANTE:** Antes de implementar, e necessario confirmar com a documentacao da API Rede Veiculos:

1. **URL exata do endpoint:** `POST /atualizarDadosCliente` ou similar
2. **Formato do payload:** Aceita campos parciais ou exige cadastro completo?
3. **Campo identificador:** CPF/CNPJ ou ID interno da plataforma?
4. **Restricoes:** Quais campos podem ser alterados via API?
5. **Permissoes:** Endpoint de permissoes e separado ou junto com dados do cliente?

**Recomendacao:** Solicitar documentacao oficial da API Rede Veiculos antes de iniciar a implementacao.
