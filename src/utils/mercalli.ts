/**
 * Utility for estimating Modified Mercalli Intensity (MMI).
 */

export interface MercalliEstimation {
  intensityValue: number;
  romanNumeral: string;
  description: string;
}

/**
 * Estimates the Modified Mercalli Intensity (MMI) based on magnitude and distance.
 * This is a simplified empirical formula based on Gutenberg-Richter / attenuation relationships.
 * I = 1.5 * (M - 1.5) - log10(R) (Rough estimation for shallow crustal earthquakes)
 *
 * @param magnitude Richter or Moment magnitude
 * @param distanceKm Distance from epicenter in kilometers
 * @returns Estimated MMI value (1 to 12)
 */
export function estimateMercalli(magnitude: number, distanceKm: number): MercalliEstimation {
  // Prevent log(0) or log of very small distances by assuming a minimum hypocentral depth of ~10km
  const effectiveDistance = Math.max(10, Math.sqrt(distanceKm * distanceKm + 100));
  
  let intensity = 1.5 * (magnitude - 1.5) - 1.5 * Math.log10(effectiveDistance) + 3.0;

  // Bound between 1 and 12
  intensity = Math.max(1, Math.min(12, Math.round(intensity)));

  return {
    intensityValue: intensity,
    romanNumeral: getRomanNumeral(intensity),
    description: getMercalliDescription(intensity),
  };
}

function getRomanNumeral(intensity: number): string {
  const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return numerals[intensity - 1] || "I";
}

function getMercalliDescription(intensity: number): string {
  switch (intensity) {
    case 1:
      return "NO SENTIDO";
    case 2:
    case 3:
      return "DÉBIL";
    case 4:
      return "LIGERO";
    case 5:
      return "MODERADO";
    case 6:
      return "FUERTE";
    case 7:
      return "MUY FUERTE";
    case 8:
      return "SEVERO";
    case 9:
      return "VIOLENTO";
    case 10:
    case 11:
    case 12:
      return "EXTREMO";
    default:
      return "DESCONOCIDO";
  }
}
