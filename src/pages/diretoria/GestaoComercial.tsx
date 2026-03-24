import { useState } from 'react';
import { PageHeader } from '@/components/gestao-comercial/PageHeader';
import { TabNavigation, allItems } from '@/components/gestao-comercial/TabNavigation';
import { ProdutosPlanos } from '@/components/gestao-comercial/ProdutosPlanos';
import { BeneficiosCoberturas } from '@/components/gestao-comercial/BeneficiosCoberturas';
import { BeneficiosAdicionaisConfig } from '@/components/planos/BeneficiosAdicionaisConfig';
import { SimuladorRateio } from '@/components/gestao-comercial/SimuladorRateio';
import { ElegibilidadeVeiculos } from '@/components/gestao-comercial/ElegibilidadeVeiculos';
import { RegrasVendaContent } from '@/components/gestao-comercial/RegrasVendaContent';
import { InstalacaoRotasConfig } from '@/components/gestao-comercial/InstalacaoRotasConfig';
import RateioConfig from '@/pages/configuracoes/RateioConfig';
import { MapaAtendimento } from '@/components/gestao-comercial/MapaAtendimento';
import { useIsMobile } from '@/hooks/use-mobile';
import { Info } from 'lucide-react';

const sectionBanners: Record<number, { title: string; help: string }> = {
  0: { title: 'Planos, Produtos e Preços', help: 'Aqui você cadastra planos, vincula produtos e define a tabela de preços por faixa FIPE. Comece criando um plano e depois adicione as faixas de preço.' },
  1: { title: 'Benefícios & Coberturas', help: 'Gerencie os benefícios que aparecem nos cards de venda e as coberturas de marketing de cada plano. Arraste para reordenar a prioridade de exibição.' },
  2: { title: 'Adicionais', help: 'Configure benefícios opcionais que o associado pode contratar por um valor extra mensal. Defina nome, valor e quais planos podem oferecer cada adicional.' },
  3: { title: 'Simulador de Rateio', help: 'Simule como os custos são distribuídos entre os associados. Insira os parâmetros e visualize o impacto no valor de cada cota antes de aplicar.' },
  4: { title: 'Configuração do Rateio', help: 'Defina as regras e parâmetros que o sistema usa para calcular o rateio mensal: percentuais, tetos, fundo de reserva e demais variáveis.' },
  5: { title: 'Elegibilidade', help: 'Controle quais veículos cada plano aceita. Defina restrições por marca, modelo, ano e combustível. Veículos fora dos critérios serão bloqueados na cotação.' },
  6: { title: 'Regras de Venda', help: 'Configure os limites de valor FIPE, comissões de vendedores, taxas administrativas e demais parâmetros que governam o processo de venda.' },
  7: { title: 'Instalação e Rotas', help: 'Cadastre os pontos de instalação (bases, parceiros) e organize as rotas de atendimento para vistorias e instalações de rastreadores.' },
  8: { title: 'Mapa de Atendimento', help: 'Visualize no mapa a cobertura geográfica dos seus pontos de atendimento e identifique áreas descobertas para expandir a operação.' },
};

export default function GestaoComercial() {
  const [activeTab, setActiveTab] = useState(0);
  const isMobile = useIsMobile();
  const banner = sectionBanners[activeTab];

  return (
    <div className="space-y-6">
      <PageHeader />

      {isMobile && <TabNavigation active={activeTab} onChange={setActiveTab} />}

      <div className={isMobile ? '' : 'flex gap-0 border rounded-lg overflow-hidden bg-background min-h-[600px]'}>
        {!isMobile && <TabNavigation active={activeTab} onChange={setActiveTab} />}

        <div className="flex-1 min-w-0">
          {banner && (
            <div className="border-b bg-muted/30 px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">{banner.title}</h2>
              <p className="text-sm text-muted-foreground mt-1 flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                {banner.help}
              </p>
            </div>
          )}

          <div className="p-4 lg:p-6">
            {activeTab === 0 && <ProdutosPlanos />}
            {activeTab === 1 && <BeneficiosCoberturas />}
            {activeTab === 2 && <BeneficiosAdicionaisConfig />}
            {activeTab === 3 && <SimuladorRateio />}
            {activeTab === 4 && <RateioConfig />}
            {activeTab === 5 && <ElegibilidadeVeiculos />}
            {activeTab === 6 && <RegrasVendaContent />}
            {activeTab === 7 && <InstalacaoRotasConfig />}
            {activeTab === 8 && <MapaAtendimento />}
          </div>
        </div>
      </div>
    </div>
  );
}
