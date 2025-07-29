const Subspecialization = require('../../models/subSpecialization')
const Specialization = require('../../models/specialization')



// Create Subspecialization
exports.createSubspecialization = async (req, res) => {
    try {
        const { specializationId, name } = req.body
        // return console.log(req.body)
        if (!specializationId) {
            return res.status(400).json({
                message: 'SpecializationId is required',
                status: 400,
                success: false
            })
        }
        if (!name) {
            return res.status(400).json({
                message: 'Name is required',
                status: 400,
                success: false
            })
        }

        const specialization = await Specialization.findById(specializationId)
        if (!specialization) {
            return res.status(400).json({
                message: 'Specialization not found',
                status: 400,
                success: false
            })
        }
        const subspecialization = new Subspecialization({
            specializationId: specialization._id,
            name: name
        })
        await subspecialization.save()
        res.status(200).json({
            message: 'Subspecialization created successfully',
            status: 200,
            success: true,
            data: subspecialization
        })
    } catch (err) {
        res.status(400).json({
            message: 'Something went wrong',
            status: 400,
            success: false
        })
    }

}

// edit Subspecialization
exports.editSubspecialization = async (req, res) => {
    try {
        const { specializationId, subspecializationId, name } = req.body

        if (!specializationId) {
            return res.status(400).json({
                message: 'SpecializationId is required',
                status: 400,
                success: false
            })
        }
        if (!subspecializationId) {
            return res.status(400).json({
                message: 'SubspecializationId is required',
                status: 400,
                success: false
            })
        }
        if (!name) {
            return res.status(400).json({
                message: 'Name is required',
                status: 400,
                success: false
            })
        }
        const specialization = await Specialization.findById(specializationId)
        if (!specialization) {
            return res.status(400).json({
                message: 'Specialization not found',
                status: 400,
                success: false
            })
        }
        const subspecialization = await Subspecialization.findById(subspecializationId)
        if (!subspecialization) {
            return res.status(400).json({
                message: 'Subspecialization not found',
                status: 400,
                success: false
            })
        }
        subspecialization.name = name
        subspecialization.specializationId = subspecialization._id
        await subspecialization.save()
        res.status(200).json({
            message: 'Subspecialization updated successfully',
            status: 200,
            success: true,
            data: subspecialization
        })
    } catch (err) {
        res.status(400).json({
            message: 'Something went wrong',
            status: 400,
            success: false
        })
    }
}

// Get all Subspecialization
exports.getAllSubspecialization = async (req, res) => {
    try {
        let specializationId = req.body.specializationId;

        // console.log('specializationId', specializationId)

        const subspecialization = await Subspecialization.find({
            specializationId: specializationId
        })
        res.status(200).json({
            message: 'Subspecialization fetched successfully',
            status: 200,
            success: true,
            data: subspecialization
        })
    } catch (err) {
        res.status(400).json({
            message: 'Something went wrong',
            status: 400,
            success: false
        })
    }
}