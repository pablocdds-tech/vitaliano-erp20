import { format } from 'date-fns';

export const TIPOS_PONTO = [
  { value: 'entrada', label: 'Entrada', icon: '🟢', color: 'emerald', bgClass: 'bg-emerald-500' },
  { value: 'saida_descanso', label: 'Saída Descanso', icon: '🟡', color: 'amber', bgClass: 'bg-amber-500' },
  { value: 'volta_descanso', label: 'Volta Descanso', icon: '🔵', color: 'blue', bgClass: 'bg-blue-500' },
  { value: 'saida', label: 'Saída', icon: '🔴', color: 'red', bgClass: 'bg-red-500' }
];

export function getTipoLabel(tipo) {
  return TIPOS_PONTO.find(t => t.value === tipo)?.label || tipo;
}

export function getTipoConfig(tipo) {
  return TIPOS_PONTO.find(t => t.value === tipo) || TIPOS_PONTO[0];
}

/**
 * Determina o próximo tipo de marcação baseado nos registros do dia
 */
export function getProximoTipo(pontosHoje) {
  if (!pontosHoje || pontosHoje.length === 0) return 'entrada';
  
  const tipos = pontosHoje.map(p => p.tipo);
  
  if (!tipos.includes('entrada')) return 'entrada';
  if (!tipos.includes('saida_descanso')) return 'saida_descanso';
  if (!tipos.includes('volta_descanso')) return 'volta_descanso';
  return 'saida';
}

/**
 * Determina próximo tipo baseado no status_atual do FuncionarioPonto
 */
export function getProximoTipoPorStatus(statusAtual, pontosHoje) {
  if (!statusAtual || statusAtual === 'fora') return 'entrada';
  
  if (statusAtual === 'trabalhando') {
    // Se já fez descanso hoje, é saída final
    const tipos = (pontosHoje || []).map(p => p.tipo);
    if (tipos.includes('saida_descanso') && tipos.includes('volta_descanso')) {
      return 'saida';
    }
    return 'saida_descanso';
  }
  
  if (statusAtual === 'descanso') return 'volta_descanso';
  
  return 'entrada';
}

/**
 * Calcula novo status baseado no tipo de marcação
 */
export function getNovoStatus(tipo) {
  switch (tipo) {
    case 'entrada': return 'trabalhando';
    case 'saida_descanso': return 'descanso';
    case 'volta_descanso': return 'trabalhando';
    case 'saida': return 'fora';
    default: return 'fora';
  }
}

/**
 * Mensagem de confirmação contextual
 */
export function getMensagemConfirmacao(tipo, nome) {
  const primeiroNome = nome?.split(' ')[0] || 'Colaborador';
  switch (tipo) {
    case 'entrada': return `Bom trabalho, ${primeiroNome}! Entrada registrada.`;
    case 'saida_descanso': return `Bom descanso, ${primeiroNome}!`;
    case 'volta_descanso': return `Bem-vindo de volta, ${primeiroNome}!`;
    case 'saida': return `Até amanhã, ${primeiroNome}!`;
    default: return `Ponto registrado!`;
  }
}

/**
 * Calcula minutos trabalhados a partir dos registros do dia
 */
export function calcularMinutosTrabalhados(pontosDoDia) {
  if (!pontosDoDia || pontosDoDia.length === 0) return 0;
  
  const sorted = [...pontosDoDia].sort((a, b) => new Date(a.horario) - new Date(b.horario));
  let minutos = 0;
  let inicio = null;

  for (const p of sorted) {
    if (p.tipo === 'entrada' || p.tipo === 'volta_descanso') {
      inicio = new Date(p.horario);
    } else if ((p.tipo === 'saida_descanso' || p.tipo === 'saida') && inicio) {
      minutos += (new Date(p.horario) - inicio) / 60000;
      inicio = null;
    }
  }

  // Se ainda está trabalhando (sem saída), conta até agora
  if (inicio) {
    minutos += (new Date() - inicio) / 60000;
  }

  return Math.round(minutos);
}

export function formatarMinutos(min) {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  const sinal = min < 0 ? '-' : '';
  return `${sinal}${h}h${String(m).padStart(2, '0')}min`;
}