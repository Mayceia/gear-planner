import { Chain } from "@xivgear/core/sims/buffs";
import { Ability, GcdAbility, OgcdAbility, PersonalBuff, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, Rotation, PreDmgAbilityUseRecordUnf, AbilityUseResult } from "@xivgear/core/sims/cycle_sim";
import { rangeInc } from "@xivgear/util/array_utils";
//import {potionMaxMind} from "@xivgear/core/sims/common/potion";
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";
import { removeSelf } from "../common/utils";

type SchAbility = Ability & Readonly<{
    /** Run if an ability needs to update the aetherflow gauge */
    updateGauge?(gauge: SchGauge): void;
}>

type SchGcdAbility = GcdAbility & SchAbility;

type SchOgcdAbility = OgcdAbility & SchAbility;

type SchGaugeState = {
    level: number;
    aetherflow: number;
}

export type SchExtraData = {
    gauge: SchGaugeState;
}

const filler: SchGcdAbility = {
    type: 'gcd',
    name: "Ruin",
    id: 17869,
    potency: 150,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    levelModifiers: [
        {
            minLevel: 54,
            potency: 220,
            name: "Broil",
            id: 3584,
        },
        {
            minLevel: 64,
            potency: 240,
            name: "Broil II",
            id: 7435,
        },
        {
            minLevel: 72,
            potency: 255,
            name: "Broil III",
            id: 16541,
        },
        {
            minLevel: 82,
            potency: 295,
            name: "Broil IV",
            id: 25865,
        },
        {
            minLevel: 94,
            potency: 310,
            name: "Broil IV",
            id: 25865,
        },
    ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const r2: SchGcdAbility = {
    type: 'gcd',
    name: "Ruin II",
    id: 17870,
    potency: 140,
    attackType: "Spell",
    gcd: 2.5,
    levelModifiers: [
        {
            minLevel: 54,
            potency: 160,
        },
        {
            minLevel: 64,
            potency: 180,
        },
        {
            minLevel: 72,
            potency: 200,
        },
        {
            minLevel: 82,
            potency: 220,
        },
    ],
};

const bio: SchGcdAbility = {
    type: 'gcd',
    name: "Bio",
    id: 17864,
    potency: 0,
    dot: {
        duration: 30,
        tickPotency: 20,
        id: 179,
    },
    attackType: "Spell",
    gcd: 2.5,
    levelModifiers: [
        {
            minLevel: 26,
            name: "Bio II",
            id: 17865,
            dot: {
                id: 189,
                tickPotency: 40,
                duration: 30,
            },
        },
        {
            minLevel: 72,
            name: "Biolysis",
            id: 16540,
            dot: {
                id: 1895,
                tickPotency: 70,
                duration: 30,
            },
        },
        {
            minLevel: 94,
            name: "Biolysis",
            id: 16540,
            dot: {
                id: 1895,
                tickPotency: 80,
                duration: 30,
            },
        },
    ],
};

export const ImpactImminent: PersonalBuff = {
    name: "Impact Imminent",
    saveKey: "Impact Imminent",
    duration: 30,
    selfOnly: true,
    effects: {
        // Allows use of Baneful Impaction
    },
    statusId: 3882,
    appliesTo: ability => ability.id === baneful.id,
    beforeSnapshot: removeSelf,
};

const chain: SchOgcdAbility = {
    type: 'ogcd',
    name: "Chain Strategem",
    id: 7436,
    activatesBuffs: [Chain],
    potency: 0,
    attackType: "Ability",
    cooldown: {
        time: 120,
    },
    levelModifiers:[
        {
            minLevel: 92,
            activatesBuffs: [Chain, ImpactImminent],
        },
    ],
};

const baneful: SchOgcdAbility = {
    type: 'ogcd',
    name: "Baneful Impaction",
    id: 37012,
    potency: 0,
    dot: {
        duration: 15,
        tickPotency: 140,
        id: 3883,
    },
    attackType: "Ability",
};

const ed: SchOgcdAbility = {
    type: 'ogcd',
    name: "Energy Drain",
    id: 167,
    potency: 100,
    attackType: "Ability",
    updateGauge: gauge => gauge.aetherflow -= 1,
};

const aetherflow: SchOgcdAbility = {
    type: 'ogcd',
    name: "Aetherflow",
    id: 166,
    potency: 0,
    attackType: "Ability",
    cooldown: {
        time: 60,
    },
    updateGauge: gauge => gauge.aetherflow = 3,
};

const diss: SchOgcdAbility = {
    type: 'ogcd',
    name: "Dissipation",
    id: 3587,
    potency: 0,
    attackType: "Ability",
    cooldown: {
        time: 180,
    },
    updateGauge: gauge => gauge.aetherflow = 3,
};

class SchGauge {
    private _aetherflow: number = 0;
    get aetherflow(): number {
        return this._aetherflow;
    }
    set aetherflow(newAF: number) {
        if (newAF < 0) {
            console.warn(`Used Energy Drain when empty`);
        }

        this._aetherflow = Math.max(Math.min(newAF, 3), 0);
    }


    getGaugeState(): SchGaugeState {
        return {
            level: 100,
            aetherflow: this.aetherflow,
        };
    }

}

export interface SchSimResult extends CycleSimResult {
}

export interface SchSettings extends SimSettings {
    edsPerAfDiss: number,
}

export interface SchSettingsExternal extends ExternalCycleSettings<SchSettings> {
}

export const schCycleSpec: SimSpec<SchSim, SchSettingsExternal> = {
    displayName: "SCH Sim",
    loadSavedSimInstance(exported: SchSettingsExternal) {
        return new SchSim(exported);
    },
    makeNewSimInstance(): SchSim {
        return new SchSim();
    },
    stub: "sch-sim",
    supportedJobs: ['SCH'],
    isDefaultSim: true,
};

class ScholarCycleProcessor extends CycleProcessor {
    gauge: SchGauge;
    nextBioTime: number = 0;
    numED: number = 3;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.gauge = new SchGauge();
    }

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: SchExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    override use(ability: Ability): AbilityUseResult {
        const schAbility = ability as SchAbility;

        // Update gauge from the ability itself
        if (schAbility.updateGauge !== undefined) {
            schAbility.updateGauge(this.gauge);
        }
        return super.use(ability);
    }

    useDotIfWorth() {
        if (this.nextGcdTime >= this.nextBioTime && this.remainingTime > 15) {
            this.nextBioTime = this.nextGcdTime + 28.8;
            this.useGcd(bio);
        }
        else {
            this.useGcd(filler);
        }
    }

    spendEDs() {
        if (this.numED >= 1) {
            this.useDotIfWorth();
            this.use(ed);
            if (this.numED >= 2) {
                this.useDotIfWorth();
                this.use(ed);
                if (this.numED >= 3) {
                    this.useDotIfWorth();
                    this.use(ed);
                }
            }
        }
    }

    useTwoMinBurst() {
        this.useDotIfWorth();
        this.use(chain);
        if (this.remainingTime < 30 && this.isBanefulReady()) { //rush baneful if there's not enough time for it to tick
            this.useDotIfWorth();
            this.use(baneful);
        }
        this.spendEDs();
        this.useDotIfWorth();
        this.use(aetherflow);
        if (this.isBanefulReady()) { //if baneful was not rushed
            this.useDotIfWorth();
            this.use(baneful);
        }
        this.spendEDs();
    }

    isBanefulReady(): boolean{
        return this.getActiveBuffData(ImpactImminent, this.currentTime)?.buff?.duration > 0;
    }
}

export class SchSim extends BaseMultiCycleSim<SchSimResult, SchSettings, ScholarCycleProcessor> {

    spec = schCycleSpec;
    displayName = schCycleSpec.displayName;
    shortName = "sch-sheet-sim";
    manuallyActivatedBuffs = [Chain];

    constructor(settings?: SchSettingsExternal) {
        super('SCH', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): ScholarCycleProcessor {
        return new ScholarCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    makeDefaultSettings(): SchSettings {
        return {
            edsPerAfDiss: 3,
        };
    }

    getRotationsToSimulate(): Rotation[] {
        const sim = this;
        return [{
            cycleTime: 120,
            name: "Normal DoT",
            apply(cp: ScholarCycleProcessor) {
                cp.numED = sim.settings.edsPerAfDiss;
                // pre-pull
                cp.use(filler);
                cp.remainingCycles(cycle => {
                    cp.useDotIfWorth();
                    if (cycle.cycleNumber % 3 === 0) { //0, 6, 12 minute diss, right before buffs
                        cp.use(diss);
                    }
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(aetherflow)) {
                            cp.use(aetherflow);
                            if (cycle.cycleNumber % 3 === 2 || cp.remainingTime < cp.timeUntilReady(chain)) { //5, 11, 17 minute aetherflow, spend and diss before buffs
                                cp.spendEDs();
                            }
                        }
                        if (cp.isReady(diss)) {
                            cp.use(diss);
                            if (cycle.cycleNumber % 3 === 1) { //3, 9, 15 minute diss, spend and refill with aetherflow
                                cp.spendEDs();
                            }
                        }
                    }
                });
            },
        },
        ...rangeInc(10, 28, 2).map(i => ({
            name: `Redot at ${i}s`,
            cycleTime: 120,
            apply(cp: ScholarCycleProcessor) {
                cp.numED = sim.settings.edsPerAfDiss;
                cp.use(filler);
                cp.use(bio);
                cp.nextBioTime = i;
                cp.oneCycle(cycle =>{
                    cp.useOgcd(diss);
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(aetherflow)) {
                            cp.use(aetherflow);
                            if (cycle.cycleNumber % 3 === 2 || cp.remainingTime < cp.timeUntilReady(chain)) {
                                cp.spendEDs();
                            }
                        }
                    }
                });
                cp.remainingCycles(cycle => {
                    cp.useDotIfWorth();
                    if (cycle.cycleNumber % 3 === 0) { //0, 6, 12 minute diss, right before buffs
                        cp.use(diss);
                    }
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(aetherflow)) {
                            cp.use(aetherflow);
                            if (cycle.cycleNumber % 3 === 2 || cp.remainingTime < cp.timeUntilReady(chain)) { //5, 11, 17 minute aetherflow, spend and diss before buffs
                                cp.spendEDs();
                            }
                        }
                        if (cp.isReady(diss)) {
                            cp.use(diss);
                            if (cycle.cycleNumber % 3 === 1) { //3, 9, 15 minute diss, spend and refill with aetherflow
                                cp.spendEDs();
                            }
                        }
                    }
                });
            },
        })),
        ...rangeInc(2, 16, 2).map(i => ({
            name: `Delay dot to ${i}s`,
            cycleTime: 120,
            apply(cp: ScholarCycleProcessor) {
                cp.numED = sim.settings.edsPerAfDiss;
                cp.use(filler);
                cp.nextBioTime = i;
                cp.remainingCycles(cycle => {
                    cp.useDotIfWorth();
                    if (cycle.cycleNumber % 3 === 0) { //0, 6, 12 minute diss, right before buffs
                        cp.use(diss);
                    }
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(aetherflow)) {
                            cp.use(aetherflow);
                            if (cycle.cycleNumber % 3 === 2 || //5, 11, 17 minute aetherflow, spend and diss before buffs
                                cp.remainingTime < cp.timeUntilReady(chain)) { //or the fight will end before chain is ready
                                cp.spendEDs();
                            }
                        }
                        if (cp.isReady(diss)) {
                            cp.use(diss);
                            if (cycle.cycleNumber % 3 === 1) { //3, 9, 15 minute diss, spend and refill with aetherflow
                                cp.spendEDs();
                            }
                        }
                    }
                });
            },
        })),
        ];
    }
}
