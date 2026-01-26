
# Plano: Corrigir Área de Documentos do Associado

## 🔍 Diagnóstico do Problema

### Problema Identificado
A página de documentos (`/app/documentos`) está mostrando **dados fictícios** (Placa: ABC-0000, Matrícula: 00000000) ao invés dos dados reais do associado Marcus.

### Dados Reais no Banco
✅ **Associado:** MARCUS VINICIUS FAUSTINONI DE FREITAS
✅ **CPF:** 124.936.497-37
✅ **Veículo:** Toyota Corolla XEI Flex 2013
✅ **Placa:** LTB4J74
✅ **Cor:** Azul
✅ **Status:** Ativo
✅ **Contrato:** CTR-20260125121152-J87YYJ (PDF assinado disponível)

### Causa Raiz
Analisando o código em `src/pages/app/AppDocumentos.tsx` (linhas 100-111), o componente usa **fallbacks com dados fictícios**:

```typescript
const carteirinhaData = {
  nome: associado?.nome || 'João da Silva',  // ❌ Fallback fictício
  cpf: associado?.cpf || '123.456.789-00',   // ❌ Fallback fictício
  veiculo: {
    modelo: veiculo?.marca && veiculo?.modelo ? `${veiculo.marca} ${veiculo.modelo}` : 'Gol G5 1.0',  // ❌ Fallback fictício
    placa: veiculo?.placa || 'ABC-1234',  // ❌ Fallback fictício
  },
  // ...
};
```

**O que acontece:**
1. Se `associado` ou `veiculo` são `null`/`undefined`, os fallbacks são usados
2. Isso ocorre quando:
   - O usuário **não está autenticado** (está em `/app/login`)
   - Os hooks `useMyAssociado()` e `useMyVehicles()` ainda estão carregando
   - Há erro de RLS (mas as policies estão corretas)

---

## 🛠️ Soluções a Implementar

### 1. Proteção de Rota (Prevenir Acesso Não Autenticado)

**Problema:** Usuário consegue acessar `/app/documentos` mesmo sem estar logado

**Solução:** Adicionar `AuthGuard` ou verificar autenticação no componente

**Arquivo:** `src/pages/app/AppDocumentos.tsx`

**Modificação (adicionar no início do componente):**
```typescript
export default function AppDocumentos() {
  const navigate = useNavigate();
  const { user } = useAuth(); // Adicionar
  const { data: associado, isLoading: loadingAssociado } = useMyAssociado();
  const { data: veiculos, isLoading: loadingVeiculos } = useMyVehicles();
  
  // Redirecionar para login se não autenticado
  useEffect(() => {
    if (!user && !loadingAssociado) {
      navigate('/app/login');
    }
  }, [user, loadingAssociado, navigate]);
  
  // ...resto do código
}
```

---

### 2. Melhorar Estado de Loading (Evitar Mostrar Fallbacks Durante Carregamento)

**Problema:** Durante o carregamento, os fallbacks aparecem brevemente

**Solução:** Mostrar skeleton/loading até os dados reais carregarem

**Modificação (linhas 192-269):**
```typescript
{/* Carteirinha Digital - Hero */}
<div className="mx-4 mt-4">
  {isLoading || !associado || !veiculo ? (
    <Skeleton className="h-72 w-full rounded-2xl" />
  ) : (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 rounded-2xl p-5 text-white shadow-xl">
      {/* ... conteúdo da carteirinha COM DADOS REAIS */}
      <div className="text-xl font-bold">{associado.nome}</div>
      <div className="text-blue-200 text-sm">CPF: {associado.cpf}</div>
      {/* ... */}
      <div className="font-semibold">{veiculo.marca} {veiculo.modelo}</div>
      <div className="font-semibold font-mono">{veiculo.placa}</div>
      {/* ... */}
    </div>
  )}
</div>
```

---

### 3. Remover Fallbacks Fictícios (Usar Apenas Dados Reais)

**Problema:** Fallbacks fictícios confundem o usuário

