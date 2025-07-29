const coupon = require("../models/coupon");

class PhysioHelper {
    /**
     * Get platform charges percentage based on plan type.
     * @param {number} planType - The plan type (0, 1, or 2).
     * @returns {number} - The platform charges percentage.
     * @throws {Error} - If the plan type is invalid.
     */
    static getPlatformCharges(planType) {
        const validPlanTypes = { 0: 22, 1: 22, 2: 17 };

        if (!(planType in validPlanTypes)) {
            throw new Error('Invalid plan type');
        }

        return validPlanTypes[planType];
    }

}



module.exports = PhysioHelper;