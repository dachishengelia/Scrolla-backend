import React, { useContext } from "react";
import { CartContext } from "../context/CartContext.jsx";

export default function CartPage() {
  const { cart, removeFromCart } = useContext(CartContext);

  const handleRemove = async (id) => {
    try {
      await removeFromCart(id);
    } catch (error) {
      console.error("Failed to remove item from cart:", error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Your Cart</h2>
      {cart.products?.length === 0 ? (
        <p className="text-center text-gray-500">Your cart is empty.</p>
      ) : (
        <div className="space-y-6">
          {cart.products?.map((item) => (
            <div
              key={item.product._id}
              className="flex items-center justify-between border-b pb-4"
            >
              <div>
                <h3 className="font-semibold text-lg">{item.product?.name || "Unnamed Product"}</h3>
                <p className="text-gray-500">
                  {item.product?.price ? `${item.product.price} GEL` : "Price not available"}
                </p>
              </div>
              <button
                onClick={() => handleRemove(item.product._id)}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}