**Solução:** Não renderizar carteirinha se não houver dados

**Modificação (linhas 100-111):**
```typescript
// REMOVER objeto carteirinhaData com fallbacks
// USAR DIRETAMENTE associado e veiculo no JSX

// Se não houver dados, mostrar mensagem
{!associado && !isLoading && (
  <div className="text-center p-8">
    <p className="text-muted-foreground">Não foi possível carregar seus dados.</p>
    <Button onClick={() => navigate('/app/home')}>Voltar para Home</Button>
  </div>
)}
```

---

### 4. Buscar Documentos Contratuais Reais (Substituir Mocks)

**Problema:** Documentos contratuais são **hardcoded** (linhas 51-56):

```typescript
const documentosContratuaisMock: DocumentoContratual[] = [
  { id: '1', tipo: 'contrato', nome: 'Proposta de Filiação', subtitulo: 'Assinatura pendente', ... },
  // ...
];
```

**Solução:** Buscar contratos reais do banco com PDFs assinados

**Novo Hook (adicionar em `src/hooks/useMyData.ts`):**
```typescript
export function useMyContratos() {
  const { data: associado } = useMyAssociado();

  return useQuery({
    queryKey: ['my-contratos', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];

      const { data, error } = await supabase
        .from('contratos')
        .select(`
          id,
          numero,
          status,
          pdf_assinado_url,
          data_inicio,
          plano:planos(nome)
        `)
        .eq('associado_id', associado.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!associado?.id,
  });
}
```

**Modificação em `AppDocumentos.tsx`:**
```typescript
const { data: contratos } = useMyContratos(); // Adicionar

// Substituir documentosContratuaisMock por:
const documentosContratuais = contratos?.map(c => ({
  id: c.id,
  tipo: 'contrato',
  nome: `Contrato ${c.numero}`,
  subtitulo: c.status === 'ativo' ? `Assinado em ${new Date(c.data_inicio).toLocaleDateString('pt-BR')}` : 'Assinatura pendente',
  formato: 'PDF',
  url: c.pdf_assinado_url,
  icon: FileText,
  cor: 'blue',
})) || [];
```

---

### 5. Adicionar Logs de Debug (Identificar Problemas de Carregamento)

**Solução:** Adicionar console.logs temporários para debugar

**Modificação:**
```typescript
useEffect(() => {
  console.log('🔍 Debug AppDocumentos:', {
    user: user?.id,
    associado: associado?.id,
    veiculos: veiculos?.length,
    isLoading,
  });
}, [user, associado, veiculos, isLoading]);
```

---

## 📋 Checklist de Implementação

### Prioridade 1 (Crítico)
- [ ] **Proteção de rota:** Redirecionar para `/app/login` se não autenticado
- [ ] **Remover fallbacks fictícios:** Usar apenas dados reais ou mostrar skeleton
- [ ] **Melhorar loading state:** Não renderizar carteirinha até dados carregarem

### Prioridade 2 (Importante)
- [ ] **Buscar contratos reais:** Criar hook `useMyContratos` e substituir mocks
- [ ] **Formatar CPF:** Adicionar máscara no CPF exibido (`formatCPF()`)
- [ ] **Validar dados:** Adicionar verificações de campos obrigatórios

### Prioridade 3 (Melhorias)
- [ ] **Mensagem de erro:** Mostrar mensagem clara se não houver dados
- [ ] **Retry automático:** Retentar carregamento em caso de erro
- [ ] **Adicionar logs:** Temporariamente para debugar em produção

---

## 🧪 Como Testar

### Teste 1: Usuário Não Autenticado
1. Limpar cookies/sessão
2. Acessar `/app/documentos` diretamente
3. ✅ **Esperado:** Redirecionar para `/app/login`

### Teste 2: Usuário Autenticado (Marcus)
1. Login com CPF: `12493649737` e senha
2. Navegar para "Documentos"
3. ✅ **Esperado:** 
   - Nome: MARCUS VINICIUS FAUSTINONI DE FREITAS
   - Placa: LTB4J74
   - Veículo: Toyota Corolla XEI Flex 2013
   - Contrato assinado visível

