CREATE TABLE `swap_listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`category` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`condition` varchar(48) NOT NULL,
	`wants` varchar(255) NOT NULL,
	`location` varchar(160) NOT NULL,
	`imageUrl` varchar(512),
	`status` enum('active','paused','traded','removed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `swap_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swap_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`senderId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `swap_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swap_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`ownerId` int NOT NULL,
	`proposerId` int NOT NULL,
	`offeredItem` varchar(200) NOT NULL,
	`status` enum('pending','accepted','declined','completed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `swap_proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `swap_listings` ADD CONSTRAINT `swap_listings_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_messages` ADD CONSTRAINT `swap_messages_proposalId_swap_proposals_id_fk` FOREIGN KEY (`proposalId`) REFERENCES `swap_proposals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_messages` ADD CONSTRAINT `swap_messages_senderId_users_id_fk` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_proposals` ADD CONSTRAINT `swap_proposals_listingId_swap_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `swap_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_proposals` ADD CONSTRAINT `swap_proposals_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_proposals` ADD CONSTRAINT `swap_proposals_proposerId_users_id_fk` FOREIGN KEY (`proposerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `swap_listings_owner_idx` ON `swap_listings` (`ownerId`);--> statement-breakpoint
CREATE INDEX `swap_listings_status_created_idx` ON `swap_listings` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `swap_messages_proposal_created_idx` ON `swap_messages` (`proposalId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `swap_proposals_owner_idx` ON `swap_proposals` (`ownerId`);--> statement-breakpoint
CREATE INDEX `swap_proposals_proposer_idx` ON `swap_proposals` (`proposerId`);--> statement-breakpoint
CREATE INDEX `swap_proposals_listing_idx` ON `swap_proposals` (`listingId`);