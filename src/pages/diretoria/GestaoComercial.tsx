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
import { CadastrosBase } from '@/components/gestao-comercial/CadastrosBase';
import { LinhasTab } from '@/components/admin/planos/LinhasTab';
import { useIsMobile } from '@/hooks/use-mobile';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const sectionBanners: Record<number, { title: string; help: string }> = {
  0: { title: 'Planos, Produtos e Preços', help: 'Cadastre planos, vincule produtos e defina a tabela de preços por faixa FIPE.' },
  1: { title: 'Linhas de Produto', help: 'Gerencie as linhas (categorias) dos seus planos: crie, edite, ordene e ative/desative.' },
  2: { title: 'Coberturas & Benefícios', help: 'Catálogo global de coberturas e benefícios. Vincule aos planos em Planos & Preços.' },
  3: { title: 'Adicionais', help: 'Configure benefícios opcionais que o associado contrata por valor extra.' },
  4: { title: 'Simulador de Rateio', help: 'Simule a distribuição de custos entre associados antes de aplicar.' },
  5: { title: 'Configuração do Rateio', help: 'Defina percentuais, tetos, fundo de reserva e variáveis do rateio.' },
  6: { title: 'Elegibilidade', help: 'Controle quais veículos cada plano aceita por marca, modelo e ano.' },
  7: { title: 'Regras de Venda', help: 'Configure limites FIPE, comissões e taxas do processo de venda.' },
  8: { title: 'Instalação e Rotas', help: 'Cadastre bases, parceiros e organize rotas de instalação.' },
  9: { title: 'Mapa de Atendimento', help: 'Visualize a cobertura geográfica e identifique áreas descobertas.' },
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
            {activeTab === 1 && <LinhasTab />}
            {activeTab === 2 && <BeneficiosCoberturas />}
            {activeTab === 3 && <BeneficiosAdicionaisConfig />}
            {activeTab === 4 && <SimuladorRateio />}
            {activeTab === 5 && <RateioConfig />}
            {activeTab === 6 && <ElegibilidadeVeiculos />}
            {activeTab === 7 && <RegrasVendaContent />}
            {activeTab === 8 && <InstalacaoRotasConfig />}
            {activeTab === 9 && <MapaAtendimento />}
          </div>
        </div>
      </div>
    </div>
  );
}
