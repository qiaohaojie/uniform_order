CREATE UNIQUE INDEX IF NOT EXISTS "order_events_paid_unique"
	ON "order_events" ("order_id") WHERE "event_type" = 'order_paid';
