
# Revisao Completa - Fluxo de Vinculacao Cliente/Veiculo/Equipamento na Rede Veiculos

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint POST /vincularClienteVeiculo na instalacao | **NAO IMPLEMENTADO** | Nao existe integracao equivalente a `softruck-ativar-dispositivo` |
| Endpoint na aprovacao do associado | **NAO IMPLEMENTADO** | Hook `useAtivarRastreador` apenas atualiza banco local |
| Endpoint na migracao de equipamento | **NAO IMPLEMENTADO** | Funcionalidade nao existe |
| Endpoint na reativacao de associado | **NAO IMPLEMENTADO** | Hook `reativarAssociado` apenas atualiza status local |
| Dados do equipamento enviados | **NAO** | Nenhuma integracao ativa |
| Dados do veiculo enviados | **NAO** | Nenhuma integracao ativa |
| Dados do cliente enviados | **NAO** | Nenhuma integracao ativa |
| Permissoes padrao aplicadas | **NAO** | Nenhuma integracao ativa |

---

## Analise Detalhada

### 1. Integracao Atual com Rede Veiculos

A plataforma Rede Veiculos esta configurada no sistema com os seguintes endpoints implementados:

| Endpoint | Implementado | Edge Function |
|----------|--------------|---------------|
| GET /veiculos/{id}/posicao | Sim | `posicao-veiculo` |
| GET /historico | Sim (fallback local) | `historico-posicoes` |
| POST /acionamentoRouboFurto | Sim | `acionar-roubo-furto` |
| POST /rastreamentoIntensivo | Sim | `acionar-roubo-furto` |
| POST /redefinirSenhaCliente | Sim | `rastreador-redefinir-senha` |
| **POST /vincularClienteVeiculo** | **NAO** | **Nao existe** |

### 2. Comparacao com Softruck

A Softruck possui fluxo completo de ativacao via `softruck-ativar-dispositivo`:

```
Softruck (IMPLEMENTADO):
1. Buscar rastreador local pelo IMEI
2. Buscar/criar veiculo na plataforma (POST /v2/vehicles)
3. Buscar device pelo IMEI (GET /v2/devices)
4. Associar device ao veiculo (POST /v2/vehicles/associations/devices)
5. Ativar device (PATCH /v2/devices/{id}/status/activation)
6. Verificar primeira posicao GPS
7. Atualizar banco local com IDs da plataforma

Rede Veiculos (NAO IMPLEMENTADO):
- Apenas atualizacao local do banco
- Nenhuma chamada para API externa
- Nao vincula cliente/veiculo/equipamento na plataforma
```

### 3. Momentos Onde Deveria Chamar vincularClienteVeiculo

#### 3.1 Quando a instalacao e finalizada pelo instalador

**Arquivo:** `src/hooks/useServicos.ts` (linhas 850-970)

**Fluxo Atual:**
```typescript
// useAprovarVeiculoServico
// 1. Buscar rastreador por IMEI
// 2. Atualizar servico como concluida
// 3. Vincular rastreador ao veiculo (LOCAL)
// 4. Registrar movimentacao de estoque
// 5. SE Softruck: chama softruck-ativar-dispositivo (linhas 933-944)
// 6. SE Rede Veiculos: NADA!
```

**Gap:** O codigo verifica se e Softruck e chama a integracao, mas para Rede Veiculos:
- Apenas atualiza `rastreadores.status = 'instalado'`
- Apenas atualiza `rastreadores.veiculo_id`
- **NAO** chama nenhum endpoint da plataforma Rede Veiculos

#### 3.2 Quando o associado e aprovado no cadastro

**Arquivo:** `src/hooks/useAtivarRastreador.ts`

**Fluxo Atual:**
```typescript
// useAtivarRastreador
if (rastreadorExistente.plataforma === 'softruck') {
  // Chama softruck-ativar-dispositivo
} else {
  // Para outras plataformas (inclui rede_veiculos):
  // Apenas atualiza banco local!
  await supabase.from('rastreadores').update({
    veiculo_id: veiculoId,
    associado_id: associadoId,
    status: 'instalado',
  });
}
```

**Gap:** Rede Veiculos cai no `else` generico que apenas atualiza o banco local.

#### 3.3 Quando ha migracao de equipamento

**Status:** Funcionalidade NAO existe no sistema.

Nao ha fluxo implementado para:
- Trocar rastreador de um veiculo para outro
- Migrar equipamento entre associados
- Substituir equipamento com defeito

#### 3.4 Quando ha reativacao de associado

**Arquivo:** `src/hooks/useAssociados.ts` (linhas 450-464)

