CREATE UNIQUE INDEX IF NOT EXISTS "catalog_variants_item_label_active_unique"
	ON "catalog_variants" ("item_id", "label") WHERE "active" = true;
