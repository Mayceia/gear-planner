import {Ability, BuffController, GcdAbility, OgcdAbility, PersonalBuff, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, Rotation, PreDmgAbilityUseRecordUnf, AbilityUseResult} from "@xivgear/core/sims/cycle_sim";
import {rangeInc} from "@xivgear/util/array_utils";
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
//import {potionMaxMind} from "@xivgear/core/sims/common/potion";

type WhmAbility = Ability & Readonly<{
    /** Run if an ability needs to update the aetherflow gauge */
    updateGauge?(gauge: WhmGauge): void;
}>

type WhmGcdAbility = GcdAbility & WhmAbility;

type WhmOgcdAbility = OgcdAbility & WhmAbility;

type WhmGaugeState = {
    level: number;
    blueLilies: number;
    redLilies: number;
}

export type WhmExtraData = {
    gauge: WhmGaugeState;
}

const filler: WhmGcdAbility = {
    id: 119,
    type: 'gcd',
    name: "Stone",
    potency: 140,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    levelModifiers: [
        {
            minLevel: 18,
            potency: 190,
            name: "Stone II",
            id: 127,
        },
        {
            minLevel: 54,
            potency: 220,
            name: "Stone III",
            id: 3568,
        },
        {
            minLevel: 64,
            potency: 260,
            name: "Stone IV",
            id: 7431,
        },
        {
            minLevel: 72,
            potency: 290,
            name: "Glare",
            id: 16533,
        },
        {
            minLevel: 82,
            potency: 310,
            name: "Glare III",
            id: 25859,
        },
        {
            minLevel: 94,
            potency: 340,
            name: "Glare III",
            id: 25859,
        },
    ],
};

const dia: WhmGcdAbility = {
    id: 121,
    type: 'gcd',
    name: "Aero",
    potency: 50,
    dot: {
        id: 143,
        tickPotency: 30,
        duration: 30,
    },
    attackType: "Spell",
    gcd: 2.5,
    levelModifiers: [
        {
            minLevel: 46,
            potency: 50,
            name: "Aero II",
            id: 132,
            dot: {
                id: 144,
                tickPotency: 50,
                duration: 30,
            },
        },
        {
            minLevel: 72,
            potency: 65,
            name: "Dia",
            id: 16532,
            dot: {
                id: 1871,
                tickPotency: 65,
                duration: 30,
            },
        },
        {
            minLevel: 94,
            potency: 80,
            name: "Dia",
            id: 16532,
            dot: {
                id: 1871,
                tickPotency: 80,
                duration: 30,
            },
        },
    ],
};

const assize: WhmOgcdAbility = {
    id: 3571,
    type: 'ogcd',
    name: "Assize",
    potency: 400,
    attackType: "Ability",
    cooldown: {
        time: 40,
    },
};

export const SacredSight: PersonalBuff = {
    name: "Sacred Sight",
    saveKey: "Sacred Sight",
    duration: 30,
    stacks: 3,
    selfOnly: true,
    effects: {
        // Allows 1 use of Glare IV per stack
    },
    statusId: 3879,
    appliesTo: ability => ability.id === glare4.id,
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.subtractStacksSelf(1);
        return {
            ...ability,
        };
    },
};

const PomBuff: PersonalBuff = {
    name: "Presence of Mind",
    selfOnly: true,
    duration: 15,
    effects: {
        haste: 20,
    },
    statusId: 157,
};

const pom: WhmOgcdAbility = {
    id: 136,
    type: 'ogcd',
    name: 'Presence of Mind',
    potency: null,
    activatesBuffs: [PomBuff],
    attackType: "Ability",
    cooldown: {
        time: 120,
    },
    levelModifiers:[
        {
            minLevel: 92,
            activatesBuffs: [PomBuff, SacredSight],
        },
    ],
};

const lily: WhmGcdAbility = {
    id: 16534,
    type: 'gcd',
    name: "Afflatus Rapture",
    potency: 0,
    attackType: "Spell",
    gcd: 2.5,
    updateGauge: (gauge: WhmGauge) => {
        gauge.blueLilies -= 1;
        gauge.redLilies += 1;
    },
};

const misery: WhmGcdAbility = {
    id: 16535,
    type: 'gcd',
    name: "Afflatus Misery",
    potency: 1240,
    attackType: "Spell",
    gcd: 2.5,
    updateGauge: gauge => gauge.redLilies -= 3,
    levelModifiers: [
        {
            minLevel: 94,
            potency: 1360,
        },
    ],
};

const glare4: WhmGcdAbility = {
    id: 37009,
    type: 'gcd',
    name: "Glare IV",
    potency: 640,
    attackType: "Spell",
    gcd: 2.5,
};

class WhmGauge {
    private _blueLilies: number = 0;
    get blueLilies(): number {
        return this._blueLilies;
    }
    set blueLilies(newLily: number) {
        if (newLily < 0) {
            console.warn(`Used a lily when unavailable`);
        }
        this._blueLilies = Math.max(Math.min(newLily, 3), 0);
    }

    private _redLilies: number = 0;
    get redLilies(): number {
        return this._redLilies;
    }
    set redLilies(newLily: number) {
        if (newLily < 0) {
            console.warn(`Used misery with blood lily not charged`);
        }
        this._redLilies = Math.max(Math.min(newLily, 3), 0);
    }


