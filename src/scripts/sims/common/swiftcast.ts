import {Ability, Buff, BuffController, OgcdAbility} from "../sim_types";

export const SwiftcastBuff: Buff = {
    cooldown: 0,
    duration: 0,
    effects: {},
    // TODO
    job: 'WHM',
    name: "Swiftcast",
    selfOnly: true,
    startTime: 0,
    beforeAbility: (controller: BuffController, ability: Ability) => {
        if (ability.type === 'gcd' && ability.cast >= 0) {
            ability.cast = 0;
            controller.removeStatus(SwiftcastBuff);
        }
    }
}

export const SwiftcastAbility: OgcdAbility = {
    activatesBuffs: [SwiftcastBuff],
    id: 0, // TODO
    name: "Swiftcast",
    potency: null,
    type: "ogcd",
    attackType: 'Ability',
    animationLock: 0.6

}
