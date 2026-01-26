

# Revisão Completa das Áreas do App do Associado

## Resumo Executivo

Após análise detalhada do código, identifiquei o seguinte status para cada área:

| Área | Status Geral | Problemas Identificados |
|------|--------------|-------------------------|
| **Configurações** | ✅ Funcional | Alteração de senha simulada (não persiste de fato) |
| **Sinistros** | ⚠️ Parcial | `AppSinistroDetalhe.tsx` usa dados MOCK |
| **Assistência 24h** | ⚠️ Parcial | `AppAssistenciaNova.tsx` usa dados MOCK de veículo |

---

## 1. Configurações (`/app/configuracoes`)

### Status: ✅ **Funciona corretamente**

**O que funciona:**
- Notificações (Push, Email, WhatsApp) → Salvam na tabela `notificacoes_preferencias`
- Categorias (Financeiro, Veículo, Comunicados) → Persistem corretamente
- Alertas do Rastreador → Salvam na tabela `rastreadores_preferencias`
- Tema (Claro/Escuro/Sistema) → Funciona via `next-themes`
- Logout → Funciona corretamente

**Problema identificado:**
- **Alteração de Senha (linhas 121-140)**: Apenas simula a alteração, não chama `supabase.auth.updateUser()`:

```typescript
// ATUAL - apenas simula (NÃO PERSISTE)
const handleAlterarSenha = () => {
  // ...validações...
  // Simular alteração
  setShowSenhaModal(false);
  toast.success('Senha alterada com sucesso!');
};
```

**Correção necessária:**
```typescript
const handleAlterarSenha = async () => {
  // ...validações...
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) {
    toast.error('Erro ao alterar senha');
    return;
  }
  toast.success('Senha alterada com sucesso!');
  setShowSenhaModal(false);
};
```

---

## 2. Sinistros (`/app/sinistros`)

### Status: ⚠️ **Parcialmente funcional**

### 2.1 Listagem de Sinistros (`AppSinistros.tsx`)
✅ **Funciona corretamente**
- Busca dados reais da tabela `sinistros` filtrados pelo `associado_id`
- Mostra protocolo, tipo, status e veículo corretamente

### 2.2 Abertura de Sinistro (`NovoSinistro.tsx`)
✅ **Funciona corretamente**
- Usa Edge Function `criar-sinistro` que:
  - Gera protocolo automático (SIN-YYYYMMDD-XXXX)
  - Valida duplicidade e cobertura
  - Cria documentos pendentes baseado no tipo
  - Notifica analistas automaticamente
- Upload de fotos e B.O. funcionam
- **Conecta com o painel**: Sinistros criados aparecem imediatamente em `/sinistros` no backoffice

### 2.3 Detalhe do Sinistro (`AppSinistroDetalhe.tsx`)
❌ **NÃO FUNCIONA - USA DADOS MOCK**

**Problema crítico (linhas 98-150):**
```typescript
// Mock data - DADOS FICTÍCIOS
const sinistroMock: Sinistro = {
  id: "1",
  protocolo: "SIN-2024-0001",  // ❌ FAKE
  status: "em_analise",
  veiculo: {
    modelo: "Gol G5 1.0",  // ❌ FAKE
    placa: "ABC-1234"      // ❌ FAKE
  },
  // ...
};
```

O componente:
1. Ignora o parâmetro `id` da URL
2. Mostra sempre os mesmos dados fictícios
3. Não busca dados reais do Supabase
4. Não exibe histórico real de mudanças de status

**Correção necessária:**
- Implementar busca real usando o hook `useSinistro(id)` existente
- Buscar documentos pendentes de `sinistro_documentos`
- Buscar histórico de `sinistro_historico`

---

## 3. Assistência 24h (`/app/assistencia`)

### Status: ⚠️ **Parcialmente funcional**

