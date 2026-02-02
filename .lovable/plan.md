
# Plano: Corrigir Envio para SGA - Campos RENAVAM e CHASSI Obrigatórios

## ✅ IMPLEMENTADO

### Alterações Realizadas

#### 1. PropostaAnalise.tsx
- Adicionados campos editáveis para RENAVAM e CHASSI no card de dados do veículo
- Alerta visual quando esses campos estão vazios (border-warning)
- Salvamento automático dos dados no veículo antes de aprovar

#### 2. BotaoEnviarSGA.tsx
- Tratamento de erro específico `campo_faltante` com mensagem clara para o usuário

#### 3. UnifiedDocumentUploader.tsx
- Novo prop `veiculoId` para atualização automática
- Após OCR de CRLV, atualiza automaticamente renavam/chassi no veículo

#### 4. usePropostasPendentes.ts
- Adicionados campos `veiculo_renavam` e `veiculo_chassi` à interface PropostaPendente
- Query de veículo agora busca renavam e chassi

---

## Solução Imediata para o Caso Atual

Executar SQL no Cloud View para preencher os dados faltantes manualmente:

```sql
UPDATE veiculos 
SET renavam = 'VALOR_REAL_AQUI',
    chassi = 'VALOR_REAL_AQUI'
WHERE id = '05a11b11-3eb0-48a3-9d7c-120d68f035e9';
```

Após isso, o botão "Enviar para SGA" funcionará normalmente.
