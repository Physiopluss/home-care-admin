const Patient = require("../models/patient")
const Category = require("../models/category")
const Product = require("../models/product")
const Cart = require("../models/cart")
const CartItem = require("../models/cartItem")
const Order = require("../models/order")



exports.addItemToCarts = async (req, res) => {
    const { patientId, cartId, productId, quantity } = req.body
    const theUser = await Patient.findById(patientId)
    const theCart = await Cart.findById(cartId)
    const theProduct = await Product.findById(productId)

    if (!theUser) {
        res.json({ status: false, message: "patient not found" })
    }
    if (!theProduct) {
        res.json({ status: false, message: "product not found" })
    } if (!theCart) {
        const newCart = await new Cart({
            userId: patientId,
            createdAt: new Date()
        })
        await newCart.save()
        const newCartItem = await new CartItem({
            userId: patientId,
            cartId: newCart._id,
            productId: productId,
            productTitle: theProduct.productName,
            productImage: theProduct.productImage,
            price: theProduct.price,
            quantity: quantity,
            createdAt: new Date()
        })
        await newCartItem.save()
        res.json({ status: true, message: "item added to the cart", data: newCartItem })
    }
    else {
        const newCartItem = await new CartItem({
            userId: patientId,
            cartId: cartId,
            productId: productId,
            productTitle: theProduct.productName,
            productImage: theProduct.productImage,
            price: theProduct.price,
            quantity: quantity,
            createdAt: new Date()
        })
        await newCartItem.save()
        res.json({ status: true, message: "item added to the cart", data: newCartItem })

    }
}

exports.deleteItemFromCart = async (req, res) => {
    const { patientId, cartItemId } = req.body
    const theUser = await Patient.findById(patientId)
    const theCartItem = await CartItem.findById(cartItemId)
    if (!theUser) {
        res.json({ status: false, message: "patient not found" })
    } if (!theCartItem) {
        res.json({ status: false, message: "cart item not found" })
    } else {
        await CartItem.findByIdAndDelete(cartItemId)
        res.json({ status: true, message: "item removed successfully" })
    }
}

exports.editCartItemQuantity = async (req, res) => {
    const cartItemId = req.params.cartItemId
    const quantity = req.body.quantity
    const theCartItem = await CartItem.findById(cartItemId)
    if (!theCartItem) {
        res.json({ status: false, message: "item not found" })
    } else {
        const updated = await CartItem.findByIdAndUpdate(cartItemId, {
            quantity: quantity
        }, { new: true })
        res.json({ status: true, message: "item updated", data: updated })
    }
}

exports.getCartByUser = async (req, res) => {
    const patientId = req.params.patientId
    const theUser = await Patient.findById(patientId)
    if (!theUser) {
        res.json({ status: false, message: "patient not found" })
    } else {
        const theCart = await Cart.findOne({ userId: patientId }).lean()
        const theCartItems = await CartItem.find({ cartId: theCart._id })
        theCart.cartItem = theCartItems
        res.json({ status: true, message: "data returned", data: theCart })
    }
}

exports.getCartItmesByCart = async (req, res) => {
    const cartId = req.params.cartId
    const theCart = await Cart.findById(cartId)
    if (!theCart) {
        res.json({ status: false, message: "cart not found" })
    } else {
        const theCartItem = await CartItem.find({ cartId: cartId }).lean()

        //   await Promise.all(thePromis)
        res.json({ status: true, message: "data returned", data: theCartItem })
    }
}


exports.placeOrder = async (req, res) => {
    const { patientId, products, totalPrice, isDiscountCouponApplied, discountCoupon, fullName, phone, flat_house_building, street_colony, pinCode, city, state, landmark } = req.body
    const theUser = await Patient.findById(patientId)
    if (!theUser) {
        res.json({ status: false, message: "patient not found" })
    } else {
        const newOrder = await new Order({
            userId: patientId,
            products: products,
            orderedAt: new Date(),
            totalPrice: totalPrice,
            deliveredAt: null,
            isDiscountCouponApplied: isDiscountCouponApplied,
            discountCoupon: discountCoupon,
            fullName: fullName,
            phone: phone,
            address: {
                flat_house_building: flat_house_building,
                street_colony: street_colony,
                pinCode: pinCode,
                city: city,
                state: state,
                landmark: landmark
            },
            orderStatus: 0
        })
        await newOrder.save()
        res.json({ status: true, message: "order placed", data: newOrder })
        await products.map(async i => {
            await CartItem.deleteMany({ productId: i.productId })
            return i
        })
    }
}

exports.getAllOrderByUser = async (req, res) => {
    let skip = req.query.skip || 0
    let limit = req.query.limit || 0
    const patientId = req.params.patientId
    const theUser = await Patient.findById(patientId)
    if (!theUser) {
        res.json({ status: false, message: "patient not found" })
    } else {
        const theOrders = await Order.find({ userId: patientId }).skip(skip).limit(limit).lean()

        res.json({ status: true, message: "data returned", data: theOrders })
    }
}

exports.getSingleOrderByOrderId = async (req, res) => {
    const orderId = req.params.orderId
    const theOrder = await Order.findById(orderId).lean()
    if (!theOrder) {
        res.json({ Status: false, message: "order not found" })
    } else {
        res.json({ status: true, message: "data returned", data: theOrder })
    }
}


exports.getAllCategoriesHealth = async (req, res) => {
    const theCategory = await Category.find()
    res.json({ status: true, message: "data returned", data: theCategory })
}

