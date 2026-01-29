
# Plano: Mostrar Status Real das Integrações (ASAAS, WhatsApp, Email, Autentique)

## Problema Identificado

Os cards de integrações na página **Configurações > Integrações > Serviços** mostram status hardcoded (`ativo: false`), mesmo quando os secrets estão configurados:

| Integração | Secret Configurado | Status Atual na UI |
|------------|-------------------|-------------------|
| WhatsApp | EVOLUTION_API_KEY | OFF (mas está conectado!) |
| ASAAS | ASAAS_API_KEY | OFF |
| Email SMTP | RESEND_API_KEY | OFF |
| Autentique | AUTENTIQUE_API_KEY | OFF |
| n8n | N/A (hardcoded) | ON |

---

## Solução Proposta

### Fase 1: Criar Edge Function para Verificar Secrets de Integrações

**Criar:** `supabase/functions/integracoes-verificar-secrets/index.ts`

```text
Verificar existência dos seguintes secrets (sem expor valores):
- ASAAS_API_KEY → asaas.configurado
- AUTENTIQUE_API_KEY → autentique.configurado
- RESEND_API_KEY → email.configurado
- EVOLUTION_API_KEY → whatsapp.api_configurada

Retorno:
{
  success: true,
  status: {
    asaas: { configurado: true },
    autentique: { configurado: true },
    email: { configurado: true },
    whatsapp: { api_configurada: true }
  }
}
```

### Fase 2: Criar Hook para Status de Integrações

**Criar:** `src/hooks/useIntegracoesStatus.ts`

Hook que combina múltiplas fontes:
- Chama `integracoes-verificar-secrets` para verificar se secrets existem
- Para WhatsApp: também verifica status da instância via `useWhatsAppStatus`
- Para rastreadores: usa `useRastreadorStatus` existente

```text
interface IntegracoesStatus {
  asaas: { configurado: boolean };
  autentique: { configurado: boolean };
  email: { configurado: boolean };
  whatsapp: { configurado: boolean; conectado: boolean };
  softruck: { configurado: boolean; testado: boolean };
  rede_veiculos: { configurado: boolean; testado: boolean };
}
```

### Fase 3: Atualizar ServicosTab.tsx

Modificar `categoriasBase` para:
1. Remover status hardcoded (`ativo: false`)
2. Adicionar propriedade `integracaoId` para mapear ao status dinâmico
3. Usar o hook `useIntegracoesStatus` para determinar status real

**Lógica de status por integração:**

| Integração | Lógica para "ON" |
|------------|------------------|
| ASAAS | Secret existe E não está vazio |
| Autentique | Secret existe E não está vazio |
| Email SMTP | Secret existe E não está vazio |
| WhatsApp | Instância conectada (status = 'open') |
| Rede Veículos | Credencial testada com sucesso |
| Softruck | Credencial testada com sucesso |
| Tabela FIPE | Sempre ON (API pública) |
| n8n | Manter hardcoded ON (sem API key) |

### Fase 4: Criar Sheets de Configuração para Cada Serviço

**Criar:** `src/components/integracoes/ConfigurarServicoSheet.tsx`

Sheet genérico que exibe:
- Nome do secret necessário
- Link para painel de secrets do Supabase
- Botão "Testar Conexão" (quando aplicável)
- Status do último teste

Reutilizar o padrão do `ConfigurarRastreadorSheet.tsx` existente.

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/integracoes-verificar-secrets/index.ts` | Edge function para verificar secrets |
| `src/hooks/useIntegracoesStatus.ts` | Hook para status combinado de todas integrações |
| `src/components/integracoes/ConfigurarServicoSheet.tsx` | Sheet genérico para configurar serviços |

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/integracoes/ServicosTab.tsx` | Usar status dinâmico, adicionar ações de configurar |
| `supabase/config.toml` | Adicionar nova edge function |
| `src/components/integracoes/index.ts` | Exportar novo componente |

---

## Detalhamento Técnico

### Edge Function `integracoes-verificar-secrets`

