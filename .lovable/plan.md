
# Corrigir status de contratacao para refletir etapa atual

## Problema

Quando o cliente ja esta na etapa de assinatura do contrato (Autentique), o painel administrativo continua mostrando "Enviando Documentos" porque `cotacoes.status_contratacao` fica travado em `dados_preenchidos`.

O fluxo atual:

```text
salvarDadosPessoais() --> status_contratacao = 'dados_preenchidos'
                          etapaAtual = 2 (assinatura)
                          [LACUNA: status nao atualiza]
                          
EtapaAssinaturaContrato:
  - gera contrato
  - envia para Autentique
  - aguarda assinatura
  [status_contratacao continua 'dados_preenchidos']
  
  - SOMENTE apos assinatura --> status_contratacao = 'contrato_assinado'
```

Na tabela admin, `dados_preenchidos` mapeia para "Enviando Documentos", causando confusao.

## Causa raiz

O componente `EtapaAssinaturaContrato.tsx` nunca atualiza `cotacoes.status_contratacao` durante as etapas intermediarias (geracao de contrato, envio ao Autentique, aguardando assinatura). So atualiza ao final, quando a assinatura e concluida.

## Solucao

Atualizar `status_contratacao` para `documentos_ok` no `EtapaAssinaturaContrato.tsx` quando o contrato e gerado e/ou enviado ao Autentique. Isso reflete corretamente que a fase de documentos foi concluida e o processo avancou.

### Alteracoes

**Arquivo:** `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`

1. Apos gerar o contrato com sucesso (linha ~144, depois de `update contrato_gerado_id`), adicionar update do `status_contratacao`:

```typescript
// Apos vincular contrato a cotacao
await publicSupabase
  .from('cotacoes')
  .update({ 
    contrato_gerado_id: contratoId,
    status_contratacao: 'documentos_ok' // Avanca status
  })
  .eq('id', cotacaoId);
```

2. Quando detecta que o contrato ja existe e ja tem link do Autentique (linha ~105-114), tambem garantir que o status esta correto:

```typescript
if (contratoData?.autentique_url) {
  // Garantir que status reflete a etapa correta
  await publicSupabase
    .from('cotacoes')
    .update({ status_contratacao: 'documentos_ok' })
    .eq('id', cotacaoId)
    .in('status_contratacao', ['dados_preenchidos']); // So atualiza se estiver atrasado
  
  setContrato({...});
  setEtapaInterna('aguardando_assinatura');
  return contratoData.id;
}
```

Isso garante que assim que o contrato e gerado/enviado para assinatura, o status avanca de `dados_preenchidos` para `documentos_ok`, que no admin exibe "Escolha de Vistoria" ou pelo menos remove o "Enviando Documentos" enganoso.

### Arquivos alterados

- `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx` (2 pontos de insercao)
