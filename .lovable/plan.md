# Plano: Correções nos Fluxos Softruck e SGA Hinova

## ✅ Correções Implementadas

### 1. Fluxo Softruck (`softruck-ativar-dispositivo`)

| Problema | Correção |
|----------|----------|
| **Ativação duplicada** do associado (status = 'ativo') | Removida atualização redundante - delegada ao chamador |
| **Cobertura total** duplicada (`veiculos.cobertura_total = true`) | Removida atualização redundante - delegada ao chamador |
| **Chamada HTTP com anon key** para `ativar-associado` | Corrigido para usar `supabaseServiceKey` |
| **Não verificava** se device já estava ativado | Adicionada verificação de `plataforma_device_id` antes de criar |

### 2. Fluxo SGA Hinova (`sga-hinova-sync`)

| Problema | Correção |
|----------|----------|
| **RENAVAM e CHASSI** não validados | Adicionada validação obrigatória antes de enviar |
| **Placa duplicada** não tratada | Implementada busca por placa existente (similar ao CPF) |
| **Erro genérico** em duplicidade | Retorna mensagem específica com campo faltante |

---

## Arquivos Modificados

- `supabase/functions/softruck-ativar-dispositivo/index.ts`
- `supabase/functions/sga-hinova-sync/index.ts`

---

## Próximos Passos (Opcional)

1. **Timeout para status "sincronizando"**: Implementar job que reseta status travados
2. **Centralizar hook de ativação**: Unificar `useAtivarRastreador`, `useVistoriaCompletaAnalise`, etc.
3. **Feedback visual SGA**: Mostrar toast quando sincronização background falhar
