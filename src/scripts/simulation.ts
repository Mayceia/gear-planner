import {CharacterGearSet} from "./gear";
import {JobName, SupportedLevel} from "./xivconstants";

export interface SimResult {
    mainDpsResult: number;
}

export interface SimSettings {
    displayNameOverride: string | undefined,
}

export interface SimSpec<SimType extends Simulation<any, any, any>, SettingsExport> {
    /**
     * Unique stub used to reference this specific sim type. Should only use alphanumeric (but not
     * with a number as the first character) and hyphens.
     */
    stub: string,
    /**
     * Display name for this sim type.
     */
    displayName: string,

    /**
     * Make a new instance of the simulator without importing any saved settings.
     */
    makeNewSimInstance(): SimType;

    /**
     * Make an instance of the simulator from saved settings.
     *
     * @param exported The saved settings.
     */
    loadSavedSimInstance(exported: SettingsExport);

    /**
     * Optional: restrict this simulation to certain jobs.
     */
    supportedJobs?: JobName[] | undefined;
    /**
     * Optional: restrict this simulation to certain levels.
     */
    supportedLevels?: SupportedLevel[] | undefined;
}

let simSpecs: SimSpec<any, any>[] = [];

export function registerSim(simSpec: SimSpec<any, any>) {
    simSpecs.push(simSpec);
}

export function getSims() {
    return [...simSpecs];
}

export function getSimSpecByStub(stub: string): SimSpec<any, any> | undefined {
    return simSpecs.find(simSpec => simSpec.stub === stub);
}

/**
 * Represents a configured simulation
 *
 * @type ResultType: The type of result returned by the sim.
 * @type SettingType: The internal settings type.
 * @type SettingsExport: The externalized settings type (for saving and restoring of settings).
 */
export interface Simulation<ResultType extends SimResult, SettingsType extends SimSettings, SettingsExport> {

    shortName: string;
    displayName: string;

    simulate(set: CharacterGearSet): Promise<ResultType>;

    settings: SettingsType;

    exportSettings(): SettingsExport;

    spec: SimSpec<typeof this, SettingsExport>

    makeConfigInterface(): HTMLElement;
}

export function noSimSettings() {
    const outerDiv = document.createElement("div");
    const header = document.createElement("h1");
    header.textContent = "No Settings for This Simulation";
    outerDiv.replaceChildren(header);
    return outerDiv;
}


export const dummySimSpec: SimSpec<typeof dummySim, SimSettings> = {
    displayName: "Dummy Sim",
    loadSavedSimInstance(exported: SimSettings) {
        return dummySim;
    },
    makeNewSimInstance(): typeof dummySim {
        return dummySim;
    },
    stub: "dummy-sim",
}

export const dummySim: Simulation<SimResult, SimSettings, {}> = {
    exportSettings() {
        return {
            ...this.settings
        };
    },
    settings: {
        displayNameOverride: undefined,
    },
    shortName: "dummysim",
    displayName: "Dummy Sim",
    async simulate(set: CharacterGearSet): Promise<SimResult> {
        return {mainDpsResult: 10000 + set.computedStats.critChance * 10000};
    },
    spec: dummySimSpec,
    makeConfigInterface: noSimSettings,
}

export interface SimCurrentResult<X extends SimResult> {
    result: X | undefined;
    status: 'Done' | 'Running' | 'Not Run' | 'Stale' | 'Error';
    error: any | undefined;
    resultPromise: Promise<X>;
}

registerSim(dummySimSpec);