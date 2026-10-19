import type { GeoPoint } from './geodesy';
/** Collision datum, independent of color/land cover and render LOD.
 * This is NOT surveyed elevation, bathymetry, MSL, or a real DEM.
 * Keeps both existing runway elevations exactly zero in simulation units. */
export interface ElevationProvider {
 readonly id: string;
 readonly accuracy: 'approximate' | 'surveyed';
 sampleMeters(point: GeoPoint): number;
}
export const elevation: ElevationProvider = {
 id: 'simplified-sphere-zero-v1', accuracy: 'approximate', sampleMeters: () => 0,
};
