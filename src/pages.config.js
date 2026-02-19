/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AuditoriaDodia from './pages/AuditoriaDodia';
import Categorias from './pages/Categorias';
import Checklists from './pages/Checklists';
import Cofres from './pages/Cofres';
import Configuracoes from './pages/Configuracoes';
import ContagemTarefa from './pages/ContagemTarefa';
import Dashboard from './pages/Dashboard';
import Empresas from './pages/Empresas';
import FichasTecnicas from './pages/FichasTecnicas';
import Fornecedores from './pages/Fornecedores';
import IAExecutora from './pages/IAExecutora';
import Lojas from './pages/Lojas';
import Manutencao from './pages/Manutencao';
import MovimentacoesBancarias from './pages/MovimentacoesBancarias';
import Notificacoes from './pages/Notificacoes';
import Onboarding from './pages/Onboarding';
import PDVMobile from './pages/PDVMobile';
import PedidosInternos from './pages/PedidosInternos';
import Producao from './pages/Producao';
import Produtos from './pages/Produtos';
import TemplatesContagem from './pages/TemplatesContagem';
import BancoVirtual from './pages/BancoVirtual';
import ContasBancarias from './pages/ContasBancarias';
import ContasReceber from './pages/ContasReceber';
import DRE from './pages/DRE';
import Movimentacoes from './pages/Movimentacoes';
import NotasFiscais from './pages/NotasFiscais';
import Relatorios from './pages/Relatorios';
import Vendas from './pages/Vendas';
import AdminSaaS from './pages/AdminSaaS';
import Estoque from './pages/Estoque';
import Contagens from './pages/Contagens';
import ContasPagar from './pages/ContasPagar';
import Usuarios from './pages/Usuarios';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AuditoriaDodia": AuditoriaDodia,
    "Categorias": Categorias,
    "Checklists": Checklists,
    "Cofres": Cofres,
    "Configuracoes": Configuracoes,
    "ContagemTarefa": ContagemTarefa,
    "Dashboard": Dashboard,
    "Empresas": Empresas,
    "FichasTecnicas": FichasTecnicas,
    "Fornecedores": Fornecedores,
    "IAExecutora": IAExecutora,
    "Lojas": Lojas,
    "Manutencao": Manutencao,
    "MovimentacoesBancarias": MovimentacoesBancarias,
    "Notificacoes": Notificacoes,
    "Onboarding": Onboarding,
    "PDVMobile": PDVMobile,
    "PedidosInternos": PedidosInternos,
    "Producao": Producao,
    "Produtos": Produtos,
    "TemplatesContagem": TemplatesContagem,
    "BancoVirtual": BancoVirtual,
    "ContasBancarias": ContasBancarias,
    "ContasReceber": ContasReceber,
    "DRE": DRE,
    "Movimentacoes": Movimentacoes,
    "NotasFiscais": NotasFiscais,
    "Relatorios": Relatorios,
    "Vendas": Vendas,
    "AdminSaaS": AdminSaaS,
    "Estoque": Estoque,
    "Contagens": Contagens,
    "ContasPagar": ContasPagar,
    "Usuarios": Usuarios,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};