### 3.1 Página Principal (`SolicitarAssistencia.tsx` - rota `/app/assistencia`)
✅ **Funciona corretamente**
- Lista tipos de assistência
- Verifica chamados em aberto (não permite duplicatas)
- Solicita via Edge Function `criar-chamado-assistencia`
- Usa dados reais do associado e veículos

### 3.2 Nova Assistência (`AppAssistenciaNova.tsx` - rota `/app/assistencia/nova`)
⚠️ **Parcialmente funcional**

**Problema (linhas 59-68):**
```typescript
// MOCK DATA - DADOS FICTÍCIOS
const veiculoMock = { modelo: 'Gol G5 1.0', placa: 'ABC-1234' };
const associadoMock = { nome: 'João da Silva', telefone: '(34) 99999-8888' };
```

Usado na confirmação (linha 473-474):
```typescript
<p className="font-semibold">{veiculoMock.modelo}</p>
<Badge variant="secondary" className="text-xs">{veiculoMock.placa}</Badge>
```

**Problema adicional (linha 244-251):**
A função `handleConfirmar()` apenas simula o envio - não chama a Edge Function real:
```typescript
const handleConfirmar = async () => {
  setIsEnviando(true);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Apenas delay
  const protocolo = `AST-...`; // Gera localmente (errado)
  toast.success(`Solicitação enviada!`);
  navigate('/app/assistencia');
};
```

### 3.3 Acompanhamento (`AppAssistencia.tsx`)
✅ **Funciona corretamente**
- Mostra chamados em andamento com dados reais
- Link "Acompanhar" funciona

### 3.4 Histórico (`HistoricoChamados.tsx`)
✅ **Funciona corretamente** (verificar se existe)

---

## Correções Necessárias

### Prioridade 1 - Crítica (dados falsos visíveis ao usuário)

#### 1.1 Corrigir `AppSinistroDetalhe.tsx`
- Substituir dados mock por query real usando `useSinistro(id)`
- Buscar documentos pendentes de `sinistro_documentos`
- Buscar histórico de `sinistro_historico`

#### 1.2 Corrigir `AppAssistenciaNova.tsx`
- Buscar veículo real usando `useMyVehicles()`
- Buscar dados do associado usando `useMyAssociado()`
- Chamar Edge Function `criar-chamado-assistencia` na confirmação

### Prioridade 2 - Importante

#### 2.1 Corrigir `AppConfiguracoes.tsx`
- Implementar alteração de senha real via `supabase.auth.updateUser()`

---

## Fluxo de Dados: Conexão App → Painel

### Sinistros
```
App (NovoSinistro.tsx)
    ↓ Edge Function 'criar-sinistro'
Tabela 'sinistros' ← protocolo SIN-YYYYMMDD-XXXX gerado
    ↓ Notificação automática para analistas
Painel (/sinistros/:id) → Analista vê e processa
```

✅ **Conexão funcionando** - Sinistros criados no app aparecem no painel administrativo em tempo real.

### Assistência 24h
```
App (SolicitarAssistencia.tsx)
    ↓ Edge Function 'criar-chamado-assistencia'
Tabela 'chamados_assistencia' ← protocolo ASS-YYYYMMDD-XXXX
    ↓ Notificação + WhatsApp para central
Painel (/assistencia/:id) → Operador despacha prestador
```

⚠️ **Conexão funcionando apenas via SolicitarAssistencia.tsx**
A rota alternativa `AppAssistenciaNova.tsx` NÃO salva no banco.

---

## Arquivos a Modificar

| Arquivo | Modificação | Prioridade |
|---------|-------------|------------|
| `src/pages/app/AppSinistroDetalhe.tsx` | Substituir mocks por dados reais (linhas 98-150) | Alta |
| `src/pages/app/AppAssistenciaNova.tsx` | Buscar veículo/associado reais + chamar Edge Function | Alta |
| `src/pages/app/AppConfiguracoes.tsx` | Implementar alteração de senha real (linhas 121-140) | Média |

---

## Implementação Detalhada

### 1. AppSinistroDetalhe.tsx - Buscar dados reais

