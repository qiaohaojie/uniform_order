-- Index to accelerate getPreviousSizeHint: tenant + parent email scan on orders
CREATE INDEX IF NOT EXISTS idx_orders_tenant_parent_email
  ON orders (tenant_id, parent_email);

-- Index to accelerate getPreviousSizeHint: item filter on order_lines
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id_item_id
  ON order_lines (order_id, item_id);
