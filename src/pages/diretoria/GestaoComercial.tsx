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
import { cn } from '@/lib/utils';

const sectionBanners: Record<number, { title: string; help: string }> = {
  0: { title: 'Planos, Produtos e Preços', help: 'Cadastre planos, vincule produtos e defina a tabela de preços por faixa FIPE.' },
  1: { title: 'Benefícios & Coberturas', help: 'Gerencie benefícios dos cards de venda e coberturas de marketing.' },
  2: { title: 'Adicionais', help: 'Configure benefícios opcionais que o associado contrata por valor extra.' },
  3: { title: 'Simulador de Rateio', help: 'Simule a distribuição de custos entre associados antes de aplicar.' },
  4: { title: 'Configuração do Rateio', help: 'Defina percentuais, tetos, fundo de reserva e variáveis do rateio.' },
  5: { title: 'Elegibilidade', help: 'Controle quais veículos cada plano aceita por marca, modelo e ano.' },
  6: { title: 'Regras de Venda', help: 'Configure limites FIPE, comissões e taxas do processo de venda.' },
  7: { title: 'Instalação e Rotas', help: 'Cadastre bases, parceiros e organize rotas de instalação.' },
  8: { title: 'Mapa de Atendimento', help: 'Visualize a cobertura geográfica e identifique áreas descobertas.' },
};

export default function GestaoComercial() {
  const [activeTab, setActiveTab] = useState(0);
  const isMobile = useIsMobile();
  const banner = sectionBanners[activeTab];

  return (
    <div className="space-y-5">
      <PageHeader />

      {isMobile && <TabNavigation active={activeTab} onChange={setActiveTab} />}

      <div className={cn(
        isMobile ? '' : 'flex border rounded-xl overflow-hidden bg-card shadow-sm min-h-[600px]'
      )}>
        {!isMobile && <TabNavigation active={activeTab} onChange={setActiveTab} />}

        <div className="flex-1 min-w-0">
          {/* Section banner */}
          {banner && (
            <div className="border-b bg-gradient-to-r from-muted/40 to-transparent px-6 py-3.5 flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate">{banner.title}</h2>
                <span className="text-muted-foreground/40">·</span>
                <p className="text-xs text-muted-foreground truncate hidden sm:block">
                  {banner.help}
                </p>
              </div>
              {/* Mobile help tooltip */}
              <div className="sm:hidden" title={banner.help}>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Content area */}
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