exports.getSingleCategory = async (req, res) => {
    const categoryId = req.params.categoryId
    const theCategory = await Category.findById(categoryId)
    if (!theCategory) {
        res.json({ status: false, message: "category not found" })
    } else {
        res.json({ status: true, message: "data returned", data: theCategory })
    }

}


exports.getAllProducts = async (req, res) => {
    let skip = req.query.skip || 0
    let limit = req.query.limit || 0
    let keyword = req.query.keyword
    // const categoryId = req.body.categoryId || ""
    // const subCategoryId = req.body.subCategoryId || ""
    const patientId = req.body.patientId



    const theUser = await Patient.findById(patientId)
    const allProducts = await Product.find({ productName: { $regex: new RegExp(keyword, 'i') } }).lean()
    const promis = await allProducts.map(async i => {


        if (theUser.liked.includes(i._id)) {
            i.isLiked = true
        } else {
            i.isLiked = false
        }



    })
    await Promise.all(promis)

    res.json({ status: true, message: "data returned", data: allProducts })


}
exports.getAllProductsAdmin = async (req, res) => {
    let skip = req.query.skip || 0
    let limit = req.query.limit || 0
    // let keyword = req.query.keyword
    // const categoryId = req.body.categoryId || ""
    // const subCategoryId = req.body.subCategoryId || ""
    // const patientId = req.body.patientId



    //     const theUser = await Patient.findById(patientId)
    const allProducts = await Product.find().lean()

    res.json({ status: true, message: "data returned", data: allProducts })


}

exports.toggleUserLikedProducts = async (req, res) => {
    //651bee29defd9cb4192d7da3
    //651afc146a3ddcb28bace456   651b0b336a3ddcb28bace460
    const productId = req.body.productId;
    const patientId = req.body.patientId;
    const thePatient = await Patient.findById(patientId)
    const theProduct = await Product.findById(productId)
    // const theHospitalDoctor = await HospitalDoctor.findById(doctorId)
    const likedProduct = []
    const promises = await thePatient.liked.map(i => {
        return likedProduct.push(i)
    })
    await Promise.all(promises)
    // console.log(favouriteDoctors)
    if (!thePatient) {
        res.json({ status: false, message: "no Patient exists with this Id" })
    } else {
        if (!theProduct) {
            res.json({ status: false, message: "no product exists with this Id" })
        } else {
            const filterProducts = await likedProduct.filter(i => {
                return i.includes(productId.toString())
            })
            if (filterProducts.length === 0) {
                likedProduct.push(productId.toString())
                const updatedData = await Patient.findByIdAndUpdate(patientId, {
                    liked: likedProduct
                }, { new: true })
                res.json({ status: true, message: "product liked", data: updatedData })
            } else {
                // resMsg = "Favourite removed successfully";
                const likedProduct2 = await likedProduct.filter(i => {
                    return !i.includes(productId.toString())
                })
                const updatedData = await Patient.findByIdAndUpdate(patientId, {
                    liked: likedProduct2
                }, { new: true })
                res.json({ status: true, message: "product remove from liked", data: updatedData })
            }
        }
    }
}


exports.getAllLikedProductsByUser = async (req, res) => {
    const patientId = req.params.patientId
    const theUser = await Patient.findById(patientId).lean()
    if (!theUser) {
        res.json({ status: false, message: "no user exists" })
    } else {
        let AllProducts = []
        const promis = await theUser.liked.map(async i => {
            const theProduct = await Product.findById(i)
            if (theProduct) {
                AllProducts.push(theProduct)
                return i
            }
        })
        await Promise.all(promis)


        res.json({ status: true, message: "data returned", data: AllProducts })
    }
}

exports.getAllProductsByCategory = async (req, res) => {
    let skip = req.query.skip || 0
    let limit = req.query.limit || 0
    const categoryId = req.params.categoryId
    const patientId = req.body.patientId

    const theUser = await Patient.findById(patientId)
    const theCategory = await Category.findById(categoryId)
    if (!theCategory) {
        res.json({ status: false, message: "category not exists" })
    } else {
        const theProducts = await Product.find({ categoryId: categoryId }).skip(skip).limit(limit).lean()
        const prmois = await theProducts.map(async i => {

            if (theUser.liked.includes(i._id)) {
                i.isLiked = true
            } else {
                i.isLiked = false
            }

            return i
        })
        await Promise.all(prmois)
        res.json({ status: true, message: "data returned", data: theProducts })
    }

}




exports.getSingleProduct = async (req, res) => {
    const productId = req.params.productId
    const patientId = req.body.patientId
    const theProduct = await Product.findById(productId).lean()

    const theUser = await Patient.findById(patientId)
    if (!theProduct) {
        res.json({ status: false, message: "product not exists" })
    } else {

        if (theUser.liked.includes(productId)) {
            theProduct.isLiked = true
        } else {
            theProduct.isLiked = false
        }
        res.json({ status: true, message: "data returned", data: theProduct })
    }


}


exports.getSingleProductAdmin = async (req, res) => {
    const productId = req.params.productId
    // const patientId =req.body.patientId
    const theProduct = await Product.findById(productId)
    console.log(theProduct)
    //    const theUser =await Patient.findById(patientId)
    if (!theProduct) {
        res.json({ status: false, message: "product not exists" })
    } else {

        res.json({ status: true, message: "data returned", data: theProduct })

    }


}