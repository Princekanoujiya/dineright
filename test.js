const items = [
    { master_item_id: 1, product_quantity: 2 },
    { master_item_id: 12, product_quantity: 6 }
  ];
  
  // Extract master_item_id = 1
  const item = items.find(i => i.master_item_id === 1);

  console.log(item)