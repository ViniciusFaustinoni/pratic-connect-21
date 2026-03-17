/**
 * Mapa de dicas explicativas para cada campo do formulário de planos.
 * Cada hint explica o que é o campo e seu impacto na Cotação e na Calculadora.
 */
export const PLAN_FIELD_HINTS: Record<string, string> = {
  // === Aba Básico ===
  name:
    'Nome exibido no card do plano na Cotação e na Calculadora. Deve ser curto e descritivo (ex: "Auto Básico", "Moto Premium").',

  slug:
    'Identificador único interno do plano. Gerado automaticamente a partir do nome. Não pode ser alterado após criação. Usado em URLs e integrações.',

  product_line_id:
    'Linha de produto (ex: Auto, Moto, Caminhão). Na Cotação, os planos são agrupados e filtrados por linha. Na Calculadora, determina quais planos o cliente pode simular.',

  tipo_uso:
    'Define se o plano atende veículos particulares ou de aplicativo (Uber, 99, etc). Na Cotação, só aparecem planos compatíveis com o tipo de uso informado pelo cliente. Na Calculadora, filtra os planos disponíveis.',

  badge_text:
    'Texto de destaque exibido como selo no card (ex: "Mais Vendido", "Melhor Custo-Benefício"). Puramente visual — não afeta cálculos nem filtros na Cotação ou Calculadora.',

  badge_color:
    'Cor do selo/badge exibido no card do plano. Puramente visual — não afeta cálculos.',

  coverage_type:
    'Texto descritivo da cobertura principal (ex: "100% FIPE", "70% FIPE"). Exibido no card do plano na Cotação e na Calculadora como informação de destaque.',

  min_vehicle_year:
    'Ano mínimo aceito pelo plano (ex: "2015+"). Na Cotação e na Calculadora, veículos com ano abaixo desse valor NÃO verão este plano — ele será automaticamente ocultado.',

  linha_slug:
    'Vincula o plano a uma tabela de preços mensais. Sem vínculo, o plano NÃO terá preço calculado e será OCULTADO tanto na Cotação quanto na Calculadora. Campo essencial para o funcionamento.',

  categorias_veiculo:
    'Categorias de veículo aceitas (passeio, moto, diesel, etc). Na Cotação, o plano só aparece se a categoria do veículo do cliente estiver selecionada aqui. Na Calculadora, filtra quais planos são simuláveis.',

  regioes:
    'Regiões geográficas onde o plano está disponível. Na Cotação, se nenhuma região for selecionada, o plano pode NÃO aparecer para clientes de determinadas localidades. Afeta diretamente a disponibilidade.',

  is_active:
    'Quando desativado, o plano fica INVISÍVEL em toda a plataforma: Cotação, Calculadora e painel de gestão. Use para retirar temporariamente um plano sem excluí-lo.',

  // === Aba Cotas ===
  additional_price:
    'Valor fixo (R$) adicionado à mensalidade do plano. Na Cotação e na Calculadora, esse valor é SOMADO ao preço da tabela. Ex: se a tabela marca R$80 e aqui tem R$10, o cliente verá R$90.',

  desconto_percentual:
    'Percentual de desconto sobre o valor mensal final (ex: 5 = 5% OFF). Na Cotação, é exibido como promoção com preço riscado. Na Calculadora, reduz o valor simulado. Deixe 0 para sem desconto.',

  cotas_categoria:
    'Percentual (%) e valor mínimo (R$) da cota de participação para cada categoria de veículo. Usado no cálculo de indenização em caso de sinistro. Se NÃO configurado aqui, o sistema usa o valor de FALLBACK GLOBAL definido nas Configurações do Sistema.',

  cota_percentual:
    'Percentual da cota de participação para esta categoria. Ex: 6% significa que em caso de sinistro, o associado participa com 6% do valor FIPE. Impacta diretamente o cálculo de indenização.',

  cota_minima_valor:
    'Valor mínimo (R$) da cota de participação. Se o percentual resultar em valor menor que este mínimo, prevalece o mínimo. Ex: se 6% de R$15.000 = R$900, mas o mínimo é R$1.200, cobra R$1.200.',

  // === Aba Benefícios ===
  beneficios:
    'Benefícios vinculados a este plano (ex: Guincho, Carro Reserva). Na Cotação, são exibidos como lista no card do plano. Na Calculadora, aparecem como diferenciais. Benefícios destacados (estrela) aparecem em evidência no topo do card.',

  // === Aba Elegibilidade ===
  elegibilidade:
    'Regras de aceitação por marca/modelo. Funciona como WHITELIST RESTRITIVA: se existir pelo menos uma regra, SOMENTE veículos que correspondam a uma regra "Aceito" ou "Limitado" serão aceitos. Modelos não listados são automaticamente NEGADOS tanto na Cotação quanto na Calculadora.',

  elegibilidade_marca:
    'Nome da marca do veículo (ex: VOLKSWAGEN, HONDA). Na Cotação, quando o cliente busca um veículo desta marca, a regra é aplicada. Use "TODOS" para regra genérica.',

  elegibilidade_modelo:
    'Modelo específico (ex: GOL, CIVIC). Se vazio ou "TODOS OS MODELOS", a regra vale para toda a marca. Na Cotação e Calculadora, filtra exatamente quais modelos são aceitos ou negados.',

  elegibilidade_status:
    '"Aceito" = veículo passa na elegibilidade. "Limitado" = aceito com restrições (ex: cobertura reduzida). "Negado" = veículo BLOQUEADO, não aparece na Cotação nem na Calculadora para este plano.',

  elegibilidade_cobertura_fipe:
    'Override de cobertura FIPE específico para esta regra. Ex: para modelos "Limitados", pode-se definir 70% ao invés dos 100% padrão. Na Cotação, o valor de cobertura exibido será este. Na Calculadora, altera o cálculo de indenização.',

  elegibilidade_combustivel:
    'Tipo de combustível aceito pela regra (Flex, Gasolina, Diesel, etc). "Qualquer" aceita todos. Na Cotação, se o combustível do veículo não bater, a regra não se aplica.',

  elegibilidade_ano:
    'Faixa de anos (mín-máx) aceita pela regra. Na Cotação e Calculadora, veículos fora dessa faixa não se enquadram nesta regra específica.',

  elegibilidade_observacao:
    'Nota interna sobre a regra. Não é exibida para o cliente na Cotação — apenas para uso interno da equipe.',

  // === Aba Outros ===
  restriction_alert:
    'Mensagem de alerta exibida em DESTAQUE (com ícone de atenção) no card do plano na Cotação. Usada para avisar sobre restrições especiais (ex: "Não cobre enchente"). Na Calculadora, também aparece como aviso.',

  footer_note:
    'Texto pequeno exibido no rodapé do card do plano na Cotação (ex: "*Sujeito a análise", "Consulte condições"). Informação adicional com asteriscos e condições. Também visível na Calculadora.',

  display_order:
    'Ordem de exibição dos planos na Cotação e na Calculadora. Menor número = aparece PRIMEIRO. Use para priorizar planos mais vendidos ou promocionais no topo da lista.',
};
