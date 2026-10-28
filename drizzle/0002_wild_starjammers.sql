CREATE TABLE `site_activity_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`activityType` varchar(48) NOT NULL,
	`actorId` int,
	`listingId` int,
	`proposalId` int,
	`summary` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `site_activity_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swap_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientId` int NOT NULL,
	`actorId` int,
	`listingId` int,
	`proposalId` int,
	`kind` varchar(48) NOT NULL,
	`title` varchar(160) NOT NULL,
	`body` text NOT NULL,
	`href` varchar(512) NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `swap_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `site_activity_events` ADD CONSTRAINT `site_activity_events_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_activity_events` ADD CONSTRAINT `site_activity_events_listingId_swap_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `swap_listings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_activity_events` ADD CONSTRAINT `site_activity_events_proposalId_swap_proposals_id_fk` FOREIGN KEY (`proposalId`) REFERENCES `swap_proposals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_notifications` ADD CONSTRAINT `swap_notifications_recipientId_users_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_notifications` ADD CONSTRAINT `swap_notifications_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_notifications` ADD CONSTRAINT `swap_notifications_listingId_swap_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `swap_listings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_notifications` ADD CONSTRAINT `swap_notifications_proposalId_swap_proposals_id_fk` FOREIGN KEY (`proposalId`) REFERENCES `swap_proposals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `site_activity_created_idx` ON `site_activity_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `site_activity_type_created_idx` ON `site_activity_events` (`activityType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `swap_notifications_recipient_created_idx` ON `swap_notifications` (`recipientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `swap_notifications_recipient_read_idx` ON `swap_notifications` (`recipientId`,`readAt`);