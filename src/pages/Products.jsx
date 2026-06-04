import React, { useEffect, useState } from 'react';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    category: 'General',
    unit: 'pcs',
    costPrice: '',
    sellingPrice: '',
    note: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const list = await window.api.getProducts?.() || [];
      setProducts(list);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const categories = ['All', ...new Set(products.map(p => p.category || 'General'))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const resetForm = () => {
    setForm({
      name: '',
      category: 'General',
      unit: 'pcs',
      costPrice: '',
      sellingPrice: '',
      note: ''
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Product name is required');
      return;
    }

    try {
      const productData = {
        ...form,
        costPrice: parseFloat(form.costPrice) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
      };
      if (editId) {
        await window.api.updateProduct({ ...productData, id: editId });
      } else {
        await window.api.addProduct(productData);
      }
      await loadProducts();
      resetForm();
    } catch (err) {
      console.error('Failed to save product:', err);
      alert('Failed to save product');
    }
  };

  const handleEdit = (product) => {
    setForm({
      name: product.name,
      category: product.category || 'General',
      unit: product.unit || 'pcs',
      costPrice: product.costPrice ?? '',
      sellingPrice: product.sellingPrice ?? '',
      note: product.note || ''
    });
    setEditId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await window.api.removeProduct(id);
      await loadProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Failed to delete product');
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold section-accent">Add Product</div>
          <div className="opacity-70 text-sm">Manage product catalog with categories and pricing</div>
        </div>
        <button 
          className="btn btn-red"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Close' : '+ Add Product'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card card-red">
          <div className="title mb-3">
            {editId ? 'Edit Product' : 'New Product'}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Product Name *</label>
                <input
                  className="input w-full"
                  placeholder="e.g. A4 Paper Ream"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm opacity-80">Category *</label>
                <select
                  className="input w-full"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option>General</option>
                  <option>Paper</option>
                  <option>Printing</option>
                  <option>Stationery</option>
                  <option>Electronics</option>
                  <option>Office Supplies</option>
                  <option>Packaging</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm opacity-80">Unit</label>
                <select
                  className="input w-full"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                >
                  <option value="pcs">Pieces (Pcs)</option>
                  <option value="ream">Ream</option>
                  <option value="box">Box</option>
                  <option value="kg">Kilogram (Kg)</option>
                  <option value="meter">Meter</option>
                  <option value="feet">Feet</option>
                  <option value="pack">Pack</option>
                </select>
              </div>
              <div>
                <label className="text-sm opacity-80">
                  Cost Price (Hidden) 🔒
                  <span className="text-xs ml-2 opacity-60">(For P&L only)</span>
                </label>
                <input
                  type="number"
                  className="input w-full"
                  placeholder="Enter cost price"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm opacity-80">
                  Selling Price
                  <span className="text-xs ml-2 opacity-60">(Shown on invoice)</span>
                </label>
                <input
                  type="number"
                  className="input w-full"
                  placeholder="Enter selling price"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm opacity-80">Note</label>
              <input
                className="input w-full"
                placeholder="Optional product description"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn" onClick={resetForm}>Reset</button>
              <button className="btn btn-red" onClick={handleSave}>
                {editId ? 'Update' : 'Save'} Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="title">Product Catalog</div>
          <div className="chip chip-blue">{products.length} total products</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-80">Search</label>
            <input
              className="input w-full"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-80">Filter by Category</label>
            <select
              className="input w-full"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="card">
        <div className="title mb-3">
          {filterCategory === 'All' ? 'All Products' : `${filterCategory} Products`}
          <span className="chip ml-2">{filteredProducts.length}</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 opacity-70">
            <div className="text-4xl mb-2">📦</div>
            <div>No products found. Click "+ Add Product" to create one.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map(product => (
              <div key={product.id} className="list-item flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{product.name}</div>
                    <div className="chip">{product.category}</div>
                    <div className="chip chip-blue">{product.unit}</div>
                  </div>
                  {product.note && (
                    <div className="text-sm opacity-70 mt-1">{product.note}</div>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <div>
                      <span className="opacity-70">Selling Price: </span>
                      <span className="font-semibold">PKR {Number(product.sellingPrice || 0).toLocaleString()}</span>
                    </div>
                    <div className="opacity-50">
                      <span>🔒 Cost: PKR {Number(product.costPrice || 0).toLocaleString()}</span>
                      <span className="text-xs ml-2">(hidden)</span>
                    </div>
                    <div className="opacity-70">
                      <span>Profit: </span>
                      <span className="font-semibold text-[#1f3a8a]">
                        PKR {Number((product.sellingPrice || 0) - (product.costPrice || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    className="btn text-sm"
                    onClick={() => handleEdit(product)}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="btn text-sm"
                    onClick={() => handleDelete(product.id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="card" style={{ backgroundColor: 'rgba(31,58,138,0.04)' }}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="text-sm opacity-80">
            <strong>How it works:</strong>
            <ul className="mt-2 space-y-1 ml-4">
              <li>• <strong>Cost Price (Hidden):</strong> Your purchase cost - not shown on invoices</li>
              <li>• <strong>Selling Price:</strong> Shown to customers on invoices</li>
              <li>• <strong>Profit Calculation:</strong> Automatically calculated at month-end for Profit & Loss reports</li>
              <li>• Products added here will appear in "Quick Add Items" when creating invoices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
