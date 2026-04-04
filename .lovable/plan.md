

# Corrigir Indicador Ausente no Termo de Filiação (Template do Banco)

## Problema
O template do banco de dados (`AF1`) não contém a seção "ASSOCIADO INDICADOR" nem as variáveis `{{indicador.nome}}` / `{{indicador.cpf}}`. Como o sistema prioriza o template do banco sobre o hardcoded, a seção do indicador nunca aparece — mesmo quando os dados existem na cotação.

O template hardcoded tem a seção (linhas 658-673 de `termo-afiliacao-template.ts`), mas ele só é usado como fallback quando não há template no banco.

## Solução
Injetar a seção "ASSOCIADO INDICADOR" dinamicamente no HTML final quando `templateData.indicador?.nome` estiver preenchido, no fluxo do template do banco (`gerarHTMLDoTemplate`). Isso segue o mesmo padrão já usado para injetar aditivos e seção de rastreador.

### `supabase/functions/autentique-create/index.ts`

Na função `gerarHTMLDoTemplate` (após a geração do `conteudoHTML`, antes do return final), adicionar:

```typescript
// Injetar seção de indicador se existir nos dados
if (dados.indicador?.nome) {
  const indicadorHTML = `
  <table class="table-valores" style="margin-top: 15pt; width: 100%; border-collapse: collapse;">
    <tr class="header-row">
      <td colspan="2" style="background-color: #f0f0f0; font-weight: bold; padding: 8px;">ASSOCIADO INDICADOR</td>
    </tr>
    <tr>
      <td style="padding: 6px; border: 1px solid #ddd; width: 30%;">Nome:</td>
      <td style="padding: 6px; border: 1px solid #ddd;">${dados.indicador.nome}</td>
    </tr>
    ${dados.indicador.cpf ? `
    <tr>
      <td style="padding: 6px; border: 1px solid #ddd;">CPF:</td>
      <td style="padding: 6px; border: 1px solid #ddd;">${formatCPF(dados.indicador.cpf)}</td>
    </tr>` : ''}
    ${dados.consultor?.nome ? `
    <tr>
      <td style="padding: 6px; border: 1px solid #ddd;">Consultor:</td>
      <td style="padding: 6px; border: 1px solid #ddd;">${dados.consultor.nome}</td>
    </tr>` : ''}
  </table>`;
  
  // Inserir antes da seção de assinatura ou no final do conteúdo
  conteudoHTML += indicadorHTML;
}
```

Isso garante que o indicador apareça independentemente de o template do banco ter ou não a variável.

### Deploy
Redeployar `autentique-create` após a correção.

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `supabase/functions/autentique-create/index.ts` | Injetar seção indicador no fluxo de template do banco |

