
# Plano de Revisao Completa: Ouvidoria

## Diagnostico Atual

### Status do Banco de Dados
| Tabela | Registros |
|--------|-----------|
| ouvidoria_manifestacoes | 0 |
| ouvidoria_interacoes | 0 |
| ouvidoria_ia_logs | 0 |
| ouvidoria_anexos | 0 |

### O que esta funcionando corretamente
- **useOuvidoria.ts**: Hooks CRUD completos com queries reais do Supabase
- **useOuvidoriaInteracoes.ts**: Hooks para interacoes, logs de IA e anexos
- **ManifestacaoDetalhe.tsx**: Visualizacao, responder, alterar status, encaminhar para juridico (usando hooks reais)
- **StatusBadge, PrioridadeBadge, TipoBadge**: Componentes de visualizacao
- **InteracaoTimeline**: Timeline de interacoes funcional

### Problemas Identificados

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 1 | Importa e usa `mockEstatisticas` para "Elogios do Mes" | OuvidoriaDashboard.tsx | Dados mock exibidos |
| 2 | Counts das tabs sao hardcoded (minhas: 12, sem_responsavel: 8, atrasadas: 3) | ManifestacoesList.tsx | Contagem fake |
| 3 | `handleAssumir()` so exibe toast, nao persiste | ManifestacoesList.tsx | Botao nao funciona |
| 4 | `handleMarcarUrgente()` so exibe toast, nao persiste | ManifestacoesList.tsx | Botao nao funciona |
| 5 | Formulario de nova manifestacao simula envio, nao persiste | NovaManifestacao.tsx | Dados nao salvos |
| 6 | Modal usa `mockAssociados` e nao persiste | NovaManifestacaoModal.tsx | Busca fake, dados nao salvos |
| 7 | Usa analistas e departamentos mock, nao persiste | EncaminharModal.tsx | Dados fake, nao salva |
| 8 | Botao "Encaminhar para Setor + RH" so exibe toast | ManifestacaoDetalhe.tsx | Nao funciona |
| 9 | Faltam colunas de elogio na tabela | Banco de dados | Erro ao salvar elogios |

---

## Alteracoes Necessarias no Banco de Dados

### Adicionar colunas faltantes em ouvidoria_manifestacoes

```sql
ALTER TABLE ouvidoria_manifestacoes
ADD COLUMN IF NOT EXISTS setor_elogio VARCHAR(50),
ADD COLUMN IF NOT EXISTS colaborador_elogiado VARCHAR(255),
ADD COLUMN IF NOT EXISTS data_atendimento DATE,
ADD COLUMN IF NOT EXISTS data_contato TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS registrado_por_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS registrado_por_nome VARCHAR(255),
ADD COLUMN IF NOT EXISTS observacao_interna TEXT;
```

### Criar trigger para gerar protocolo automaticamente

```sql
CREATE OR REPLACE FUNCTION generate_ouvidoria_protocolo()
RETURNS TRIGGER AS $$
BEGIN
  NEW.protocolo := 'OUV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || 
                   LPAD((SELECT COALESCE(MAX(CAST(SUBSTRING(protocolo FROM 10) AS INTEGER)), 0) + 1 
                         FROM ouvidoria_manifestacoes 
                         WHERE protocolo LIKE 'OUV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_ouvidoria_protocolo
BEFORE INSERT ON ouvidoria_manifestacoes
FOR EACH ROW
WHEN (NEW.protocolo IS NULL OR NEW.protocolo = '')
EXECUTE FUNCTION generate_ouvidoria_protocolo();
```

---

## Correcoes de Codigo

### 1. OuvidoriaDashboard.tsx - Remover mockEstatisticas

**Problema**: Importa `mockEstatisticas` e usa para exibir "Elogios do Mes"

**Solucao**: Criar hook `useEstatisticasElogios` que busca dados reais do banco