    getGaugeState(): WhmGaugeState {
        return {
            level: 100,
            blueLilies: this.blueLilies,
            redLilies: this.redLilies,
        };
    }
}

export interface WhmSimResult extends CycleSimResult {
}

export interface WhmSettings extends SimSettings {

}

export interface WhmSettingsExternal extends ExternalCycleSettings<WhmSettings> {

}

export const whmCycleSpec: SimSpec<WhmSim, WhmSettingsExternal> = {
    displayName: "WHM New Sim",
    loadSavedSimInstance(exported: WhmSettingsExternal) {
        return new WhmSim(exported);
    },
    makeNewSimInstance(): WhmSim {
        return new WhmSim();
    },
    stub: "whm-new-sim",
    supportedJobs: ['WHM'],
    isDefaultSim: true,
};

class WhmCycleProcessor extends CycleProcessor {
    gauge: WhmGauge;
    nextDiaTime: number = 0;
    nextLilyTime: number = 20;
    nextMiseryTime: number = 60;
    sacredSight: number = 0;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.gauge = new WhmGauge();
    }

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: WhmExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    override use(ability: Ability): AbilityUseResult {
        const whmAbility = ability as WhmAbility;

        // Update gauge from the ability itself
        if (whmAbility.updateGauge !== undefined) {
            whmAbility.updateGauge(this.gauge);
        }
        if (this.nextGcdTime > this.nextLilyTime) {
            this.nextLilyTime += 20;
            this.gauge.blueLilies += 1;
        }
        return super.use(ability);
    }

    buffedGcd() {
        if (this.nextGcdTime >= this.nextDiaTime && this.remainingTime > 15) {
            this.nextDiaTime = this.nextGcdTime + 28.8;
            this.useGcd(dia);
        }
        else if (this.gauge.redLilies === 3){
            this.useGcd(misery);
        }
        else if (this.isSacredSightActive) {
            this.useGcd(glare4);
            this.sacredSight -= 1;
        }
        else {
            this.useGcd(filler);
        }
    }

    unbuffedGCD() {
        if (this.nextGcdTime >= this.nextDiaTime && this.remainingTime > 15) {
            this.nextDiaTime = this.nextGcdTime + 28.8;
            this.useGcd(dia);
        }
        else if ((this.gauge.redLilies === 3 && this.nextMiseryTime % 120 === 0) //use odd minute misery ASAP
            || (this.gauge.redLilies === 3 && this.remainingTime < 5)) { //or use misery if the fight will end now
            this.useGcd(misery);
        }
        else if (this.gauge.redLilies < 3 && this.gauge.blueLilies > 0 && this.totalTime > this.nextMiseryTime + 7 && this.stats.level >= 74) {
            this.useGcd(lily);
            if (this.gauge.redLilies === 3) {
                this.nextMiseryTime += 60;
            }
        }
        else {
            this.useGcd(filler);
        }
    }

    useTwoMinBurst() {
        this.use(pom);
        for (let i = 0; i < 12; i++){
            this.buffedGcd();
            if (this.isReady(assize)) {
                this.use(assize);
            }
        }
    }

    isSacredSightActive(): boolean{
        return this.getActiveBuffData(SacredSight, this.currentTime)?.buff?.duration > 0;
    }
}

export class WhmSim extends BaseMultiCycleSim<WhmSimResult, WhmSettings, WhmCycleProcessor> {

    makeDefaultSettings(): WhmSettings {
        return {

        };
    }

    spec = whmCycleSpec;
    displayName = whmCycleSpec.displayName;
    shortName = "whm-sim";

    constructor(settings?: WhmSettingsExternal) {
        super('WHM', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): WhmCycleProcessor {
        return new WhmCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            apply(cp: WhmCycleProcessor) {
                cp.use(filler); //prepull glare
                cp.oneCycle(cycle => {
                    cp.unbuffedGCD();
                    cp.unbuffedGCD();
                    cp.unbuffedGCD();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.unbuffedGCD();
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
                cp.remainingCycles(cycle => {
                    while (!cp.isReady(pom)){
                        cp.unbuffedGCD();
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.unbuffedGCD();
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
            },
        },
        ...rangeInc(10, 28, 2).map(i => ({
            name: `Redot at ${i}s`,
            cycleTime: 120,
            apply(cp: WhmCycleProcessor) {
                cp.useGcd(filler);
                cp.useGcd(dia);
                cp.nextDiaTime = i;
                cp.oneCycle(cycle => {
                    cp.unbuffedGCD();
                    cp.unbuffedGCD();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.unbuffedGCD();
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
                cp.remainingCycles(cycle => {
                    while (!cp.isReady(pom)){
                        cp.unbuffedGCD();
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.unbuffedGCD();
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
            },
        })),
        ...rangeInc(2, 16, 2).map(i => ({
            name: `Delay dot to ${i}s`,
            cycleTime: 120,
            apply(cp: WhmCycleProcessor) {
                cp.use(filler);
                cp.nextDiaTime = i;
                cp.oneCycle(cycle => {
                    cp.unbuffedGCD();
                    cp.unbuffedGCD();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.unbuffedGCD();
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
                cp.remainingCycles(cycle => {
                    while (!cp.isReady(pom)){
                        cp.unbuffedGCD();
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.unbuffedGCD();
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
            },
        })),
        ];
    }
}
