/**
 * Detecta o ângulo do rosto usando os 68 landmarks faciais.
 * Retorna { yaw, pitch } em graus estimados.
 * 
 * yaw: rotação horizontal (positivo = virado para direita da pessoa, negativo = esquerda)
 * pitch: rotação vertical (positivo = olhando para cima, negativo = para baixo)
 */
export function estimateFaceAngle(landmarks) {
  const pts = landmarks.positions;
  
  // Pontos-chave do face-api.js 68-landmarks:
  // Nariz ponta: 30
  // Nariz base: 27
  // Olho esquerdo (canto externo): 36, (canto interno): 39
  // Olho direito (canto externo): 45, (canto interno): 42
  // Boca esquerda: 48, boca direita: 54
  // Queixo: 8
  // Testa (nariz bridge top): 27
  
  const noseTip = pts[30];
  const noseBridge = pts[27];
  const leftEyeOuter = pts[36];
  const rightEyeOuter = pts[45];
  const leftMouth = pts[48];
  const rightMouth = pts[54];
  const chin = pts[8];
  
  // === YAW (rotação horizontal) ===
  // Compara a distância do nariz até cada olho externo
  // Se o rosto está virado para a direita (do ponto de vista da pessoa), 
  // o olho esquerdo fica mais longe do nariz que o direito
  const noseToLeftEye = Math.abs(noseTip.x - leftEyeOuter.x);
  const noseToRightEye = Math.abs(noseTip.x - rightEyeOuter.x);
  
  // Normaliza pela distância entre olhos
  const eyeDistance = Math.abs(leftEyeOuter.x - rightEyeOuter.x);
  if (eyeDistance < 1) return { yaw: 0, pitch: 0 };
  
  // Razão: 0.5 = frontal perfeito
  const yawRatio = noseToLeftEye / (noseToLeftEye + noseToRightEye);
  // Converte para graus aproximados (-45 a +45)
  // 0.5 = 0°, 0.3 = ~-25° (virado para a esquerda da pessoa), 0.7 = ~25° (virado para a direita)
  const yaw = (yawRatio - 0.5) * 90;
  
  // === PITCH (rotação vertical) ===
  // Compara a posição vertical do nariz relativa aos olhos e queixo
  const eyeCenterY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
  const faceHeight = chin.y - noseBridge.y;
  if (faceHeight < 1) return { yaw, pitch: 0 };
  
  // Proporção: onde o nariz está entre bridge e chin
  const noseRelPos = (noseTip.y - eyeCenterY) / faceHeight;
  // ~0.45 = frontal. Menor = olhando para cima. Maior = olhando para baixo
  const pitch = (noseRelPos - 0.45) * -80;
  
  return { yaw: Math.round(yaw), pitch: Math.round(pitch) };
}

/**
 * Dado o ângulo do rosto, determina qual "slot" de cadastro está sendo atingido.
 * Retorna o key do ângulo ou null se estiver em posição intermediária.
 */
export function classifyAngle(yaw, pitch) {
  // Faixas de ângulo para cada posição
  // Frontal: yaw ~0, pitch ~0
  if (Math.abs(yaw) < 8 && Math.abs(pitch) < 8) return 'frontal';
  
  // Diagonal esquerda (pessoa vira para sua esquerda = yaw negativo, pois câmera espelha)
  if (yaw < -12 && yaw > -35 && Math.abs(pitch) < 12) return 'diagonal_esq';
  
  // Diagonal direita 
  if (yaw > 12 && yaw < 35 && Math.abs(pitch) < 12) return 'diagonal_dir';
  
  // Levemente acima
  if (pitch > 8 && pitch < 30 && Math.abs(yaw) < 15) return 'levemente_acima';
  
  // Levemente abaixo
  if (pitch < -8 && pitch > -30 && Math.abs(yaw) < 15) return 'levemente_abaixo';
  
  return null; // posição intermediária, não captura
}

/**
 * Progresso circular para UI — retorna de 0 a 1 o quão próximo está do ângulo alvo
 */
export function getAngleProximity(yaw, pitch, targetAngle) {
  const targets = {
    frontal: { yaw: 0, pitch: 0 },
    diagonal_esq: { yaw: -20, pitch: 0 },
    diagonal_dir: { yaw: 20, pitch: 0 },
    levemente_acima: { yaw: 0, pitch: 15 },
    levemente_abaixo: { yaw: 0, pitch: -15 },
  };
  
  const target = targets[targetAngle];
  if (!target) return 0;
  
  const dist = Math.sqrt(Math.pow(yaw - target.yaw, 2) + Math.pow(pitch - target.pitch, 2));
  // Max reasonable distance ~40
  return Math.max(0, Math.min(1, 1 - dist / 40));
}