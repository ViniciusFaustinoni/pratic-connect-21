

# Substituir botoes Aprovar/Rejeitar por "Enviar Link de Auto Vistoria" nos cards de Sinistro

## Problema

Nos cards de sinistro na pagina Solicitacoes IA, os botoes "Aprovar" e "Rejeitar" nao refletem o fluxo real. Para sinistros, o primeiro passo e enviar o link de auto vistoria ao associado (com informacao sobre cota de coparticipacao), e nao aprovar diretamente.

## Solucao

### Arquivo: `src/pages/diretoria/SolicitacoesIA.tsx`

**1. Substituir botoes para tipo `sinistro`**

Na secao de botoes de acao (linhas 368-388), separar a logica por tipo:
- **Sinistro**: exibir apenas um botao "Enviar Link de Auto Vistoria (IA)" que chama a acao de aprovar (ja cria o sinistro, gera link e envia WhatsApp)
- **Assistencia, cancelamento, troca_titularidade**: manter os botoes "Aprovar" e "Rejeitar" como estao

```typescript
{solicitacao.status === 'pendente' && (
  <div className="flex gap-3 pt-2">
    {solicitacao.tipo === 'sinistro' ? (
      <Button
        variant="default"
        className="flex-1"
        onClick={() => handleAcao(solicitacao, 'aprovar')}
      >
        <Send className="h-4 w-4 mr-2" />
        Enviar Link de Auto Vistoria (IA)
      </Button>
    ) : (
      <>
        <Button variant="default" className="flex-1" onClick={() => handleAcao(solicitacao, 'aprovar')}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => handleAcao(solicitacao, 'rejeitar')}>
          <XCircle className="h-4 w-4 mr-2" /> Rejeitar
        </Button>
      </>
    )}
  </div>
)}
```

**2. Adicionar informacao de coparticipacao no card de sinistro**

Exibir um alerta informativo no card de sinistro pendente, abaixo dos detalhes, informando sobre a cota de coparticipacao:

```
A IA informara ao associado sobre a cota de coparticipacao ao enviar o link.
```

**3. Atualizar texto do dialog de confirmacao para sinistros**

Quando o tipo for sinistro, o dialog de confirmacao deve exibir texto adequado:
- Titulo: "Enviar Link de Auto Vistoria"
- Descricao: "Isso criara o registro do sinistro e enviara o link de auto vistoria ao associado via WhatsApp, informando sobre a cota de coparticipacao."
- Botao: "Confirmar Envio"

**4. Adicionar icone `Send` ao import do lucide-react**

## Detalhes tecnicos

A edge function `aprovar-solicitacao-ia` ja realiza todas as acoes necessarias ao aprovar um sinistro (cria registro, gera link, envia WhatsApp). A mudanca e apenas visual/textual no frontend para refletir melhor o fluxo.

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/diretoria/SolicitacoesIA.tsx` | Separar botoes por tipo, adicionar info coparticipacao, atualizar dialog, importar Send |

