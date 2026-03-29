/**
 * Detecta o ângulo do rosto usando os 68 landmarks faciais.
 * Retorna { yaw, pitch } em graus estimados.
 * 
 * yaw: rotação horizontal (positivo = virado para direita da pessoa, negativo = esquerda)
 * pitch: rotação vertical (positivo = olhando para cima, negativo = para baixo)
 */
export function estimateFaceAngle(landmarks) {
  const pts = landmarks.positions;
  
  const noseTip = pts[30];
  const noseBridge = pts[27];
  const leftEyeOuter = pts[36];
  const rightEyeOuter = pts[45];
  const chin = pts[8];
  
  // === YAW (rotação horizontal) ===
  const noseToLeftEye = Math.abs(noseTip.x - leftEyeOuter.x);
  const noseToRightEye = Math.abs(noseTip.x - rightEyeOuter.x);
  
  const eyeDistance = Math.abs(leftEyeOuter.x - rightEyeOuter.x);
  if (eyeDistance < 1) return { yaw: 0, pitch: 0 };
  
  const yawRatio = noseToLeftEye / (noseToLeftEye + noseToRightEye);
  const yaw = (yawRatio - 0.5) * 90;
  
  // === PITCH (rotação vertical) ===
  const eyeCenterY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
  const faceHeight = chin.y - noseBridge.y;
  if (faceHeight < 1) return { yaw, pitch: 0 };
  
  const noseRelPos = (noseTip.y - eyeCenterY) / faceHeight;
  const pitch = (noseRelPos - 0.45) * -80;
  
  return { yaw: Math.round(yaw), pitch: Math.round(pitch) };
}

/**
 * Classifica o ângulo atual do rosto.
 * Faixas AMPLAS e SEM zonas mortas para facilitar a captura.
 */
export function classifyAngle(yaw, pitch) {
  // Frontal: rosto razoavelmente centrado
  if (Math.abs(yaw) < 10 && Math.abs(pitch) < 12) return 'frontal';
  
  // Esquerda: qualquer yaw negativo relevante
  if (yaw < -8 && Math.abs(pitch) < 18) return 'diagonal_esq';
  
  // Direita: qualquer yaw positivo relevante
  if (yaw > 8 && Math.abs(pitch) < 18) return 'diagonal_dir';
  
  return null;
}

/**
 * Progresso circular para UI — retorna de 0 a 1 o quão próximo está do ângulo alvo
 */
export function getAngleProximity(yaw, pitch, targetAngle) {
  const targets = {
    frontal: { yaw: 0, pitch: 0 },
    diagonal_esq: { yaw: -18, pitch: 0 },
    diagonal_dir: { yaw: 18, pitch: 0 },
  };
  
  const target = targets[targetAngle];
  if (!target) return 0;
  
  const dist = Math.sqrt(Math.pow(yaw - target.yaw, 2) + Math.pow(pitch - target.pitch, 2));
  return Math.max(0, Math.min(1, 1 - dist / 35));
}