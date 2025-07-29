const { addItemToCarts, deleteItemFromCart, editCartItemQuantity, getCartByUser, getCartItmesByCart, placeOrder, getAllOrderByUser, getSingleOrderByOrderId, getAllProducts, toggleUserLikedProducts, getAllLikedProductsByUser, getAllProductsByCategory, getSingleProduct, getAllCategoriesHealth, getAllProductsAdmin, getSingleCategory, getSingleProductAdmin } = require("../controllers/health")
const verifyToken = require("../middleware/auth")

const router =require("express").Router()

router.post("/add-items-to-cart",verifyToken,addItemToCarts)

router.delete("/delete-items-from-cart",verifyToken,deleteItemFromCart)

router.post("/edit-cart-itme-quantity/:cartItemId",verifyToken,editCartItemQuantity)

router.get("/get-cart/:patientId",verifyToken,getCartByUser)

router.get("/get-cart-items/:cartId",verifyToken,getCartItmesByCart)


router.post("/place-order",verifyToken,placeOrder)

router.get("/get-all-orders/:patientId",verifyToken,getAllOrderByUser)

router.get("/get-single-order/:orderId",verifyToken,getSingleOrderByOrderId)

router.post("/products/all",verifyToken, getAllProducts)

router.get("/products/all/admin", getAllProductsAdmin)

router.post("/toogle/like",verifyToken,toggleUserLikedProducts)

router.get('/products/liked/:patientId',verifyToken,getAllLikedProductsByUser)

router.post("/products/category/:categoryId",verifyToken,getAllProductsByCategory)

router.get("/category",getAllCategoriesHealth)

router.get("/category/single/:categoryId",getSingleCategory)

router.post("/product/single/:productId",verifyToken,getSingleProduct)

router.get("/product/single/admin/:productId",getSingleProductAdmin)

module.exports=router