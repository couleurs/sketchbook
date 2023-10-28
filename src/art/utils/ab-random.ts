import type { RandomFn } from "simplex-noise";

class Random {
    private useA: boolean;
    private _hasNextG: boolean;
    private _nextG: number;
    private prngA: Function;
    private prngB: Function;
    public prng: RandomFn;

    constructor(startingHash: string) {
        this.useA = false;
        const sfc32 = function (uint128Hex: string) {
            let a = parseInt(uint128Hex.substr(0, 8), 16);
            let b = parseInt(uint128Hex.substr(8, 8), 16);
            let c = parseInt(uint128Hex.substr(16, 8), 16);
            let d = parseInt(uint128Hex.substr(24, 8), 16);
            return function () {
                a |= 0; b |= 0; c |= 0; d |= 0;
                let t = (((a + b) | 0) + d) | 0;
                d = (d + 1) | 0;
                a = b ^ (b >>> 9);
                b = (c + (c << 3)) | 0;
                c = (c << 21) | (c >>> 11);
                c = (c + t) | 0;
                return (t >>> 0) / 4294967296;
            };
        };

        // seed prngA with first half of tokenData.hash
        this.prngA = new (sfc32 as any)(startingHash.substr(2, 32));
        // seed prngB with second half of startingHash
        this.prngB = new (sfc32 as any)(startingHash.substr(34, 32));

        this.prng = new (sfc32 as any)(startingHash);

        for (let i = 0; i < 1e6; i += 2) {
            this.prngA();
            this.prngB();
        }

        this._hasNextG = false;
        this._nextG = 0;
    }
    // random number between 0 (inclusive) and 1 (exclusive)
    r() {
        this.useA = !this.useA;
        return this.useA ? this.prngA() : this.prngB();
    }
    r_input(input: number) {
        return Math.sin(input) * 43758.5453 % 1;
    }
    // random number between a (inclusive) and b (exclusive)
    rn(a: number, b: number) {
        return a + (b - a) * this.r();
    }
    // random integer between a (inclusive) and b (inclusive)
    // requires a < b for proper probability distribution
    ri(a: number, b: number) {
        return Math.floor(this.rn(a, b + 1));
    }
    // random boolean with p as percent liklihood of true
    rb(p: number) {
        return this.r() < p;
    }
    // random value in an array of items
    rc(list: any[]) {
        return list[this.ri(0, list.length - 1)];
    }

    ra() {
        return this.rn(0, 2 * Math.PI);
    }

    rcw(items: any[], weights: number[]) {
        // https://github.com/trekhleb/javascript-algorithms/blob/master/src/algorithms/statistics/weighted-random/weightedRandom.js
        if (items.length !== weights.length) {
            console.log('Items and weights must be of the same size');
        }

        if (!items.length) {
            console.log('Items must not be empty');
        }

        // Preparing the cumulative weights array.
        // For example:
        // - weights = [1, 4, 3]
        // - cumulativeWeights = [1, 5, 8]
        const cumulativeWeights: number[] = [];
        for (let i = 0; i < weights.length; i += 1) {
            cumulativeWeights[i] = weights[i] + (cumulativeWeights[i - 1] || 0);
        }

        // Getting the random number in a range of [0...sum(weights)]
        // For example:
        // - weights = [1, 4, 3]
        // - maxCumulativeWeight = 8
        // - range for the random number is [0...8]
        const maxCumulativeWeight = cumulativeWeights[cumulativeWeights.length - 1];
        const randomNumber = maxCumulativeWeight * this.r();

        // Picking the random item based on its weight.
        // The items with higher weight will be picked more often.
        for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
            if (cumulativeWeights[itemIndex] >= randomNumber) {
                return items[itemIndex];
            }
        }
    }

    rg(mean = 0, standardDerivation = 1) {
        // https://github.com/openjdk-mirror/jdk7u-jdk/blob/f4d80957e89a19a29bb9f9807d2a28351ed7f7df/src/share/classes/java/util/Random.java#L496
        if (this._hasNextG) {
            this._hasNextG = false;
            var result = this._nextG;
            return mean + standardDerivation * result;
        } else {
            var v1 = 0;
            var v2 = 0;
            var s = 0;
            do {
                v1 = this.r() * 2 - 1; // between -1 and 1
                v2 = this.r() * 2 - 1; // between -1 and 1
                s = v1 * v1 + v2 * v2;
            } while (s >= 1 || s === 0);
            var multiplier = Math.sqrt((-2 * Math.log(s)) / s);
            this._nextG = v2 * multiplier;
            this._hasNextG = true;
            return mean + standardDerivation * (v1 * multiplier);
        }
    };

    shuffle(arr: any[]) { // returns new shuffled array
        let new_arr = arr.slice();
        for (let i = new_arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.r() * (i + 1));
            const temp = new_arr[i];
            new_arr[i] = new_arr[j];
            new_arr[j] = temp;
        }
        return new_arr;
    }
}

export default Random;