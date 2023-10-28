export const euclideanRhythm = (steps: number, beats: number): number[] => {
    if (steps < beats || beats <= 0) {
        return [];
    }

    const pattern = new Array(steps).fill(0);
    const pulses = beats;
    const rests = steps - beats;
    const pulsePerRest = Math.floor(rests / pulses);
    let extraPulses = rests % pulses;

    let index = 0;

    for (let i = 0; i < pulses; i++) {
        pattern[index] = 1;
        index += 1;

        if (extraPulses > 0) {
            index += pulsePerRest + 1;
            extraPulses -= 1;
        } else {
            index += pulsePerRest;
        }
    }

    return pattern;
}