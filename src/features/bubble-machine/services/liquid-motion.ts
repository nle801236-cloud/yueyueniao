import type { ElementItem, LiquidFilterFrame, LiquidSettings } from '../types';

export const computeLiquidFiltersAtTime = (
  elements: ElementItem[],
  liquidSettings: LiquidSettings,
  sampleTime: number,
): LiquidFilterFrame[] => {
  if (!liquidSettings.enabled) return [];

  return elements.map((el) => {
    const profile = el.liquidProfile;
    const animatedTime = sampleTime * liquidSettings.speed;
    const viscosity = liquidSettings.viscosity * profile.viscosityFactor;
    const baseFreqX = 0.008 + (1.1 - viscosity) * 0.01;
    const baseFreqY = 0.012 + (1.1 - viscosity) * 0.015;
    const waveScale = liquidSettings.waveScale * profile.waveFactor;
    const phase = profile.phaseOffset;
    const glossiness = liquidSettings.glossiness * profile.glossFactor;
    const driftX = Math.cos(profile.driftAngle) * profile.driftStrength;
    const driftY = Math.sin(profile.driftAngle) * profile.driftStrength;
    const masterPulse = Math.sin(animatedTime * 0.9);
    const masterWobble = Math.cos(animatedTime * 1.15);
    const masterSqueeze = Math.sin(animatedTime * 1.35);
    const orbitA = animatedTime * 0.21 + phase + profile.directionBias * 0.9;
    const orbitB = animatedTime * -0.17 + phase * 0.63 + driftX * 0.45;
    const orbitC = animatedTime * 0.29 - phase * 0.48 + driftY * 0.52;
    const flowX = Math.cos(orbitA) * (0.52 + profile.swirlMix * 0.16)
      + Math.sin(orbitB) * (0.33 + profile.wobbleBias * 0.12)
      + Math.cos(orbitC) * (0.21 + profile.pulseBias * 0.08);
    const flowY = Math.sin(orbitA + 0.8) * (0.5 + profile.swirlMix * 0.14)
      - Math.cos(orbitB - 0.6) * (0.31 + profile.wobbleBias * 0.11)
      + Math.sin(orbitC + 1.2) * (0.24 + profile.stretchBias * 0.08);
    const curlX = Math.sin(animatedTime * 0.47 + phase * 1.2) * 0.0009 + Math.cos(animatedTime * 0.31 - phase * 0.7) * 0.0007;
    const curlY = Math.cos(animatedTime * 0.43 + phase * 1.1) * 0.0009 - Math.sin(animatedTime * 0.27 - phase * 0.5) * 0.0007;
    let directionalFreqX = baseFreqX + profile.freqXOffset + flowX * 0.0012 + curlX;
    let directionalFreqY = baseFreqY + profile.freqYOffset + flowY * 0.0012 + curlY;
    let displacementScale = 120 * waveScale * viscosity * profile.amplitudeFactor;

    if (liquidSettings.mode === 'classic') {
      const classicSpeed = liquidSettings.speed * (0.75 + profile.viscosityFactor * 0.25);
      const classicAmplitude = liquidSettings.waveScale * (0.72 + profile.amplitudeFactor * 0.28);
      const phaseA = animatedTime * classicSpeed * 0.92 + phase;
      const phaseB = animatedTime * classicSpeed * 0.68 + phase * 0.85;
      directionalFreqX = baseFreqX + Math.sin(phaseA * 0.5) * 0.002 + profile.freqXOffset * 0.7;
      directionalFreqY = baseFreqY + Math.cos(phaseB * 0.4) * 0.002 + profile.freqYOffset * 0.7;
      displacementScale = 130 * liquidSettings.viscosity * classicAmplitude * (0.38 + Math.sin(animatedTime * classicSpeed + phase) * 0.62);
    } else if (liquidSettings.mode === 'liquid') {
      const streamX = Math.sin(animatedTime * 0.38 + phase * 0.9) * (0.001 + 0.00035 * Math.abs(driftX)) + flowY * 0.00055;
      const streamY = Math.cos(animatedTime * 0.34 - phase * 0.75) * (0.001 + 0.00035 * Math.abs(driftY)) - flowX * 0.00055;
      directionalFreqX += streamX;
      directionalFreqY += streamY;
      displacementScale *= masterPulse * (0.5 + 0.14 * profile.swirlMix)
        + masterWobble * (0.2 + 0.1 * profile.wobbleBias)
        + Math.sin(animatedTime * 0.62 + phase * 1.15) * 0.18
        + Math.cos(animatedTime * 0.41 - phase * 0.8) * 0.12;
    } else if (liquidSettings.mode === 'bubble') {
      const buoyancy = -0.0017 * (0.9 + profile.pulseBias * 0.16);
      const bubbleOrbitX = Math.sin(animatedTime * 0.52 + phase) * (0.0008 + 0.00025 * profile.directionBias) + flowX * 0.00042;
      const bubbleOrbitY = Math.cos(animatedTime * 0.46 + phase * 0.85) * 0.00055 + buoyancy + flowY * 0.00028;
      const skinShiver = Math.cos(animatedTime * 1.36 + phase * 1.25) * 0.00035;
      directionalFreqX += bubbleOrbitX + skinShiver;
      directionalFreqY += bubbleOrbitY;
      displacementScale *= masterPulse * (0.62 + 0.12 * profile.pulseBias) + Math.abs(masterWobble) * (0.16 + 0.06 * profile.wobbleBias) + 0.1;
      directionalFreqX *= 0.95;
      directionalFreqY *= 0.92;
    } else {
      const squashOrbitX = flowX * 0.00065 + masterSqueeze * (0.0016 + profile.stretchBias * 0.00045);
      const squashOrbitY = flowY * 0.00052 - masterSqueeze * (0.0011 + profile.wobbleBias * 0.0004);
      directionalFreqX += squashOrbitX + profile.directionBias * 0.0009;
      directionalFreqY += squashOrbitY - profile.directionBias * 0.00065;
      displacementScale *= masterSqueeze * (0.6 + 0.15 * profile.stretchBias) + masterWobble * (0.16 + 0.08 * profile.wobbleBias) + Math.sin(animatedTime * 0.74 + phase * 0.95) * 0.12;
    }

    return {
      id: el.id,
      baseFrequency: `${directionalFreqX} ${directionalFreqY}`,
      displacementScale,
      glossiness,
    };
  });
};
