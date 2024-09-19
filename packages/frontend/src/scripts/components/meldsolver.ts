import { CharacterGearSet } from "@xivgear/core/gear";
import { EquippedItem, RawStats, EquipmentSet, EquipSlots, MeldableMateriaSlot, EquipSlotKey } from "@xivgear/xivmath/geartypes";
import { MateriaSubstat, ALL_SUB_STATS, MATERIA_ACCEPTABLE_OVERCAP_LOSS } from "@xivgear/xivmath/xivconstants";
import { BaseMultiCycleSim } from "../sims/sim_processors";
import { GearPlanSheetGui } from "./sheet";
import { CycleProcessor, CycleSimResult, CycleSimResultFull } from "@xivgear/core/sims/cycle_sim";
import { SimSettings } from "@xivgear/core/sims/sim_types";

class ItemWithStats {
    item: EquippedItem;
    stats: RawStats;

    constructor(item: EquippedItem, stats: RawStats) {
        this.item = item;
        this.stats = stats;
    }
}

class EquipmentSetWithStats {
    set: EquipmentSet;
    stats: RawStats;

    constructor(set: EquipmentSet, stats: RawStats) {
        this.set = set;
        this.stats = stats;
    }
}

export class MeldSolver {

    readonly _sheet: GearPlanSheetGui;
    private _gearset: CharacterGearSet;

    relevantStats: MateriaSubstat[]; //= ALL_SUB_STATS.filter(stat => this._sheet.isStatRelevant(stat) && stat != 'piety');

    public constructor(sheet: GearPlanSheetGui) {
        this._sheet = sheet;
    }

    public refresh(set: CharacterGearSet) {
        this._gearset = set;
        this.relevantStats = ALL_SUB_STATS.filter(stat => this._sheet.isStatRelevant(stat) && stat != 'piety');
    }

    public async buttonPress() : Promise<CharacterGearSet> {
        if (this._sheet.sims.at(0) && !(this._sheet.sims.at(0) instanceof BaseMultiCycleSim)) {
            return null;
        }
        const sim = this._sheet.sims.at(0) as BaseMultiCycleSim<CycleSimResult, SimSettings, CycleProcessor, CycleSimResultFull<CycleSimResult>>;
        const bestSet = await this.simulateSets((await this.getAllMeldCombinations(this._gearset, false)), sim);

        for (const slotKey of EquipSlots) {
            if (this._gearset.equipment[slotKey] === undefined || this._gearset.equipment[slotKey] === null) {
                continue;
            }

            this._gearset.equipment[slotKey].melds = bestSet.equipment[slotKey].melds;
        }

        this._gearset.forceRecalc();
        this._sheet.refreshMateria();
        this._sheet.refreshGearEditor(this._gearset);
        return bestSet;
    }

    async simulateSets(assortedSetsByGcd: Set<CharacterGearSet>, sim: BaseMultiCycleSim<CycleSimResult, SimSettings, CycleProcessor, CycleSimResultFull<CycleSimResult>>)
    : Promise<CharacterGearSet> {

        let bestSimDps: number = 0;
        let bestSet: CharacterGearSet;

        for (const set of assortedSetsByGcd) {
            const result = await sim.simulate(set);
            if (result.mainDpsResult > bestSimDps) {
                bestSimDps = result.mainDpsResult;
                bestSet = set;
            }
        }

        return bestSet;
    }

    async getAllMeldCombinations(gearset: CharacterGearSet, keepExistingMateria: boolean): Promise<Set<CharacterGearSet>> {

        const equipment = this.cloneEquipmentset(gearset.equipment);
        
        if (!keepExistingMateria) {
            for (const slotKey of EquipSlots) {
                const equipSlot = equipment[slotKey] as EquippedItem | null;
                const gearItem = equipSlot?.gearItem;
                if (gearItem) {
                    equipSlot.melds.forEach(meldSlot => meldSlot.equippedMateria = null);
                }
            }
        }
        const generatedGearsets = new Set<CharacterGearSet>
        let possibleMeldCombinations = new Map<string, EquipmentSetWithStats>();
        const baseEquipSet = new EquipmentSetWithStats(new EquipmentSet, new RawStats);

        // Generate these first to avoid re-doing them. Also saves memory by letting our EquipmentSets shallow copy EquippedItems which all reside in here.
        const allIndividualGearPieces: Map<string, Set<ItemWithStats>> = new Map<string, Set<ItemWithStats>>();
        for (const slotKey of EquipSlots) {
            if (equipment[slotKey] === null || equipment[slotKey] === undefined) continue;

            const pieceCombinations = this.getAllMeldCombinationsForGearItem(equipment[slotKey]);
            allIndividualGearPieces.set(slotKey, pieceCombinations);
        }

        possibleMeldCombinations.set(this.statsToString(baseEquipSet.stats, this.relevantStats), baseEquipSet);

        /**
         * Basic Algorithm (here n = number of equipment slots filled)
         * n = 0: Return all melds for 0th gear slot
         * n > 0: Find all possible combinations for n-1. For each of these, append all melds for n'th gear slot
         * 
         * Solve n=0, then iterate through n=11, caching the previous results.
         * This is O(m^11), where m is the number of unique-statted ways to meld one gear piece.
         * It may be better than O(m^11) if discarding duplicate/worse sets improves the complexity. idk
         * This code is very hot.
         */
        for (const slotKey of EquipSlots) {

            if (equipment[slotKey] === null || equipment[slotKey] === undefined) continue;

            const newGearsets = new Map<string, EquipmentSetWithStats>();
            for (const currSet of possibleMeldCombinations.values()) {

                for (const currPiece of allIndividualGearPieces.get(slotKey).values()) {

                    await this.addPieceIfNotDuplicate(currPiece, currSet, slotKey, newGearsets);
                }
            }

            possibleMeldCombinations = newGearsets;
        }


        for (const combination of possibleMeldCombinations.values()) {

            const newGearset: CharacterGearSet = new CharacterGearSet(this._sheet);
            newGearset.food = gearset.food;
            newGearset.equipment = combination.set;
            
            newGearset.forceRecalc();
            generatedGearsets.add(newGearset);
        }

        return generatedGearsets;
    }

