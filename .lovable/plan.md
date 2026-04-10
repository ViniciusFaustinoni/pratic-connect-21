

## Plano: Adicionar WhatsApp e endereço ao modal de manutenção

### Situação atual
O modal `AgendarManutencaoUnificadoModal` já:
- Busca dados completos do associado (telefone, whatsapp, endereço)
- Tem calendário com agendamento, período e encaixe
- Cria serviço tipo `vistoria_manutencao` que já aparece no mapa (seção "SERVICOS DIRETOS" da view) e nas atribuições

O problema é que a seção de dados do associado (linhas 322-327) mostra apenas nome e telefone em texto simples, sem botão WhatsApp e sem endereço.

### Mudança (1 arquivo)

**`src/components/monitoramento/rastreadores/AgendarManutencaoUnificadoModal.tsx`**

Expandir a seção do associado (linhas 322-327) para incluir:
- Telefone clicável (`tel:`) com ícone `Phone`
- Botão WhatsApp verde (abrindo `wa.me/55{whatsapp||telefone}`)
- WhatsApp separado se diferente do telefone
- Endereço completo com ícone `MapPin` (logradouro, numero, bairro, cidade/UF, CEP)

Adicionar imports: `Phone`, `MapPin` (já importa `MessageCircle`)

Padrão idêntico ao já implementado no `AbrirRetiradaModal.tsx` (linhas 348-406).

### Resultado
O coordenador ao clicar "Enviar para Manutenção" verá o mesmo nível de informação do modal de retirada: contatos com WhatsApp direto, endereço completo, e calendário de agendamento. O serviço criado já aparece automaticamente no mapa, atribuições automáticas/manuais e serviços de campo.

