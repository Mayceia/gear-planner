import {noSimSettings, registerSim, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {baseDamage, spsTickMulti} from "../xivmath";
import {ComputedSetStats} from "../geartypes";
import {labelFor} from "../components";


//potencies for our spells

const glare = 310
const dia = 65
const diaDot = 65
const assize = 400
const misery = 1240

function afflatusTime(shortGcd, cycle) {
    return 6 * shortGcd * (cycle / 360 - 1);
}

// Average potency of a 360s rotation
function getP(sps, shortGcd, filler, cycle) {
    let result = 0
    result += 9 * assize * cycle / 360
    result += 6 * misery * cycle / 360
    if (glare - dia > diaDot / 3 * spsTickMulti(sps) * Math.floor(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
        result += 12 * (Math.ceil(30 / shortGcd) - 1) * glare + 12 * dia - 24 * glare
        // Logger.log("# Glares: " + 12*(Math.ceil(30/shortGcd)-1)-24*glare)
        result += 12 * 10 * spsTickMulti(sps) * diaDot
        // Logger.log("Dia ticks: " + 12*10)
    }
    else {
        result += 12 * (Math.floor(30 / shortGcd) - 1) * glare + 12 * dia - 24 * glare
        // Logger.log("# Glares: " + 12*(Math.ceil(30/shortGcd)-1)-24*glare)
        result += 12 * 9 * spsTickMulti(sps) * diaDot
        result += 12 * ((3 - (30 % shortGcd)) / 3) * spsTickMulti(sps) * diaDot
        // Logger.log("Dia ticks: " + (12*9+12*((3-(30 % shortGcd))/3)))
    }
    result -= filler * glare * cycle / 60
    // Logger.log("Potency: " + result)
    return result
}

function getMP(shortGcd, sps, LDs, m2s, c3s, rezz, cycle) {
    var result = 0
    if (glare - dia > diaDot / 3 * spsTickMulti(sps) * Math.floor(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
        result += 12 * (Math.ceil(30 / shortGcd)) * 400
    }
    else {
        result += 12 * (Math.floor(30 / shortGcd)) * 400
    }
    //misery + lillies
    result -= 400 * cycle / 15
    //assize
    result -= (500) * cycle / 40
    result -= (3850) * LDs * cycle / 60
    result += rezz * 2000 * cycle / 60
    result += 600 * m2s * cycle / 60
    result += 1100 * c3s * cycle / 60
    //thin air
    result -= 400 * cycle / 60
    return result
}

// Actual time taken by a 360s rotation
function getCycle(shortGcd, sps) {
    var result = 0
    //1 dia + x glares/lily/misery
    if (glare - dia > diaDot / 3 * spsTickMulti(sps) * Math.floor(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
        result += 12 * (Math.ceil(30 / shortGcd) * shortGcd)
    }
    else {
        result += 12 * (Math.floor(30 / shortGcd) * shortGcd)
    }
    // POM as multiplier normalized over 360s
    result *= 360 / ((45 / 0.80) + 315)
    // Logger.log("GCD: "+shortGcd+" Cycle: " +result)
    return result
}

function pps(sps, shortGcd, c3s, m2s, rezz) {
    var cycle = getCycle(shortGcd, sps)
    var afflatusT = afflatusTime(shortGcd, cycle)
    cycle += afflatusT
    return getP(sps, shortGcd, c3s + m2s + rezz, cycle) / cycle;
}

function mpps(shortGcd, sps, LDs, c3s, m2s, rezz) {
    var cycle = getCycle(shortGcd, sps)
    var afflatusT = afflatusTime(shortGcd, cycle)
    cycle += afflatusT
    return getMP(shortGcd, sps, LDs, m2s, c3s, rezz, cycle) / cycle
}

function MPTime(pie, shortGcd, sps, LDs, c3s, m2s, rezz) {
    var result = 0
    result += CalcPiety(pie) / 3
    result -= mpps(shortGcd, sps, LDs, c3s, m2s, rezz)
    return Math.floor(-10000 / result)
}

function summing(accumulator, currentValue) {
    return accumulator + currentValue
}

function reduce(arr, callback, initialVal) {
    var accumulator = (initialVal === undefined) ? undefined : initialVal;
    for (var i = 0; i < arr.length; i++) {
        if (accumulator !== undefined) accumulator = callback.call(undefined, accumulator, arr[i], i, this); else accumulator = arr[i];
    }
    return accumulator;
}

//Party buff things
const battleVoiceAvg = (15 / 120) * 0.2;
const battleLitanyAvg = (15 / 120) * 0.1;
const chainStratAvg = (15 / 120) * 0.1;
const devilmentAvg = (20 / 120) * 0.2;
const brdCritAvg = (45 / 120) * 0.02;
const brdDhAvg = (45 / 120) * 0.03;

// Traits
const magicAndMend = 1.3;

// jobmod etc
const levelMod = 1900;
const baseMain = 390
const baseSub = 400

const fl = Math.floor;

function floorTo(places: number, value: number) {
    return Math.floor(value * (10 ^ places)) * (10 ^ -places);
}


function CalcPiety(Pie) {
    return 200 + (Math.floor(150 * (Pie - baseMain) / levelMod));
}

function Healing(Potency, WD, JobMod, MainStat, Det, Crit, SS, TEN, classNum) {

    MainStat = Math.floor(MainStat * (1 + 0.01 * classNum));
    var Damage = Math.floor(Potency * (WD + Math.floor(baseMain * JobMod / 1000)) * (100 + Math.floor((MainStat - baseMain) * 569 / 1522)) / 100);
    Damage = Math.floor(Damage * (1000 + Math.floor(140 * (Det - baseMain) / levelMod)) / 1000);
    Damage = Math.floor(Damage * (1000 + Math.floor(100 * (TEN - baseSub) / levelMod)) / 1000);
    Damage = Math.floor(Damage * (1000 + Math.floor(130 * (SS - baseSub) / levelMod)) / 1000 / 100);
    Damage = Math.floor(Damage * magicAndMend)
    /*var CritDamage=Math.fl(Damage*(1000 * CalcCritDamage(Crit))/1000);
    var CritRate=CalcCritRate(Crit);
    var NormalRate=1-CritRate*/

    return Damage //* NormalRate + CritDamage * (CritRate);
}

function applyDhCrit(baseDamage: number, stats: ComputedSetStats) {
    return baseDamage * (1 + stats.dhitChance * (stats.dhitMulti - 1)) * (1 + stats.critChance * (stats.critMulti - 1));
}

export interface WhmSheetSimResult extends SimResult {
    pps: number,
}

export interface WhmSheetSettings extends SimSettings {
    partySize: number;
}

export const whmSheetSpec: SimSpec<WhmSheetSim, WhmSheetSettings> = {
    displayName: "WHM Sheet Sim",
    loadSavedSimInstance(exported: WhmSheetSettings) {
        return new WhmSheetSim(exported);
    },
    makeNewSimInstance(): WhmSheetSim {
        return new WhmSheetSim();
    },
    stub: "whm-sheet-sim",
    supportedJobs: ['WHM'],
}

export class WhmSheetSim implements Simulation<WhmSheetSimResult, WhmSheetSettings, WhmSheetSettings> {

    exportSettings(): WhmSheetSettings {
        return {...this.settings};
    };

    settings = {
        displayNameOverride: undefined,
        partySize: 0,
    };

    spec = whmSheetSpec;
    displayName = "WHM Sheet Sim";
    shortName = "whm-sheet-sim";

    constructor(settings?: WhmSheetSettings) {
        if (settings) {
            Object.assign(this.settings, settings);
        }
    }

    makeConfigInterface(): HTMLElement {
        if (false) {
            const div = document.createElement("div");
            const partySize = document.createElement("input");
            const partySizeLabel = labelFor("Unique Party Roles", partySize);
            partySize.type = 'number';
            partySize.min = '0';
            partySize.max = '5';
            partySize.value = this.settings.partySize.toString();
            partySize.addEventListener('change', (ev) => this.settings.partySize = parseInt(partySize.value));
            div.appendChild(partySizeLabel);
            div.appendChild(partySize);
            return div;
        }
        else {
            return noSimSettings();
        }
    }

    async simulate(set: CharacterGearSet): Promise<WhmSheetSimResult> {
        const ppsFinalResult = pps(set.computedStats.spellspeed, set.computedStats.gcdMag, 0, 0, 0);
        // console.log(ppsFinalResult);
        const resultWithoutDhCrit = baseDamage(set, ppsFinalResult, false, false, 0, 0);
        const result = applyDhCrit(resultWithoutDhCrit, set.computedStats);
        // Uncomment to test async logic
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
            mainDpsResult: result* 1 + this.settings.partySize,
            pps: ppsFinalResult,
        }
    }
}

registerSim(whmSheetSpec);