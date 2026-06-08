import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';

const Os = OccupancySensing;

export function occupancySensingDefaults(): Partial<OccupancySensing.Attributes> {
    return {
        occupancy: new Os.Occupancy({ occupied: false }),
        occupancySensorType: Os.OccupancySensorType.Pir,
        occupancySensorTypeBitmap: new Os.OccupancySensorTypeBitmap({ pir: true }),
        holdTime: 10,
        holdTimeLimits: { holdTimeMin: 1, holdTimeMax: 300, holdTimeDefault: 10 },
    };
}
