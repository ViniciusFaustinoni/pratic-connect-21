import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Valores fictícios para preview de templates de documentos.
 * Mapeados por código de variável (sem {{ }}).
 */
const DADOS_FICTICIOS: Record<string, string> = {
  // Associado
  'associado.nome': 'João Carlos da Silva',
  'associado.cpf': '123.456.789-00',
  'associado.rg': '12.345.678-9',
  'associado.telefone': '(11) 98765-4321',
  'associado.whatsapp': '(11) 98765-4321',
  'associado.telefone_secundario': '(11) 3456-7890',
  'associado.email': 'joao.silva@email.com',
  'associado.data_nascimento': '15/03/1985',
  'associado.endereco_completo': 'Rua das Flores, 123, Apto 45 - Jardim América, São Paulo/SP - CEP 01234-567',
  'associado.logradouro': 'Rua das Flores',
  'associado.numero': '123',
  'associado.complemento': 'Apto 45',
  'associado.bairro': 'Jardim América',
  'associado.cidade': 'São Paulo',
  'associado.uf': 'SP',
  'associado.cep': '01234-567',
  'associado.profissao': 'Engenheiro Civil',
  'associado.estado_civil': 'Casado',
  'associado.cnh': '12345678900',
  'associado.cnh_validade': '20/12/2028',
  'associado.cnh_categoria': 'AB',
  'associado.rg_orgao': 'SSP/SP',

  // Indicador
  'indicador.nome': 'Carlos Alberto Pereira',
  'indicador.cpf': '987.654.321-00',
  'indicador.telefone': '(11) 91234-5678',
  'indicador.email': 'carlos.pereira@email.com',

  // Veículo
  'veiculo.marca': 'Toyota',
  'veiculo.modelo': 'Corolla XEi 2.0',
  'veiculo.ano': '2024',
  'veiculo.ano_fabricacao': '2023',
  'veiculo.cor': 'Prata',
  'veiculo.placa': 'ABC1D23',
  'veiculo.chassi': '9BR53ZEC2LB123456',
  'veiculo.renavam': '12345678901',
  'veiculo.valor_fipe': 'R$ 135.000,00',
  'veiculo.codigo_fipe': '015547-0',
  'veiculo.combustivel': 'Flex',
  'veiculo.categoria': 'Particular',
  'veiculo.tipo': 'Automóvel',
  'veiculo.tipo_uso': 'Particular',
  'veiculo.alienado': 'Não',
  'veiculo.financeira': '—',
  'veiculo.procedencia': 'Nacional',
  'veiculo.cambio': 'Automático',
  'veiculo.portas': '4',
  'veiculo.leilao': 'NÃO',
  'veiculo.uso_aplicativo': 'NÃO',
  'veiculo.valor_protegido': 'R$ 135.000,00',

  // Contrato
  'contrato.numero': 'CTR-2025-001234',
  'contrato.valor_adesao': 'R$ 350,00',
  'contrato.valor_mensal': 'R$ 189,90',
  'contrato.dia_vencimento': '10',
  'contrato.data_inicio': format(new Date(), 'dd/MM/yyyy'),
  'contrato.forma_pagamento': 'Boleto Bancário',
  'contrato.primeira_mensalidade': format(new Date(), 'dd/MM/yyyy'),

  // Plano
  'plano.nome': 'Plano Proteção Total',
  'plano.tipo': 'Completo',
  'plano.linha': 'Premium',
  'plano.coberturas': 'Colisão, Roubo/Furto, Incêndio, Fenômenos Naturais',
  'plano.valor_base': 'R$ 189,90',
  'plano.cobertura_fipe': '100%',
  'plano.cota_participacao': '5%',
  'plano.cota_participacao_valor': 'R$ 6.750,00',
  'plano.cota_minima': 'R$ 3.000,00',

  // Consultor
  'consultor.nome': 'Maria Souza',

  // Sistema
  'sistema.data_atual': format(new Date(), 'dd/MM/yyyy'),
  'sistema.data_extenso': format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),

  // Evento
  'evento.protocolo': 'EVT-2025-005678',
  'evento.tipo': 'Colisão',
  'evento.data_ocorrencia': '10/01/2025',
  'evento.local': 'Av. Paulista, 1000 - São Paulo/SP',
  'evento.descricao': 'Colisão traseira em semáforo',
  'evento.parecer': 'Dano parcial aprovado conforme regulamento',
  'evento.valor_aprovado': 'R$ 8.500,00',
  'evento.tipo_dano': 'Parcial',
  'evento.bo_numero': '123/2025',

  // OS
  'os.numero': 'OS-2025-00345',
  'os.data_entrada': '12/01/2025',
  'os.data_conclusao': '25/01/2025',
  'os.data_previsao': '20/01/2025',
  'os.valor_orcamento': 'R$ 9.200,00',
  'os.valor_aprovado': 'R$ 8.500,00',
  'os.observacoes': 'Reparo concluído com sucesso',

  // Oficina
  'oficina.nome': 'Auto Center Silva Ltda.',
  'oficina.cnpj': '12.345.678/0001-90',
  'oficina.telefone': '(11) 3456-7890',
  'oficina.whatsapp': '(11) 93456-7890',
  'oficina.endereco': 'Rua dos Mecânicos, 500 - Vila Industrial, São Paulo/SP',

  // Empresa
  'empresa.nome': 'ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR',
  'empresa.cnpj': '12.345.678/0001-99',
  'empresa.endereco': 'Rua Exemplo, 100 - Centro, São Paulo/SP - CEP 01000-000',
  'empresa.logradouro': 'Rua Exemplo',
  'empresa.numero': '100',
  'empresa.bairro': 'Centro',
  'empresa.cidade': 'São Paulo',
  'empresa.uf': 'SP',
  'empresa.cep': '01000-000',
  'empresa.lgpd_email': 'lgpd@praticcar.com.br',
};

/**
 * Substitui variáveis (chips e patterns {{var}}) por dados fictícios para preview.
 */
export function substituirVariaveisPreview(html: string): string {
  let result = html;

  // 1. Replace variable chip spans: <span data-variable="{{var.code}}">...</span>
  result = result.replace(
    /<span[^>]*data-variable="([^"]*)"[^>]*>[^<]*<\/span>/g,
    (_match, label: string) => {
      const codigo = label.replace(/^\{\{|\}\}$/g, '').trim();
      return DADOS_FICTICIOS[codigo] ?? label;
    }
  );

  // 2. Replace remaining {{var}} text patterns
  result = result.replace(
    /\{\{([^}]+)\}\}/g,
    (_match, inner: string) => {
      const codigo = inner.trim();
      return DADOS_FICTICIOS[codigo] ?? `{{${codigo}}}`;
    }
  );

  return result;
}