```typescript
// Novo hook em useOuvidoria.ts
export function useEstatisticasElogios() {
  return useQuery({
    queryKey: ["ouvidoria", "elogios-stats"],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("ouvidoria_manifestacoes")
        .select("setor_elogio, colaborador_elogiado")
        .eq("tipo", "elogio")
        .gte("created_at", inicioMes.toISOString());

      if (error) throw error;

      const total_mes = data.length;
      
      // Calcular setor mais elogiado
      const setorCount: Record<string, number> = {};
      const colaboradorCount: Record<string, number> = {};
      
      data.forEach(m => {
        if (m.setor_elogio) {
          setorCount[m.setor_elogio] = (setorCount[m.setor_elogio] || 0) + 1;
        }
        if (m.colaborador_elogiado) {
          colaboradorCount[m.colaborador_elogiado] = (colaboradorCount[m.colaborador_elogiado] || 0) + 1;
        }
      });

      const setorMaisElogiado = Object.entries(setorCount)
        .sort(([,a], [,b]) => b - a)[0];
      const colaboradorDestaque = Object.entries(colaboradorCount)
        .sort(([,a], [,b]) => b - a)[0];

      return {
        total_mes,
        setor_mais_elogiado: setorMaisElogiado?.[0] || null,
        setor_mais_elogiado_count: setorMaisElogiado?.[1] || 0,
        colaborador_destaque: colaboradorDestaque?.[0] || null,
        colaborador_destaque_count: colaboradorDestaque?.[1] || 0,
      };
    },
  });
}
```

**Alteracao**: Substituir `mockEstatisticas.elogios` pelo hook `useEstatisticasElogios()`

---

### 2. ManifestacoesList.tsx - Corrigir contagens das tabs

**Problema**: Counts hardcoded

**Solucao**: Criar query que calcule os counts reais

```typescript
const counts = useMemo(() => {
  if (!manifestacoes) return { todas: 0, minhas: 0, sem_responsavel: 0, atrasadas: 0 };
  
  const userId = user?.id; // Obter do auth
  const agora = new Date();
  
  return {
    todas: manifestacoes.length,
    minhas: manifestacoes.filter(m => m.responsavel_id === userId).length,
    sem_responsavel: manifestacoes.filter(m => !m.responsavel_id && m.status !== 'encerrado').length,
    atrasadas: manifestacoes.filter(m => {
      if (!m.data_limite || m.status === 'encerrado') return false;
      return new Date(m.data_limite) < agora;
    }).length,
  };
}, [manifestacoes, user]);
```

---

### 3. ManifestacoesList.tsx - Conectar handleAssumir ao hook real

**Problema**: `handleAssumir` so exibe toast

**Solucao**: Usar o hook `useAssumirManifestacao` existente

```typescript
// Adicionar no componente
const assumirMutation = useAssumirManifestacao();

const handleAssumir = (id: string) => {
  assumirMutation.mutate(id);
};
```

---

### 4. ManifestacoesList.tsx - Implementar handleMarcarUrgente

**Problema**: `handleMarcarUrgente` so exibe toast

**Solucao**: Criar mutation e conectar

```typescript
const marcarUrgenteMutation = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('ouvidoria_manifestacoes')
      .update({ prioridade: 'urgente' })
      .eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ouvidoria'] });
    toast.success('Marcada como urgente!');
  },
});

const handleMarcarUrgente = (id: string) => {
  marcarUrgenteMutation.mutate(id);
};
```

---

### 5. NovaManifestacao.tsx - Conectar ao hook useCreateManifestacao

**Problema**: Simula envio, nao persiste

**Solucao**: Usar o hook `useCreateManifestacao` existente

```typescript
// Adicionar no componente
const createMutation = useCreateManifestacao();

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (tipo === 'elogio') {
    if (!setorElogio || !assunto || descricao.length < 20) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }
  } else {
    if (!tipo || !categoria || !assunto || descricao.length < 20) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }
  }

  try {
    await createMutation.mutateAsync({
      tipo: tipo as TipoManifestacao,
      categoria: categoria as CategoriaManifestacao || undefined,
      assunto,
      descricao,
      anonimo,
      canal: 'app', // Canal padrao para formulario publico
      prioridade: tipo === 'reclamacao_urgente' ? 'urgente' : 'normal',
      setor_elogio: setorElogio || undefined,
      colaborador_elogiado: colaborador || undefined,
    });
    navigate('/ouvidoria/manifestacoes');
  } catch (error) {
    // Erro tratado pelo hook
  }
};
```

