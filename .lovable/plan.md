
# Plano: Botão "Enviar para SGA" na Tela de Ativações

## Resumo

Implementar um botão **"Enviar para SGA"** que aparece no card de ativação quando:
1. O associado está **ativado** (status = 'ativo')
2. O veículo ainda **não foi sincronizado** com o Hinova

Para planos apenas de **roubo/furto**, o botão deve indicar visualmente essa informação.

---

## Análise de Requisitos

### Condições para Exibir o Botão

| Condição | Verificação |
|----------|-------------|
| Contrato ativado | `contrato.status === 'ativo'` |
| Vistoria realizada | `vistoria.status in ['em_analise', 'aprovada']` |
| Assinatura realizada | `contrato.data_assinatura !== null` |
| Veículo não sincronizado | `veiculo.sincronizado_hinova === false` |

### Identificação de Plano Roubo/Furto

Planos como **ESPECIAL** e **ADVANCED** possuem apenas cobertura de "Roubo e Furto" sem "Colisão". A identificação pode ser feita verificando o array `coberturas` do plano:

```text
Plano "ESPECIAL": ['Roubo e Furto', 'Assistência 24h 400km', ...]
Plano "ADVANCED": ['Roubo e Furto', 'Assistência 24h 400km', ...]
```

Regra: Se `coberturas` não contém "Colisão", é um plano de **apenas roubo/furto**.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                        AtivacoesList.tsx                        │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   AtivacaoCardNew.tsx                       ││
│  │  - Exibe dados do contrato                                  ││
│  │  - Verifica se pode exibir botão SGA                        ││
│  │  - Detecta se é plano roubo/furto                           ││
│  │                              │                              ││
│  │                              ▼                              ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │            BotaoEnviarSGA (novo componente)           │  ││
│  │  │  - Botão contextual com status                        │  ││
│  │  │  - Exibe badge "Roubo/Furto" quando aplicável         │  ││
│  │  │  - Chama Edge Function sga-hinova-sync                │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

### 1. `src/hooks/useAtivacoes.ts`
Adicionar dados necessários ao `AtivacaoContrato`:

```typescript
interface AtivacaoContrato {
  // ... campos existentes ...
  
  // Novos campos para SGA
  veiculo_id: string | null;
  sincronizado_hinova: boolean;
  status_sga: string | null;
  codigo_hinova: number | null;
  
  // Plano para verificar cobertura
  plano: {
    id: string;
    nome: string;
    coberturas: string[];
  } | null;
}
```

Modificar a query para incluir:
- Dados do veículo (`sincronizado_hinova`, `status_sga`, `codigo_hinova`)
- Dados do plano (`coberturas`)

### 2. `src/components/ativacao/AtivacaoCardNew.tsx`
Adicionar lógica para:
- Verificar se pode exibir botão SGA
- Detectar se plano é apenas roubo/furto
- Renderizar novo botão após ativação

**Condição para mostrar botão:**
```typescript
const podeEnviarSGA = 
  isAtivado && 
  contrato.veiculo_id && 
  !contrato.sincronizado_hinova;

const isRouboFurtoApenas = contrato.plano?.coberturas?.some(
  c => c.toLowerCase().includes('roubo')
) && !contrato.plano?.coberturas?.some(
  c => c.toLowerCase().includes('colisão')
);
```

### 3. Criar `src/components/ativacao/BotaoEnviarSGA.tsx` (novo)
Componente específico para o contexto de ativações:

```typescript
interface BotaoEnviarSGAProps {
  contratoId: string;
  veiculoId: string;
  associadoId: string;
  sincronizado: boolean;
  statusSGA: string | null;
  codigoHinova: number | null;
  isRouboFurto?: boolean;
  onSuccess?: () => void;
}
```

Funcionalidades:
- Estados: pendente, sincronizando, sincronizado, erro
- Badge visual para indicar "Roubo/Furto"
- Modal de confirmação com informações do envio
- Feedback via toast

---

## Lógica de Estados do Botão

| Status Veículo | Botão | Cor |
|----------------|-------|-----|
| `sincronizado_hinova = false` e `status_sga = 'pendente'` | "Enviar para SGA" | Azul |
| `status_sga = 'sincronizando'` | "Sincronizando..." | Cinza (desabilitado) |
| `status_sga = 'erro_sincronizacao'` | "Erro - Tentar Novamente" | Vermelho |
| `sincronizado_hinova = true` | "Enviado ao SGA ✓" | Verde (desabilitado) |

