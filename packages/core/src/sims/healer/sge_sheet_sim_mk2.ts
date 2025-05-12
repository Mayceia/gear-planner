import {Ability, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {
    AbilityUseResult,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {potionMaxMind} from "@xivgear/core/sims/common/potion";
import {rangeInc} from "@xivgear/util/array_utils";
import {animationLock} from "@xivgear/core/sims/ability_helpers";
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";

/**
 * Used for all 360p filler abilities
 */
const filler: GcdAbility = {
    type: 'gcd',
    name: "Dosis III",
    potency: 370,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    id: 24283,
    levelModifiers: [
        {
            minLevel: 54,
            potency: 250,
        },
        {
            minLevel: 64,
            potency: 300,
        },
        {
            minLevel: 72,
            potency: 320,
            name: "Dosis II",
            id: 24306,
        },
        {
            minLevel: 82,
            potency: 330,
            name: "Dosis III",
            id: 24312,
        },
        {
            minLevel: 94,
            potency: 370,
            name: "Dosis III",
            id: 24312,
        },
    ],
};

const eukrasia: GcdAbility = {
    type: 'gcd',
    name: 'Eukrasia',
    potency: null,
    attackType: "Spell",
    fixedGcd: true,
    gcd: 1.0,
    id: 24290,
};

const eDosis: GcdAbility = {
    type: 'gcd',
    name: "Eukrasian Dosis",
    potency: 0,
    dot: {
        id: 2614,
        duration: 30,
        tickPotency: 30,
    },
    attackType: "Spell",
    fixedGcd: true,
    gcd: 1.5,
    id: 24293,
    levelModifiers: [
        {
            minLevel: 54,
            dot: {
                id: 2614,
                tickPotency: 35,
                duration: 30,
            },
        },
        {
            minLevel: 64,
            dot: {
                id: 2614,
                tickPotency: 40,
                duration: 30,
            },
        },
        {
            minLevel: 72,
            name: "Eukrasian Dosis II",
            id: 24308,
            dot: {
                id: 2615,
                tickPotency: 60,
                duration: 30,
            },
        },
        {
            minLevel: 82,
            name: "Eukrasian Dosis III",
            id: 24314,
            dot: {
                id: 2616,
                tickPotency: 80,
                duration: 30,
            },
        },
    ],
};

const phlegma: GcdAbility = {
    type: 'gcd',
    name: "Phlegma",
    potency: 230,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    id: 24289,
    cooldown: {
        time: 40.0,
        charges: 2,
    },
    levelModifiers: [
        {
            minLevel: 54,
            potency: 330,
        },
        {
            minLevel: 64,
            potency: 400,
        },
        {
            minLevel: 72,
            potency: 490,
            name: "Phlegma II",
            id: 24307,
        },
        {
            minLevel: 82,
            potency: 600,
            name: "Phlegma III",
            id: 24313,
        },
    ],
};

const psyche: OgcdAbility = {
    type: 'ogcd',
    name: "Psyche",
    id: 37033,
    potency: 600,
    attackType: "Ability",
    cooldown: {
        time: 60,
    },
};

export interface SgeSheetSimResult extends CycleSimResult {
}

export interface SgeNewSheetSettings extends SimSettings {
    usePotion: boolean
}

export interface SgeNewSheetSettingsExternal extends ExternalCycleSettings<SgeNewSheetSettings> {
}

export const sgeNewSheetSpec: SimSpec<SgeSheetSim, SgeNewSheetSettingsExternal> = {
    displayName: "SGE Sim Mk.II",
    loadSavedSimInstance(exported: SgeNewSheetSettingsExternal) {
        return new SgeSheetSim(exported);
    },
    makeNewSimInstance(): SgeSheetSim {
        return new SgeSheetSim();
    },
    stub: "sge-sheet-sim-mk2",
    supportedJobs: ['SGE'],
    isDefaultSim: true,
    description: 'Simulates the standard SGE 2-minute rotation.',
    maintainers: [{
        name: 'Wynn',
        contact: [{
            type: 'discord',
            discordTag: 'xp',
            discordUid: '126517290098229249',
        }],
    }],

};

class SageCycleProcessor extends CycleProcessor {
    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cdEnforcementMode = 'delay';
    }

    useDotIfWorth() {
        if (this.remainingTime > 15) {
            this.use(eukrasia);
            this.use(eDosis);
        }
        else {
            this.use(filler);
        }
    }

    use(ability: Ability): AbilityUseResult {
        // If we are going to run out of time, blow any phlegma we might be holding
        if (ability === filler
            && this.remainingGcds(phlegma) <= 2
            && this.cdTracker.canUse(phlegma)) {
            return super.use(phlegma);
        }
        else {
            return super.use(ability);
        }
    }

    doEvenMinuteBurst() {
        this.use(phlegma);
        const latestPsycheTime = this.nextGcdTime - animationLock(psyche);
        this.advanceTo(Math.max(latestPsycheTime, this.currentTime));
        if (this.isReady(psyche)) {
            this.use(psyche);
            this.use(phlegma);
        }
        else {
            this.doOffMinuteBurst();
        }

    }

    doOffMinuteBurst() {
        while (true) {
            const canUse = this.canUseCooldowns(phlegma, [psyche]);
            if (canUse === 'yes') {
                this.use(phlegma);
                this.use(psyche);
                return;
            }
            else if (canUse === 'no') {
                this.use(filler);
            }
            else {
                return;
            }
        }
    }
}

export class SgeSheetSim extends BaseMultiCycleSim<SgeSheetSimResult, SgeNewSheetSettings, SageCycleProcessor> {

    spec = sgeNewSheetSpec;
    displayName = sgeNewSheetSpec.displayName;
    shortName = "sge-new-sheet-sim";

    constructor(settings?: SgeNewSheetSettingsExternal) {
        super('SGE', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): SageCycleProcessor {
        return new SageCycleProcessor(settings);
    }

    makeDefaultSettings(): SgeNewSheetSettings {
        return {
            usePotion: false,
        };
    }

    getRotationsToSimulate(): Rotation[] {
        const outer = this;
        return [{
            name: 'Normal DoT',
            cycleTime: 120,
            apply(cp: SageCycleProcessor) {
                if (outer.settings.usePotion) {
                    cp.useOgcd(potionMaxMind);
                }
                cp.useGcd(filler);
                cp.remainingCycles(cycle => {
                    cp.useDotIfWorth();
                    cycle.use(filler);
                    cycle.use(filler);
                    cp.doEvenMinuteBurst();
                    cycle.useUntil(filler, 30);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 60);
                    cp.useDotIfWorth();
                    cp.doOffMinuteBurst();
                    cycle.useUntil(filler, 90);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 'end');
                });
            },
        }, ...rangeInc(2, 20, 2).map(i => ({
            name: `DoT clip ${i}s`,
            cycleTime: 120,
            apply(cp: SageCycleProcessor) {
                if (outer.settings.usePotion) {
                    cp.useOgcd(potionMaxMind);
                }
                const DOT_CLIP_AMOUNT = i;
                cp.useGcd(filler);
                cp.oneCycle(cycle => {
                    cp.useDotIfWorth();
                    cycle.use(filler);
                    cycle.use(filler);
                    cp.doEvenMinuteBurst();
                    cycle.useUntil(filler, 30 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 60 - DOT_CLIP_AMOUNT);
                    cycle.use(eDosis);
                    cycle.useUntil(filler, 60);
                    cp.doOffMinuteBurst();
                    cycle.useUntil(filler, 90 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 120 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 'end');
                });
                cp.remainingCycles(cycle => {
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.use(filler);
                    // There is always one phlegma charge available at this point
                    cp.doEvenMinuteBurst();
                    cycle.useUntil(filler, 30 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 60 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cp.doOffMinuteBurst();
                    cycle.useUntil(filler, 90 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 120 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 'end');
                });
            },
        })),
        ];
    }

}