---

### 6. NovaManifestacaoModal.tsx - Substituir mockAssociados e persistir

**Problema**: Usa dados mock e nao persiste

**Solucao**: 
1. Buscar associados do banco
2. Usar o hook `useCreateManifestacao`

```typescript
// Busca de associados real
const { data: associadosData } = useQuery({
  queryKey: ['associados-busca', searchQuery],
  queryFn: async () => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const { data, error } = await supabase
      .from('associados')
      .select('id, nome, cpf, telefone, email, codigo')
      .or(`nome.ilike.%${searchQuery}%,cpf.ilike.%${searchQuery}%,codigo.ilike.%${searchQuery}%`)
      .limit(10);
    if (error) throw error;
    return data;
  },
  enabled: searchQuery.length >= 2,
});

// Usar mutation real
const createMutation = useCreateManifestacao();

const handleSubmit = async () => {
  if (!isFormValid) return;
  
  try {
    const result = await createMutation.mutateAsync({
      associado_id: isAnonimo ? undefined : selectedAssociado?.id,
      tipo: tipo as TipoManifestacao,
      categoria: categoria as CategoriaManifestacao,
      assunto,
      descricao,
      anonimo: isAnonimo,
      canal: canal as CanalManifestacao,
      prioridade: prioridade,
      setor_elogio: setorElogio || undefined,
      data_contato: dataContato,
      registrado_por_nome: user?.email, // Preencher com usuario logado
      observacao_interna: observacaoInterna || undefined,
    });
    
    resetForm();
    onOpenChange(false);
    
    if (iniciarAtendimento && result) {
      navigate(`/ouvidoria/${result.id}`);
    }
  } catch (error) {
    // Erro tratado pelo hook
  }
};
```

---

### 7. EncaminharModal.tsx - Buscar analistas e departamentos reais

**Problema**: Usa dados mock

**Solucao**: Buscar do banco

```typescript
// Buscar funcionarios (analistas)
const { data: analistas } = useQuery({
  queryKey: ['funcionarios-ouvidoria'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('tipo', 'funcionario')
      .eq('ativo', true);
    if (error) throw error;
    return data;
  },
});

// Departamentos podem vir de uma tabela ou constante
const departamentos = [
  { id: 'atendimento', nome: 'Atendimento' },
  { id: 'sinistros', nome: 'Sinistros' },
  { id: 'financeiro', nome: 'Financeiro' },
  { id: 'assistencia', nome: 'Assistencia 24h' },
];

// Mutation para encaminhar
const encaminharMutation = useMutation({
  mutationFn: async ({ manifestacaoId, destino, destinoId, motivo }) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Se for para juridico, usar hook existente
    if (destino === 'juridico') {
      // Chamar useEncaminharJuridico
    }
    
    // Atualizar responsavel ou departamento
    const updates: Record<string, unknown> = {};
    if (destino === 'analista') {
      updates.responsavel_id = destinoId;
    } else if (destino === 'departamento') {
      updates.departamento = destinoId;
    }
    
    const { error: updateError } = await supabase
      .from('ouvidoria_manifestacoes')
      .update(updates)
      .eq('id', manifestacaoId);
    
    if (updateError) throw updateError;
    
    // Registrar interacao de encaminhamento
    const { error: interacaoError } = await supabase
      .from('ouvidoria_interacoes')
      .insert({
        manifestacao_id: manifestacaoId,
        usuario_id: user?.id,
        tipo: 'encaminhamento',
        mensagem: `Encaminhado para ${destino}: ${motivo}`,
        visivel_associado: false,
      });
    
    if (interacaoError) throw interacaoError;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ouvidoria'] });
    toast.success('Manifestacao encaminhada!');
  },
});
```

---

### 8. ManifestacaoDetalhe.tsx - Implementar "Encaminhar para Setor + RH"

**Problema**: Botao so exibe toast

**Solucao**: Criar integracao real

