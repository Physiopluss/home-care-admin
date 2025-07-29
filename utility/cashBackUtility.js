
const CashBack = require('../models/cashBack')
const redisClient = require('./redisClient')


const cacheKey = `patientCount:AllTreamnetDayPaymentComplete`;
exports.CashBackCacheKey = () => cacheKey

exports.GiveCashBack = async (obj) => {

   try {
      const data = new CashBack(obj)

      await data.save()
      return data

   } catch (error) {
      console.log('Error CashBack' + error);

      return null
   }

}