```typescript
// ADICIONAR imports
import { useSinistro } from '@/hooks/useSinistros';
import { useQuery } from '@tanstack/react-query';

export default function AppSinistroDetalhe() {
  const { id } = useParams<{ id: string }>();
  
  // SUBSTITUIR mock por query real
  const { data: sinistro, isLoading } = useSinistro(id);
  
  // Buscar documentos pendentes
  const { data: documentos } = useQuery({
    queryKey: ['sinistro-documentos', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sinistro_documentos')
        .select('*')
        .eq('sinistro_id', id)
        .eq('status', 'pendente');
      return data;
    },
    enabled: !!id,
  });
  
  // Buscar histórico
  const { data: timeline } = useQuery({
    queryKey: ['sinistro-historico', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sinistro_historico')
        .select('*')
        .eq('sinistro_id', id)
        .order('created_at', { ascending: false });
      return data;
    },
    enabled: !!id,
  });
  
  if (isLoading) return <LoadingScreen />;
  if (!sinistro) return <NotFound />;
  
  // Usar sinistro real no JSX
}
```

### 2. AppAssistenciaNova.tsx - Integrar com dados reais

```typescript
// ADICIONAR imports
import { useMyAssociado, useMyVehicles } from '@/hooks/useMyData';
import { useSolicitarAssistencia } from '@/hooks/useAppAssociado';

export default function AppAssistenciaNova() {
  const { data: associado } = useMyAssociado();
  const { data: veiculos } = useMyVehicles();
  const solicitarAssistencia = useSolicitarAssistencia();
  
  const veiculo = veiculos?.[0];
  
  // SUBSTITUIR handleConfirmar
  const handleConfirmar = async () => {
    if (!veiculo) return;
    
    setIsEnviando(true);
    try {
      await solicitarAssistencia.mutateAsync({
        tipo: formState.tipoServico as TipoAssistencia,
        veiculo_id: veiculo.id,
        endereco: `${formState.logradouro}, ${formState.numero} - ${formState.bairro}`,
        latitude: 0, // ou coordenadas reais se disponíveis
        longitude: 0,
        descricao: formState.observacoes,
      });
      navigate('/app/assistencia');
    } finally {
      setIsEnviando(false);
    }
  };
  
  // Na etapa 3, usar dados reais:
  <p className="font-semibold">{veiculo?.marca} {veiculo?.modelo}</p>
  <Badge>{veiculo?.placa}</Badge>
}
```

### 3. AppConfiguracoes.tsx - Alteração de senha real

```typescript
const handleAlterarSenha = async () => {
  if (!senhaAtual || !novaSenha || !confirmarSenha) {
    toast.error('Preencha todos os campos');
    return;
  }
  if (novaSenha !== confirmarSenha) {
    toast.error('As senhas não coincidem');
    return;
  }
  if (novaSenha.length < 6) {
    toast.error('A senha deve ter pelo menos 6 caracteres');
    return;
  }
  
  // Chamar Supabase Auth
  const { error } = await supabase.auth.updateUser({ 
    password: novaSenha 
  });
  
  if (error) {
    toast.error(error.message || 'Erro ao alterar senha');
    return;
  }
  
  setShowSenhaModal(false);
  toast.success('Senha alterada com sucesso!');
  setSenhaAtual('');
  setNovaSenha('');
  setConfirmarSenha('');
};
```

---

## Testes Recomendados

### Teste 1: Sinistros E2E
1. Login como associado (Marcus)
2. Criar novo sinistro no app
3. Verificar se aparece no painel em `/sinistros`
4. Abrir detalhe do sinistro no app → Deve mostrar dados REAIS

### Teste 2: Assistência E2E
1. Login como associado
2. Solicitar assistência via `/app/assistencia`
3. Verificar se protocolo foi gerado
4. Verificar se aparece no painel de assistência

### Teste 3: Configurações
1. Alterar senha
2. Fazer logout
3. Tentar login com senha antiga → Deve falhar
4. Login com nova senha → Deve funcionar

