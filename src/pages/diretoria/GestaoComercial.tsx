import { useState } from 'react';
import { PageHeader } from '@/components/gestao-comercial/PageHeader';
import { TabNavigation } from '@/components/gestao-comercial/TabNavigation';
import { CatalogoCoberturasBeneficios } from '@/components/gestao-comercial/CatalogoCoberturasBeneficios';
import { LinhasPlanos } from '@/components/gestao-comercial/LinhasPlanos';
import { SimuladorRateio } from '@/components/gestao-comercial/SimuladorRateio';
import { ElegibilidadeVeiculos } from '@/components/gestao-comercial/ElegibilidadeVeiculos';
import { RegrasVendaContent } from '@/components/gestao-comercial/RegrasVendaContent';
import { InstalacaoRotasConfig } from '@/components/gestao-comercial/InstalacaoRotasConfig';
import RateioConfig from '@/pages/configuracoes/RateioConfig';
import { CadastrosBase } from '@/components/gestao-comercial/CadastrosBase';
import { MarcasModelosCombustiveis } from '@/components/gestao-comercial/MarcasModelosCombustiveis';
import { useIsMobile } from '@/hooks/use-mobile';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const sectionBanners: Record<number, { title: string; help: string }> = {
  0: { title: 'Coberturas e Benefícios', help: 'Catálogo global de coberturas e benefícios com valores. Vincule aos planos na seção Linhas e Planos.' },
  1: { title: 'Linhas e Planos', help: 'Gerencie linhas de produto e monte planos selecionando coberturas e benefícios.' },
  2: { title: 'Simulador de Rateio', help: 'Simule a distribuição de custos entre associados antes de aplicar.' },
  3: { title: 'Configuração do Rateio', help: 'Defina percentuais, tetos, fundo de reserva e variáveis do rateio.' },
  4: { title: 'Elegibilidade', help: 'Controle quais veículos cada plano aceita por marca, modelo e ano.' },
  5: { title: 'Regras de Venda', help: 'Configure limites FIPE, comissões e taxas do processo de venda.' },
  6: { title: 'Instalação e Rotas', help: 'Cadastre bases, parceiros e organize rotas de instalação.' },
  7: { title: 'Tabelas de Apoio', help: 'Gerencie categorias de veículo, regiões, tipos de uso e tipos de placa.' },
  8: { title: 'Marcas e Modelos', help: 'Cadastre marcas e modelos de veículos com importação em lote.' },
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
          {banner && (
            <div className="border-b bg-gradient-to-r from-muted/40 to-transparent px-6 py-3.5 flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate">{banner.title}</h2>
                <span className="text-muted-foreground/40">·</span>
                <p className="text-xs text-muted-foreground truncate hidden sm:block">{banner.help}</p>
              </div>
              <div className="sm:hidden" title={banner.help}>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}

          <div className="p-4 lg:p-6">
            {activeTab === 0 && <CatalogoCoberturasBeneficios />}
            {activeTab === 1 && <LinhasPlanos />}
            {activeTab === 2 && <SimuladorRateio />}
            {activeTab === 3 && <RateioConfig />}
            {activeTab === 4 && <ElegibilidadeVeiculos />}
            {activeTab === 5 && <RegrasVendaContent />}
            {activeTab === 6 && <InstalacaoRotasConfig />}
            {activeTab === 7 && <CadastrosBase />}
            {activeTab === 8 && <MarcasModelosCombustiveis />}
          </div>
        </div>
      </div>
    </div>
  );
}
