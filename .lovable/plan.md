
# Plano: Corrigir Envio para SGA - Campos RENAVAM e CHASSI Obrigatórios

## Problema Identificado

O veículo **LTB4J74** (Toyota Corolla XEI Flex) do associado **MARCUS VINICIUS FAUSTINONI DE FREITAS** não foi enviado para o SGA Hinova porque:

- **RENAVAM**: `NULL` (não preenchido)
- **CHASSI**: `NULL` (não preenchido)

### Log de Sincronização
| Etapa | Status | Mensagem |
|-------|--------|----------|
| Autenticação | Sucesso | - |
| Cadastrar Associado | Sucesso | Código Hinova: 28779 |
| Validar Veículo | **ERRO** | RENAVAM não informado |

---

## Causa Raiz

O fluxo de cadastro atual permite que veículos sejam criados **sem RENAVAM e CHASSI**, que são opcionais no formulário de cadastro e nas cotações.

Porém, a API do SGA Hinova **exige obrigatoriamente** esses campos para cadastrar veículos.

### Fluxo do Problema
```text
1. Vendedor cria cotação → Veículo sem CRLV (sem chassi/renavam)
2. Cotação aceita → Contrato criado com veículo sem chassi/renavam
3. Vistoria realizada → Apenas laudo gerado (não extrai chassi/renavam)
4. Analista aprova proposta
5. Sistema tenta enviar para SGA
   └─► ERRO: RENAVAM e CHASSI obrigatórios
```

---

## Solução Proposta

### Parte 1: Permitir Edição de Campos Faltantes na Análise da Proposta

O analista de cadastro deve poder **preencher RENAVAM e CHASSI** antes de aprovar, especialmente quando esses dados não foram capturados do CRLV.

#### Modificações:

**Arquivo: `src/pages/cadastro/PropostaAnalise.tsx`**

1. Adicionar **campos editáveis** para RENAVAM e CHASSI no card de dados do veículo
2. Exibir um **alerta visual** quando esses campos estiverem vazios
3. **Bloquear aprovação** se RENAVAM ou CHASSI estiverem vazios (opcional)
4. Salvar os dados no veículo antes de chamar o SGA

---

### Parte 2: Melhorar Mensagem de Erro do SGA

Quando a sincronização falhar por falta de dados obrigatórios, o sistema deve:
1. Mostrar mensagem clara indicando qual campo está faltando
2. Oferecer link direto para editar o veículo

**Arquivo: `src/components/ativacao/BotaoEnviarSGA.tsx`**

Tratar o erro `campo_faltante` retornado pela Edge Function e exibir toast mais informativo.

---

### Parte 3: Extração Automática do CRLV (Opcional)

Quando um CRLV for enviado via documentos do contrato, extrair automaticamente os dados e atualizar o veículo.

**Arquivo: `src/components/contratos/UnifiedDocumentUploader.tsx`**

Após extração OCR de CRLV, atualizar o veículo com chassi e renavam se estiverem vazios.

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/cadastro/PropostaAnalise.tsx` | **MODIFICAR** | Adicionar campos editáveis para RENAVAM/CHASSI e alerta visual |
| `src/components/ativacao/BotaoEnviarSGA.tsx` | **MODIFICAR** | Melhorar tratamento de erro com campo faltante |
| `src/components/contratos/UnifiedDocumentUploader.tsx` | **MODIFICAR** | Atualizar veículo automaticamente após OCR do CRLV |

---

## Detalhes Técnicos

### Card de Dados do Veículo na Análise (PropostaAnalise)

```typescript
// Novo estado para campos editáveis
const [veiculoEditavel, setVeiculoEditavel] = useState({
  renavam: veiculo?.renavam || '',
  chassi: veiculo?.chassi || '',
});

// Alerta quando campos obrigatórios estão vazios
const camposFaltantes = [];
if (!veiculoEditavel.renavam) camposFaltantes.push('RENAVAM');
if (!veiculoEditavel.chassi) camposFaltantes.push('CHASSI');

// Mostrar alerta
{camposFaltantes.length > 0 && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Campos obrigatórios para SGA</AlertTitle>
    <AlertDescription>
      Preencha {camposFaltantes.join(' e ')} para enviar ao SGA Hinova.
    </AlertDescription>
  </Alert>
)}

// Salvar antes de aprovar
const handleAprovar = async () => {
  // Atualizar veículo com renavam/chassi se preenchidos
  if (veiculoEditavel.renavam || veiculoEditavel.chassi) {
    await supabase
      .from('veiculos')
      .update({
        renavam: veiculoEditavel.renavam || null,
        chassi: veiculoEditavel.chassi || null,
      })
      .eq('id', veiculo.id);
  }
  
  // Continuar com aprovação...
};
```

### Tratamento de Erro no BotaoEnviarSGA

```typescript
if (!data?.success) {
  // Erro de campo faltante
  if (data?.campo_faltante) {
    toast.error(`Campo obrigatório não preenchido`, {
      description: `${data.campo_faltante.toUpperCase()} é obrigatório para enviar ao SGA. Edite o veículo e preencha este campo.`,
      duration: 10000,
    });
    return;
  }
  // Outros erros...
}
```

---

## Solução Imediata para o Caso Atual

Executar SQL para preencher os dados faltantes manualmente:

```sql
UPDATE veiculos 
SET renavam = '00000000000',  -- Preencher com valor real
    chassi = '00000000000000000'  -- Preencher com valor real (17 caracteres)
WHERE id = '05a11b11-3eb0-48a3-9d7c-120d68f035e9';
```

Após isso, o botão "Enviar para SGA" funcionará normalmente.

---

## Fluxo Corrigido

```text
Vendedor cria cotação
     │
     ├─► Veículo criado (possivelmente sem chassi/renavam)
     │
Analista abre tela de análise
     │
     ├─► Sistema detecta campos vazios
     │        └─► Mostra alerta: "RENAVAM e CHASSI obrigatórios para SGA"
     │
     ├─► Analista pode:
     │        ├─► Preencher manualmente na tela
     │        └─► Solicitar CRLV ao cliente
     │
Analista aprova proposta
     │
     ├─► Sistema salva RENAVAM/CHASSI no veículo
     ├─► Sistema envia para SGA
     └─► Sincronização concluída com sucesso
```

---

## Benefícios

1. **Analista consegue resolver** o problema diretamente na tela de análise
2. **Feedback claro** quando dados estão faltando
3. **Não bloqueia o fluxo** de cadastro para casos legítimos
4. **Preserva a flexibilidade** do sistema atual