    async addPieceIfNotDuplicate(piece: ItemWithStats, set: EquipmentSetWithStats, slot: EquipSlotKey, existingSets: Map<string, EquipmentSetWithStats>) {

        const setStatsWithPiece = this.addStats(Object.assign({}, set.stats), piece.stats);
        const setPlusNewPieceKey = this.statsToString(setStatsWithPiece, this.relevantStats);

        if (!existingSets.has(setPlusNewPieceKey)) {
            const setPlusNewPiece = this.cloneEquipmentSetWithStats(set);
            setPlusNewPiece.set[slot] = piece.item;
            setPlusNewPiece.stats = setStatsWithPiece;

            existingSets.set(setPlusNewPieceKey, setPlusNewPiece);
        }
    }

    public getAllMeldCombinationsForGearItem(equippedItem: EquippedItem): Set<ItemWithStats> | null {
        const meldCombinations: Map<string, ItemWithStats> = new Map<string, ItemWithStats>();

        const basePiece = new ItemWithStats(this.cloneEquippedItem(equippedItem), this.getPieceEffectiveStats(equippedItem));
        meldCombinations.set(this.statsToString(equippedItem.gearItem.stats, this.relevantStats), basePiece);

        for (let slotNum = 0; slotNum < equippedItem.gearItem.materiaSlots.length; slotNum += 1) {

            // We are presuming that any pre-existing materia is locked. Skip this slot and continue from next.
            if (equippedItem.melds[slotNum].equippedMateria !== null && equippedItem.melds[slotNum].equippedMateria !== undefined) {
                continue;
            }

            // Add new items after the loop
            const itemsToAdd: Map<string, ItemWithStats> = new Map<string, ItemWithStats>(); 
            for (const [statsKey, existingCombination] of meldCombinations) {

                const stats = existingCombination.stats;

                for (const stat of this.relevantStats) {

                    const materia = this._sheet.getBestMateria(stat, existingCombination.item.melds[slotNum]);

                    const newStats: RawStats = Object.assign({}, stats);
                    newStats[stat] += materia.primaryStatValue;
                    const newStatsKey = this.statsToString(newStats, this.relevantStats);


                    if (stats[stat] + materia.primaryStatValue - existingCombination.item.gearItem.statCaps[stat] < MATERIA_ACCEPTABLE_OVERCAP_LOSS
                        && !itemsToAdd.has(newStatsKey) // Skip if this combination of stats has been found
                    ) {
                        const newMelds: MeldableMateriaSlot[] = this.cloneMelds(existingCombination.item.melds);
                        newMelds[slotNum].equippedMateria = materia;

                        itemsToAdd.set(newStatsKey, new ItemWithStats(new EquippedItem(equippedItem.gearItem, newMelds), newStats));
                    }
                }

                meldCombinations.delete(statsKey); // Only take fully melded items
            }

            for (const item of itemsToAdd) {
                meldCombinations.set(item[0], item[1]);
            }

        }
        
        return new Set(meldCombinations.values());
    }

    cloneEquipmentSetWithStats(set: EquipmentSetWithStats): EquipmentSetWithStats {
        // Shallow copy the individual pieces because they don't need to be unique. i.e. We only need one copy of a DET/DET weapon
        return new EquipmentSetWithStats(Object.assign({}, set.set), Object.assign({}, set.stats));
    }

    cloneEquipmentset(set: EquipmentSet): EquipmentSet {
        const result = new EquipmentSet;
        for(const equipSlotKey in set) {
            result[equipSlotKey] = this.cloneEquippedItem(set[equipSlotKey]);
        }

        return result;
    }

    cloneEquippedItem(item: EquippedItem): EquippedItem {
        return new EquippedItem(item.gearItem, this.cloneMelds(item.melds));
    }

    statsToString(stats: RawStats, relevantStats: MateriaSubstat[]): string {
        let result = "";
        for (const statKey of relevantStats) {
            result += stats[statKey].toString() + ',';
        }

        return result;
    }

    addStats(target: RawStats, toAdd: RawStats): RawStats {

        for (const stat of this.relevantStats) {
            target[stat] += toAdd[stat];
        }

        return target;
    }

    getPieceEffectiveStats(item: EquippedItem): RawStats {
        const stats = Object.assign({}, item.gearItem.stats);
        for (const meld of item.melds) {
            if (meld.equippedMateria === null || meld.equippedMateria === undefined) continue;
            stats[meld.equippedMateria.primaryStat] += meld.equippedMateria.primaryStatValue;
        }

        return stats;
    }

    getEquipmentSetEffectiveStats(set: EquipmentSet): RawStats {

        let stats = new RawStats;
        for (const piece in set) {
            if (set[piece] === null || set[piece] === undefined) continue;
            stats = this.addStats(stats, this.getPieceEffectiveStats(set[piece]));
        }

        return stats;
    }

    cloneMelds(melds: MeldableMateriaSlot[]): MeldableMateriaSlot[] {
        const newMelds: MeldableMateriaSlot[] = [];
        for (const meld of melds) {
            newMelds.push(Object.assign({}, meld));
        }

        return newMelds;
    }
}