```typescript
serve(async (req) => {
  const status = {
    asaas: {
      configurado: !!Deno.env.get('ASAAS_API_KEY')?.length,
      ambiente: Deno.env.get('ASAAS_API_KEY')?.includes('_hmlg_') ? 'sandbox' : 'production'
    },
    autentique: {
      configurado: !!Deno.env.get('AUTENTIQUE_API_KEY')?.length
    },
    email: {
      configurado: !!Deno.env.get('RESEND_API_KEY')?.length
    },
    whatsapp: {
      api_configurada: !!Deno.env.get('EVOLUTION_API_KEY')?.length
    },
    openai: {
      configurado: !!Deno.env.get('OPENAI_API_KEY')?.length
    }
  };

  return Response.json({ success: true, status });
});
```

### Hook `useIntegracoesStatus`

```typescript
export function useIntegracoesStatus() {
  // Buscar status dos secrets
  const secretsQuery = useQuery({
    queryKey: ['integracoes-secrets'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('integracoes-verificar-secrets');
      return data?.status;
    },
    refetchInterval: 60000 // Atualizar a cada 1 min
  });

  // Buscar status da instância WhatsApp
  const whatsappQuery = useQuery({
    queryKey: ['whatsapp-instancia-status'],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_instancias')
        .select('status')
        .eq('principal', true)
        .single();
      return data?.status === 'open';
    }
  });

  // Buscar status dos rastreadores
  const { data: rastreadores } = useRastreadorStatus();

  return {
    asaas: { configurado: secretsQuery.data?.asaas?.configurado || false },
    autentique: { configurado: secretsQuery.data?.autentique?.configurado || false },
    email: { configurado: secretsQuery.data?.email?.configurado || false },
    whatsapp: { 
      configurado: secretsQuery.data?.whatsapp?.api_configurada || false,
      conectado: whatsappQuery.data || false 
    },
    softruck: rastreadores?.find(r => r.plataforma === 'softruck'),
    rede_veiculos: rastreadores?.find(r => r.plataforma === 'rede_veiculos'),
    isLoading: secretsQuery.isLoading,
  };
}
```

### ServicosTab Atualizada

```typescript
const categoriasBase = [
  {
    titulo: 'Pagamentos',
    emoji: '💳',
    servicos: [
      {
        id: 'asaas',
        nome: 'ASAAS',
        integracaoId: 'asaas', // Para mapear ao status
        secretName: 'ASAAS_API_KEY',
        // ... resto igual
      },
    ],
  },
  // ... outras categorias
];

// No componente:
const { asaas, whatsapp, email, autentique } = useIntegracoesStatus();

// Para cada serviço, determinar status:
const getServicoStatus = (servico) => {
  switch (servico.integracaoId) {
    case 'asaas': return asaas.configurado;
    case 'whatsapp': return whatsapp.conectado;
    case 'email': return email.configurado;
    case 'autentique': return autentique.configurado;
    // ... rastreadores já têm lógica própria
  }
};
```

---

## Fluxo do Usuário Atualizado

```text
1. Usuário acessa Configurações > Integrações
2. Sistema carrega status real de todas as integrações
3. Cards mostram:
   - WhatsApp: ON (se conectado) ou OFF (se desconectado)
   - ASAAS: ON (se ASAAS_API_KEY existe) ou OFF
   - Email: ON (se RESEND_API_KEY existe) ou OFF
   - Autentique: ON (se AUTENTIQUE_API_KEY existe) ou OFF
4. Botão "Configurar" abre sheet com instruções
5. Botão "Editar" disponível para serviços já configurados
```

---

## Resultado Esperado

Após implementação, a tela mostrará:

| Serviço | Status |
|---------|--------|
| ASAAS | **ON** (secret existe) |
| WhatsApp | Depende da conexão atual |
| Email SMTP | **ON** (secret existe) |
| Rede Veículos | Conforme teste |
| Softruck | Conforme teste |
| Autentique | **ON** (secret existe) |
| n8n | **ON** (hardcoded) |

---

## Considerações

1. **Segurança:** A edge function apenas verifica se secrets existem, nunca expõe valores
2. **Performance:** Cache de 60s para evitar chamadas excessivas
3. **WhatsApp especial:** Além do secret, precisa verificar conexão ativa
4. **Compatibilidade:** Mantém comportamento atual dos rastreadores
