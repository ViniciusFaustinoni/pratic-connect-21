
# Botoes de Aprovar/Recusar para Analista de Eventos e Novo Fluxo Pos-Aprovacao

## Resumo

Atualmente, somente diretores podem aprovar ou reprovar sinistros. O analista de eventos ve apenas uma mensagem informativa. Este plano adiciona os botoes "Aprovar Evento" e "Recusar Evento" para o analista quando a auto-vistoria e a vistoria do regulador estiverem concluidas (status `aguardando_analise`). Alem disso, o botao "Enviar para Oficina" sera atualizado para filtrar oficinas pela marca do veiculo ou GLOBAL.

## Alteracoes

### 1. Exibir botoes Aprovar/Recusar para o Analista de Eventos

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx` (linhas ~1217-1270)

Condicao atual (linhas 1225-1269):
- `isDiretor && !temDocsPendentes` → mostra botoes Aprovar/Reprovar
- `!isDiretor && isAnalistaEventos` → mostra apenas mensagem informativa

Nova logica:
- Quando o status for `aguardando_analise` (vistoria do regulador concluida), o analista de eventos (`isAnalistaEventos`) tambem vera os botoes "Aprovar Evento" e "Recusar Evento", pois isso indica que tanto a auto-vistoria quanto a vistoria do regulador foram realizadas
- Quando o status for `comunicado` ou `aberto`, manter comportamento atual (somente diretor envia link de auto-vistoria)
- Para os demais status, manter a mensagem informativa para analistas

### 2. Atualizar "Enviar para Oficina" com filtro por marca

**Arquivo:** `src/components/sinistros/EnviarParaOficinaDialog.tsx`

Alteracoes:
- Receber a `marca` do veiculo como prop
- Passar `marca` para o hook `useOficinas` para filtrar oficinas que atendam aquela marca ou sejam GLOBAL
- Manter selecao de apenas UMA oficina (ja e assim)
- Exibir as especialidades e cidade de cada oficina para facilitar a escolha

### 3. Passar marca do veiculo ao dialog

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

- Ao renderizar `<EnviarParaOficinaDialog>`, passar a marca do veiculo como nova prop

## Fluxo completo apos as alteracoes

```text
1. Associado faz auto-vistoria (3 etapas) → status em_analise
2. Analista envia link de agendamento da vistoria do regulador
3. Regulador conclui vistoria → status aguardando_analise
4. Analista ve dados da vistoria + botoes "Aprovar Evento" / "Recusar Evento"
5. Analista aprova → edge function aprovar-sinistro:
   - Gera cobranca ASAAS
   - Envia link de pagamento ao associado via WhatsApp
6. Associado paga (PIX ou Cartao) → status pagamento_confirmado
7. Sistema envia Termo de Entrada (Autentique)
8. Associado assina → status pronto_para_oficina
9. Analista ve botao "Enviar para Oficina" (filtrado por marca/GLOBAL)
10. Seleciona oficina → cria OS
```

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar botoes Aprovar/Recusar para analista quando status=aguardando_analise; passar marca ao EnviarParaOficinaDialog |
| `src/components/sinistros/EnviarParaOficinaDialog.tsx` | Receber prop `marca` e filtrar oficinas por marca/GLOBAL |

## Detalhes tecnicos

### Condicao para exibir botoes ao analista

```text
// Analista pode aprovar/reprovar quando:
// 1. Vistoria do regulador foi concluida (status aguardando_analise)
// 2. OU diretor (em qualquer status, como ja funciona)
const analistaPodeDecidir = isAnalistaEventos && sinistro.status === 'aguardando_analise';

if ((isDiretor || analistaPodeDecidir) && !temDocsPendentes) {
  // Mostrar botoes Aprovar e Reprovar
}
```

### Filtro de oficinas por marca

O hook `useOficinas` ja suporta o filtro `marca` que faz:
```text
query.or(`marcas_atendidas.cs.{MARCA},marcas_atendidas.cs.{GLOBAL}`)
```

Basta passar `{ status: 'ativo', marca: veiculo?.marca }` ao invocar o hook no `EnviarParaOficinaDialog`.
