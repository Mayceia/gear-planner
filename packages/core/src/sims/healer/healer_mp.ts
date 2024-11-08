import { CharacterGearSet } from "@xivgear/core/gear";
import { SimResult, SimSettings, SimSpec, Simulation } from "@xivgear/core/sims/sim_types";
import { NORMAL_GCD } from "@xivgear/xivmath/xivconstants";
import { EmptyObject } from "../../util/types";

const maxMP = 10000;

const lucidPotency = 55;
const lucidDuration = 21;
const lucidCooldown = 60;

const fillerMP = 400;

const drawCooldown = 60;
const drawMP = 2000;

/*const aetherflowCooldown = 60;
const aetherflowMP = 2000;

const addersgallCooldown = 20;
const addersgallMP = 700;
const rhizomataCooldown = 90;

const assizeCooldown = 40;
const assizeMP = 500;
const lilyCooldown = 20;
const lilyMP = 0;
const thinAirCooldown = 60;
*/

export interface MPResult extends SimResult {
    baseRegen: number;
    minutesToZero: number | 'Positive';   
}

export interface MPSettings extends SimSettings {
    //job: 'AST' | 'SCH' | 'SGE' | 'WHM';
}

export const mpSimSpec: SimSpec<MPPerMinute, MPSettings> = {
    displayName: "MP per Minute",
    loadSavedSimInstance(exported: MPSettings) {
        return new MPPerMinute();
    },
    makeNewSimInstance(): MPPerMinute {
        return new MPPerMinute();
    },
    stub: "mp-sim",
    description: "Mp economy",
    isDefaultSim: false,
    supportedJobs: ['AST', 'SCH', 'SGE', 'WHM'],
}

export class MPPerMinute implements Simulation<MPResult, MPSettings, EmptyObject>{
    exportSettings() {
        return{
            ...this.settings
        }
    }
    spec = mpSimSpec;
    shortName = 'mp';
    displayName = mpSimSpec.displayName;
    settings={};

    async simulate(set: CharacterGearSet): Promise<MPResult> {
        const sim = this;
        var mpResult: number = 0;
        var baseRegen: number = 0;
        var minutesToZero: number | 'Positive';

        
        const tick = set.computedStats.mpPerTick;
        baseRegen = (tick * 20)
        mpResult += baseRegen;

        const lucidTotal = (lucidPotency * 10) * (lucidDuration / 3);
        mpResult += lucidTotal * (60 / lucidCooldown);

        mpResult += drawMP * (60 / drawCooldown);

        const speed = set.computedStats.gcdMag(NORMAL_GCD, 0);
        var numGCDs = (60 / speed);
        mpResult -= (numGCDs * fillerMP);

        if (mpResult < 0){
            minutesToZero = -1 * maxMP / mpResult;}
        else {
            minutesToZero = "Positive";
        }

        return {
            mainDpsResult: mpResult,
            baseRegen: baseRegen,
            minutesToZero: minutesToZero,
        }
    }
}