---

## Interface Visual

### Card Ativado - Sem Sincronização
```text
┌────────────────────────────────────────────┐
│ ✓ Ativado                                  │
│ João da Silva                              │
│ ABC-1234 • Ford Fiesta                     │
├────────────────────────────────────────────┤
│ Ativado em: 31/01/2025 às 14:30            │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │  📤 Enviar para SGA                    │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

### Card Ativado - Plano Roubo/Furto
```text
┌────────────────────────────────────────────┐
│ ✓ Ativado          🏷️ Roubo/Furto         │
│ Maria Santos                               │
│ XYZ-5678 • Honda Civic                     │
├────────────────────────────────────────────┤
│ Ativado em: 31/01/2025 às 15:00            │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │  📤 Enviar para SGA (Roubo/Furto)      │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

### Card Ativado - Já Sincronizado
```text
┌────────────────────────────────────────────┐
│ ✓ Ativado          ✓ SGA                   │
│ Carlos Oliveira                            │
│ DEF-9012 • VW Gol                          │
├────────────────────────────────────────────┤
│ Ativado em: 30/01/2025 às 10:15            │
│ SGA: Código #12345                         │
└────────────────────────────────────────────┘
```

---

## Detalhamento Técnico

### Modificação: `useAtivacoes.ts`

1. Expandir query de contratos para incluir `veiculo_id`
2. Buscar dados do veículo (sincronização SGA)
3. Buscar dados do plano (coberturas)
4. Retornar estrutura enriquecida

### Modificação: `AtivacaoCardNew.tsx`

1. Adicionar props para dados SGA
2. Criar função `detectarTipoPlano()` para identificar roubo/furto
3. Renderizar `BotaoEnviarSGA` quando `isAtivado && !sincronizado_hinova`
4. Mostrar badge de status SGA quando sincronizado

### Novo Componente: `BotaoEnviarSGA.tsx`

Baseado no `BotaoAtivarSGA` existente, com adaptações:
- Prop `isRouboFurto` para exibir label diferenciado
- Mensagem de confirmação personalizada para roubo/furto
- Invalidação de queries de ativações após sucesso

---

## Fluxo de Dados

```text
1. AtivacoesList carrega contratos via useAtivacoes()
   │
2. useAtivacoes busca contratos + veículos + planos
   │
3. Para cada contrato ativado:
   │
   ├── veiculo_id → buscar sincronizado_hinova, status_sga
   │
   ├── plano_id → buscar coberturas[]
   │
   └── Determinar: isRouboFurto, podeEnviarSGA
   │
4. AtivacaoCardNew renderiza BotaoEnviarSGA se aplicável
   │
5. Clique no botão → Modal de confirmação
   │
6. Confirmação → supabase.functions.invoke('sga-hinova-sync')
   │
7. Sucesso → invalidateQueries(['ativacoes'])
   │
8. Atualiza UI com status "Enviado ao SGA ✓"
```

---

## Requisitos da API Hinova

O sistema já está preparado para enviar os dados corretos via a Edge Function `sga-hinova-sync`. A API Hinova espera:

**Associado:** nome, cpf, rg, data_nascimento, endereço completo, telefone, email

**Veículo:** placa, chassi, renavam, ano_fabricacao, ano_modelo, codigo_fipe, valor_fipe, km

**Fotos/Documentos:** Enviados via endpoint `/veiculo/foto/cadastrar` com link das imagens

Para planos de **roubo/furto**, não há diferença no payload da API - a distinção é apenas visual para o operador.

---

## Ordem de Implementação

1. Modificar `useAtivacoes.ts` - adicionar campos de veículo e plano
2. Criar `BotaoEnviarSGA.tsx` - componente do botão
3. Modificar `AtivacaoCardNew.tsx` - integrar botão e lógica de exibição
4. Testar fluxo completo com credenciais Hinova

---

## Dependências

- **Credenciais Hinova**: `HINOVA_TOKEN`, `HINOVA_USUARIO`, `HINOVA_SENHA` devem estar configuradas nos Supabase Secrets ou na tabela `integracoes_credenciais`
- **Edge Function**: `sga-hinova-sync` já implementada e funcional
