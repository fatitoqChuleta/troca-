ALTER TABLE `swap_proposals` ADD `ownerCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `swap_proposals` ADD `proposerCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `termsVersion` varchar(40);--> statement-breakpoint
ALTER TABLE `users` ADD `termsAcceptedAt` timestamp;