**Fluxo Atual:**
```typescript
const reativarAssociado = useMutation({
  mutationFn: async (id: string) => {
    await supabase.from('associados').update({
      status: 'ativo',
      bloqueado: false,
      motivo_bloqueio: null,
    }).eq('id', id);
  },
});
```

**Gap:** Apenas atualiza status local, nao notifica a plataforma Rede Veiculos.

---

## Configuracao Atual da Plataforma Rede Veiculos

```json
{
  "plataforma": "rede_veiculos",
  "nome_exibicao": "Rede Veiculos",
  "api_url_sandbox": "https://integracao.redeveiculos.com/api/v2/sandbox",
  "api_url_producao": "https://integracao.redeveiculos.com/api/v2/prod",
  "auth_type": "bearer_fixo",
  "ambiente_atual": "sandbox",
  "suporta_posicao_tempo_real": false,
  "suporta_historico_trajeto": false,
  "suporta_acionamento_roubo": true,
  "suporta_bloqueio": false,
  "suporta_redefinir_senha": true
}
```

**Secrets Configurados:**
- `REDE_VEICULOS_TOKEN`: Token Bearer para autenticacao

---

## Payload Esperado para POST /vincularClienteVeiculo

Baseado em integracoes similares, o endpoint provavelmente espera:

```typescript
interface VincularClienteVeiculoRequest {
  // Dados do Equipamento
  equipamento: {
    imei: string;              // IMEI do rastreador
    localInstalacao: string;   // "painel", "motor", "porta-malas", etc
    possuiBloqueio: boolean;   // Se tem modulo de bloqueio
  };
  
  // Dados do Veiculo
  veiculo: {
    tipo: string;              // "carro", "moto", "caminhao"
    marca: string;             // "FIAT", "CHEVROLET", etc
    modelo: string;            // "UNO", "ONIX", etc
    placa: string;             // "ABC1234" ou "ABC1D23"
    cor: string;               // "BRANCO", "PRETO", etc
    ano: number;               // 2020, 2021, etc
    chassi?: string;           // Opcional
    renavam?: string;          // Opcional
  };
  
  // Dados do Cliente
  cliente: {
    cpfCnpj: string;           // CPF ou CNPJ
    nome: string;              // Nome completo ou razao social
    celular: string;           // Telefone com DDD
    email: string;             // Email valido
    endereco?: {               // Opcional
      cep: string;
      logradouro: string;
      numero: string;
      bairro: string;
      cidade: string;
      uf: string;
    };
  };
  
  // Permissoes padrao
  permissoes?: {
    acessoWeb: boolean;        // Acesso ao portal web
    pushNotifications: boolean; // Receber notificacoes push
    alertaVelocidade: boolean; // Alertas de velocidade
    alertaCercaVirtual: boolean; // Alertas de cerca virtual
    alertaIgnicao: boolean;    // Alertas de ignicao
  };
}
```

---

## Plano de Implementacao

### Fase 1: Criar Edge Function rede-veiculos-vincular-cliente

**Novo arquivo:** `supabase/functions/rede-veiculos-vincular-cliente/index.ts`

```typescript
interface RequestBody {
  imei: string;
  veiculoId: string;
  associadoId: string;
  localInstalacao?: string;
  possuiBloqueio?: boolean;
}

// Fluxo:
// 1. Buscar rastreador local pelo IMEI
// 2. Buscar veiculo local
// 3. Buscar associado local
// 4. Montar payload conforme API Rede Veiculos
// 5. Chamar POST /vincularClienteVeiculo
// 6. Salvar IDs retornados no banco local
// 7. Registrar log de integracao
```

### Fase 2: Integrar nos Momentos Apropriados

#### 2.1 Na finalizacao da instalacao

**Modificar:** `src/hooks/useServicos.ts` (linha 933)

```typescript
// Tentar ativar rastreador na plataforma
if (rastreador.plataforma === 'softruck') {
  await supabase.functions.invoke('softruck-ativar-dispositivo', { ... });
} else if (rastreador.plataforma === 'rede_veiculos') {
  await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
    body: {
      imei: data.imeiRastreador,
      veiculoId: data.veiculoId,
      associadoId: data.associadoId,
      localInstalacao: 'painel', // Pode vir do formulario
      possuiBloqueio: false,
    },
  });
}
```

#### 2.2 Na ativacao do rastreador via hook

**Modificar:** `src/hooks/useAtivarRastreador.ts`

```typescript
if (rastreadorExistente.plataforma === 'softruck') {
  // Softruck
  await supabase.functions.invoke('softruck-ativar-dispositivo', { ... });
} else if (rastreadorExistente.plataforma === 'rede_veiculos') {
  // Rede Veiculos
  await supabase.functions.invoke('rede-veiculos-vincular-cliente', { ... });
} else {
  // Outras plataformas: apenas local
}
```

