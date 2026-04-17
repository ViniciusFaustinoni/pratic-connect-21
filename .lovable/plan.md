

## Resumo do que muda

Adicionar em agências um **modo de recebimento**:
- **Via Comissão** (padrão atual): tudo continua como hoje (ASAAS, adesão, cobranças).
- **Em Mãos** (novo): contrato segue normalmente (status, cobertura, instalação), **mas sem gerar cobrança de adesão no ASAAS nem exigir pagamento do associado**. O valor da venda é apenas registrado para cálculo/relatório.

## Quem pode mudar
Diretor (regra já usada em outros toggles sensíveis). Alteração feita na tela de edição de usuário tipo Agência.

## Mudanças

### 1. Banco (migration)
- `profiles`: nova coluna `agencia_forma_recebimento text default 'comissao'` com check `in ('comissao','em_maos')`. Só tem efeito quando `tipo='agencia'`.
- `contratos`: nova coluna `adesao_isenta_agencia boolean default false` — marca contratos vendidos por agência em modo "em mãos" (para relatórios/auditoria e para pular ASAAS).

### 2. Edge function `asaas-cobranca-adesao`
No início, depois de buscar o contrato, verificar se o vendedor é agência em modo `em_maos`:
```ts
const { data: contrato } = supabase.from('contratos')
  .select('vendedor_id, cotacao:cotacoes(vendedor_id)').eq('id', contratoId).single();
const vendedorId = contrato.vendedor_id ?? contrato.cotacao?.vendedor_id;
if (vendedorId) {
  const { data: vendedor } = supabase.from('profiles')
    .select('tipo, agencia_forma_recebimento').eq('user_id', vendedorId).maybeSingle();
  if (vendedor?.tipo === 'agencia' && vendedor.agencia_forma_recebimento === 'em_maos') {
    // marcar contrato como isento e pago, criar instalação, retornar sucesso sem chamar ASAAS
    await supabase.from('contratos').update({
      adesao_isenta_agencia: true,
      adesao_paga: true,
      adesao_paga_em: new Date().toISOString(),
    }).eq('id', contratoId);
    return jsonResponse({ success: true, isento: true, agencia_em_maos: true });
  }
}
```
(Reutiliza exatamente o mesmo caminho de "adesão zerada" que já existe no front — `EtapaPagamentoCotacao.tsx` linha 217-251.)

### 3. Fluxo público `EtapaPagamentoCotacao.tsx`
Antes de abrir a tela de cobrança, consultar (via `publicSupabase`) se o contrato já tem `adesao_isenta_agencia=true` OU detectar pelo `vendedor_id` da cotação. Se sim, seguir o mesmo branch de adesão zerada: marca pago, dispara `criar-instalacao-pos-pagamento` com `skipPaymentCheck:true`, mostra tela de sucesso ("Sua adesão foi confirmada pela agência responsável") e avança.

### 4. UI de edição de Agência (`UsuarioForm.tsx` / `UsuarioEditar.tsx`)
Quando `tipo === 'agencia'` e usuário logado é diretor, mostrar RadioGroup:
- ( ) Recebe via Comissão (padrão)
- ( ) Recebe em Mãos (adesão não é cobrada do associado)

Texto explicativo abaixo: *"Em 'Recebe em Mãos', o sistema registra o valor da venda normalmente, mas não gera cobrança de adesão no ASAAS — a agência é responsável por receber diretamente do associado."*

### 5. Indicadores visuais
- Card da cotação/contrato: badge "Adesão Direta c/ Agência" quando `adesao_isenta_agencia=true` (em vez de "Paga"/"Pendente").
- Painel da agência: mostrar o modo atual em destaque.

### 6. Comissão
A grade de comissão atual da agência continua funcionando igual — o valor da venda é computado normalmente (contrato tem `valor_mensal`, `valor_adesao` etc.). O que muda é apenas a **não-geração** da cobrança de adesão no ASAAS. Se a política futura for não pagar comissão sobre adesão em modo "em mãos", isso fica para outra iteração.

## Validação

1. Logar como diretor → editar uma agência existente → alternar para "Recebe em Mãos" → salvar.
2. Criar cotação com essa agência como vendedor → finalizar fluxo público até a etapa de pagamento.
3. Resultado esperado: tela de pagamento exibe "Adesão confirmada pela agência" (sem PIX/boleto), contrato vai para `ativo`, instalação é agendada, associado fica ativo.
4. Comparar com outra cotação de agência em modo "Comissão" → fluxo ASAAS normal.
5. Relatório financeiro: contratos "em mãos" aparecem com flag visível.

## Arquivos a editar
- Migration SQL (nova)
- `supabase/functions/asaas-cobranca-adesao/index.ts`
- `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx`
- `src/pages/configuracoes/UsuarioForm.tsx` (ou `UsuarioEditar.tsx`, confirmar qual é usada para agência)
- `src/components/cotacoes/CotacaoCard.tsx` e `src/pages/vendas/ContratoDetalhe.tsx` (badge visual)