### Teste 3: Carregamento
1. Abrir DevTools > Network
2. Throttling em "Slow 3G"
3. Acessar documentos
4. ✅ **Esperado:** Skeleton durante carregamento (sem dados fictícios)

---

## 📁 Arquivos a Modificar

| Arquivo | Modificação | Prioridade |
|---------|-------------|------------|
| `src/pages/app/AppDocumentos.tsx` | Adicionar proteção de rota, remover fallbacks, melhorar loading | 🔴 Alta |
| `src/hooks/useMyData.ts` | Criar hook `useMyContratos()` | 🟡 Média |
| `src/pages/app/AppDocumentos.tsx` | Substituir mocks por contratos reais | 🟡 Média |
| `src/utils/format.ts` | Criar função `formatCPF()` (se não existir) | 🟢 Baixa |

---

## 🎯 Resultado Esperado

Após implementação:

| Antes | Depois |
|-------|--------|
| Placa: ABC-0000 | Placa: LTB4J74 |
| Veículo: Não informado | Veículo: Toyota Corolla XEI Flex 2013 |
| Matrícula: 00000000 | Matrícula: 03DD7FE8 |
| Documentos: Mocks | Documentos: Contrato CTR-20260125121152-J87YYJ (PDF real) |

---

## 🔧 Código de Exemplo Completo

### Estrutura do Componente Corrigido

```typescript
export default function AppDocumentos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: associado, isLoading: loadingAssociado } = useMyAssociado();
  const { data: veiculos, isLoading: loadingVeiculos } = useMyVehicles();
  const { data: documentos, isLoading: loadingDocumentos } = useMyDocumentos();
  const { data: contratos } = useMyContratos();

  const veiculo = veiculos?.[0];
  const isLoading = loadingAssociado || loadingVeiculos || loadingDocumentos;

  // Proteção de rota
  useEffect(() => {
    if (!user && !loadingAssociado) {
      navigate('/app/login');
    }
  }, [user, loadingAssociado, navigate]);

  // Não renderizar até ter dados
  if (isLoading) {
    return <div className="p-4"><Skeleton className="h-screen" /></div>;
  }

  if (!associado || !veiculo) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8">
        <p className="text-muted-foreground mb-4">Não foi possível carregar seus dados.</p>
        <Button onClick={() => navigate('/app/home')}>Voltar para Home</Button>
      </div>
    );
  }

  // USAR DADOS REAIS DIRETAMENTE (sem fallbacks)
  return (
    <div className="pb-20">
      {/* Carteirinha com DADOS REAIS */}
      <div className="mx-4 mt-4">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 rounded-2xl p-5 text-white shadow-xl">
          <div className="text-xl font-bold">{associado.nome}</div>
          <div className="text-blue-200 text-sm">CPF: {formatCPF(associado.cpf)}</div>
          
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-blue-200">Veículo</div>
                <div className="font-semibold">{veiculo.marca} {veiculo.modelo}</div>
              </div>
              <div>
                <div className="text-xs text-blue-200">Placa</div>
                <div className="font-semibold font-mono">{veiculo.placa}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentos REAIS */}
      {contratos && contratos.length > 0 && (
        <div className="p-4">
          <h3 className="font-semibold mb-3">Documentos Contratuais</h3>
          {contratos.map(contrato => (
            <div key={contrato.id} className="flex items-center gap-4 p-4 bg-card rounded-lg">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium">{contrato.numero}</p>
                <p className="text-sm text-muted-foreground">
                  {contrato.status === 'ativo' ? 'Assinado' : 'Pendente'}
                </p>
              </div>
              {contrato.pdf_assinado_url && (
                <Button 
                  size="sm" 
                  onClick={() => window.open(contrato.pdf_assinado_url, '_blank')}
                >
                  Visualizar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```