### Fase 3: Criar Funcionalidade de Migracao de Equipamento

**Novo arquivo:** `src/hooks/useMigrarEquipamento.ts`

```typescript
interface MigrarEquipamentoParams {
  rastreadorId: string;
  veiculoOrigemId: string;
  veiculoDestinoId: string;
  motivoMigracao: string;
}

// Fluxo:
// 1. Desvincular do veiculo origem (na plataforma)
// 2. Vincular ao veiculo destino (na plataforma)
// 3. Atualizar banco local
// 4. Registrar movimentacao
```

### Fase 4: Integrar na Reativacao de Associado

**Modificar:** `src/hooks/useAssociados.ts`

```typescript
const reativarAssociado = useMutation({
  mutationFn: async (id: string) => {
    // 1. Atualizar status local
    await supabase.from('associados').update({ status: 'ativo' });
    
    // 2. Buscar veiculos do associado com rastreador
    const { data: veiculos } = await supabase
      .from('veiculos')
      .select('*, rastreadores(*)')
      .eq('associado_id', id);
    
    // 3. Para cada veiculo com rastreador Rede Veiculos, revincular
    for (const veiculo of veiculos || []) {
      if (veiculo.rastreadores?.plataforma === 'rede_veiculos') {
        await supabase.functions.invoke('rede-veiculos-vincular-cliente', { ... });
      }
    }
  },
});
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/rede-veiculos-vincular-cliente/index.ts` | Edge Function principal |
| `supabase/functions/rede-veiculos-desvincular/index.ts` | Edge Function para desvincular |
| `src/hooks/useMigrarEquipamento.ts` | Hook para migracao |
| `src/components/rastreadores/MigrarEquipamentoDialog.tsx` | Modal de migracao |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/hooks/useServicos.ts` | Adicionar chamada para rede_veiculos na finalizacao |
| `src/hooks/useAtivarRastreador.ts` | Adicionar branch para rede_veiculos |
| `src/hooks/useAssociados.ts` | Integrar reativacao com plataforma |
| `supabase/config.toml` | Registrar novas edge functions |
| `src/types/rastreadores.ts` | Adicionar interfaces de vinculacao |

---

## Dados Necessarios da API Rede Veiculos

**Antes de implementar, e necessario confirmar:**

1. **URL exata do endpoint:** `POST /vincularClienteVeiculo` ou similar
2. **Formato do payload:** Campos obrigatorios e opcionais
3. **Formato da resposta:** IDs retornados, codigos de erro
4. **Credenciais de teste:** Acesso ao sandbox

**Recomendacao:** Solicitar documentacao da API Rede Veiculos antes de iniciar a implementacao.

---

## Checklist de Verificacao Pos-Implementacao

- [ ] Edge function `rede-veiculos-vincular-cliente` criada
- [ ] Chamada integrada na finalizacao da instalacao
- [ ] Chamada integrada na ativacao de rastreador
- [ ] Funcionalidade de migracao implementada
- [ ] Reativacao de associado notifica plataforma
- [ ] Dados do equipamento enviados corretamente (imei, localInstalacao, possuiBloqueio)
- [ ] Dados do veiculo enviados completos (tipo, marca, modelo, placa, cor, ano)
- [ ] Dados do cliente enviados corretos (cpfCnpj, nome, celular, email)
- [ ] Permissoes padrao aplicadas (acessoWeb, pushNotifications, alertas)
- [ ] IDs da plataforma salvos no banco local
- [ ] Veiculo aparece na plataforma Rede Veiculos apos vinculacao

---

## Teste Recomendado

### Pre-requisitos

1. `REDE_VEICULOS_TOKEN` valido e configurado
2. Rastreador cadastrado no estoque com `plataforma = 'rede_veiculos'`
3. Associado e veiculo cadastrados no sistema
4. Acesso ao painel da Rede Veiculos para verificar

### Passos do Teste

1. **Login como instalador**
2. **Aceitar tarefa de instalacao**
3. **Completar checklist** e informar IMEI do rastreador Rede Veiculos
4. **Clicar "Aprovar Instalacao"**
5. **Verificar no banco:**
   - `rastreadores.status = 'instalado'`
   - `rastreadores.id_plataforma` preenchido (ID retornado pela API)
   - `rastreadores_api_logs` com registro de sucesso
6. **Verificar na plataforma Rede Veiculos:**
   - Cliente cadastrado
   - Veiculo cadastrado
   - Equipamento vinculado

### Resultado Esperado

- Veiculo aparece na plataforma Rede Veiculos
- Dados do cliente corretos
- Permissoes padrao ativas (acessoWeb, push, alertas)
