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
import BancoVirtual from './pages/BancoVirtual';
import Categorias from './pages/Categorias';
import Checklists from './pages/Checklists';
import Cofres from './pages/Cofres';
import ContasBancarias from './pages/ContasBancarias';
import ContasPagar from './pages/ContasPagar';
import ContasReceber from './pages/ContasReceber';
import DRE from './pages/DRE';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import Fornecedores from './pages/Fornecedores';
import IAExecutora from './pages/IAExecutora';
import Lojas from './pages/Lojas';
import Movimentacoes from './pages/Movimentacoes';
import MovimentacoesBancarias from './pages/MovimentacoesBancarias';
import NotasFiscais from './pages/NotasFiscais';
import PedidosInternos from './pages/PedidosInternos';
import Produtos from './pages/Produtos';
import Relatorios from './pages/Relatorios';
import Vendas from './pages/Vendas';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AuditoriaDodia": AuditoriaDodia,
    "BancoVirtual": BancoVirtual,
    "Categorias": Categorias,
    "Checklists": Checklists,
    "Cofres": Cofres,
    "ContasBancarias": ContasBancarias,
    "ContasPagar": ContasPagar,
    "ContasReceber": ContasReceber,
    "DRE": DRE,
    "Dashboard": Dashboard,
    "Estoque": Estoque,
    "Fornecedores": Fornecedores,
    "IAExecutora": IAExecutora,
    "Lojas": Lojas,
    "Movimentacoes": Movimentacoes,
    "MovimentacoesBancarias": MovimentacoesBancarias,
    "NotasFiscais": NotasFiscais,
    "PedidosInternos": PedidosInternos,
    "Produtos": Produtos,
    "Relatorios": Relatorios,
    "Vendas": Vendas,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};