```typescript
const encaminharSetorRHMutation = useMutation({
  mutationFn: async ({ manifestacaoId, setor, colaborador }) => {
    // Registrar interacao
    const { error } = await supabase
      .from('ouvidoria_interacoes')
      .insert({
        manifestacao_id: manifestacaoId,
        tipo: 'encaminhamento',
        mensagem: `Elogio encaminhado para o setor ${setor} e para o RH. Colaborador: ${colaborador || 'Nao especificado'}`,
        visivel_associado: false,
      });
    
    if (error) throw error;
    
    // TODO: Integrar com modulo RH se necessario
    // Esta integracao pode ser feita posteriormente quando o modulo RH tiver
    // uma forma de receber notificacoes de elogios
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ouvidoria'] });
    toast.success('Elogio encaminhado para o setor e RH!');
  },
});

// No botao:
<Button 
  variant="outline" 
  onClick={() => {
    encaminharSetorRHMutation.mutate({
      manifestacaoId: manifestacao.id,
      setor: manifestacao.setor_elogio,
      colaborador: manifestacao.colaborador_elogiado,
    });
  }}
>
  <SendIcon className="h-4 w-4" />
  Encaminhar para o Setor + RH
</Button>
```

---

### 9. Atualizar useCreateManifestacao para suportar novos campos

**Arquivo**: `src/hooks/useOuvidoria.ts`

```typescript
export function useCreateManifestacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      associado_id?: string;
      tipo: TipoManifestacao;
      categoria?: CategoriaManifestacao;
      assunto: string;
      descricao: string;
      anonimo?: boolean;
      canal: CanalManifestacao;
      prioridade?: PrioridadeManifestacao;
      // Novos campos
      setor_elogio?: string;
      colaborador_elogiado?: string;
      data_atendimento?: string;
      data_contato?: string;
      registrado_por_id?: string;
      registrado_por_nome?: string;
      observacao_interna?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: manifestacao, error } = await supabase
        .from("ouvidoria_manifestacoes")
        .insert({
          ...data,
          protocolo: '', // Trigger ira gerar
          registrado_por_id: data.registrado_por_id || user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return manifestacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Manifestacao criada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar manifestacao:", error);
      toast.error("Erro ao criar manifestacao");
    },
  });
}
```

---

## Resumo das Alteracoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| **Banco de dados** | **Migration** | Adicionar colunas de elogio + trigger protocolo |
| `src/hooks/useOuvidoria.ts` | Modificar | Adicionar hook useEstatisticasElogios, atualizar useCreateManifestacao |
| `src/pages/ouvidoria/OuvidoriaDashboard.tsx` | Modificar | Remover mock, usar hook real |
| `src/pages/ouvidoria/ManifestacoesList.tsx` | Modificar | Corrigir counts, conectar handleAssumir/handleMarcarUrgente |
| `src/pages/ouvidoria/NovaManifestacao.tsx` | Modificar | Usar useCreateManifestacao |
| `src/components/ouvidoria/NovaManifestacaoModal.tsx` | Modificar | Busca real de associados, usar mutation |
| `src/components/ouvidoria/EncaminharModal.tsx` | Modificar | Busca real de analistas, persistir |
| `src/pages/ouvidoria/ManifestacaoDetalhe.tsx` | Modificar | Implementar encaminhar para setor |
| `src/mocks/ouvidoria.ts` | **Excluir** | Remover arquivo de mocks |

---

## Integracoes Existentes (NAO MEXER)

A area Ouvidoria ja possui integracao correta com:

1. **Juridico**: Hook `useEncaminharJuridico` cria processo e vincula
2. **Associados**: Query busca dados do associado vinculado
3. **Profiles**: Responsavel vinculado corretamente

**Nao e necessario alterar outras areas do sistema.**

---

## Verificacao Pos-Implementacao

1. Criar manifestacao do tipo Reclamacao
2. Criar manifestacao do tipo Elogio com setor e colaborador
3. Assumir manifestacao na lista
4. Marcar manifestacao como urgente
5. Encaminhar manifestacao para analista
6. Encaminhar manifestacao para departamento
7. Encaminhar para juridico
8. Responder manifestacao
9. Verificar timeline de interacoes
10. Verificar estatisticas do dashboard
11. Verificar contagem correta nas tabs
