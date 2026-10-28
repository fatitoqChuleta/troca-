CREATE TABLE `swap_meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`proposedById` int NOT NULL,
	`location` varchar(255) NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('proposed','confirmed','cancelled') NOT NULL DEFAULT 'proposed',
	`ownerAcceptedAt` timestamp,
	`proposerAcceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `swap_meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swap_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`reporterId` int NOT NULL,
	`reportedUserId` int NOT NULL,
	`reason` varchar(48) NOT NULL,
	`details` varchar(2000) NOT NULL,
	`status` enum('open','under_review','resolved','rejected') NOT NULL DEFAULT 'open',
	`reviewedById` int,
	`adminNote` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `swap_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `swap_reports_proposal_reporter_uq` UNIQUE(`proposalId`,`reporterId`)
);
--> statement-breakpoint
CREATE TABLE `swap_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`reviewerId` int NOT NULL,
	`revieweeId` int NOT NULL,
	`rating` int NOT NULL,
	`met` boolean NOT NULL,
	`itemMatched` boolean NOT NULL,
	`comment` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `swap_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `swap_reviews_proposal_reviewer_uq` UNIQUE(`proposalId`,`reviewerId`)
);
--> statement-breakpoint
CREATE TABLE `swap_listing_reservations` (
	`listingId` int NOT NULL,
	`proposalId` int NOT NULL,
	`previousStatus` enum('active','paused') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `swap_listing_reservations_listingId` PRIMARY KEY(`listingId`)
);
--> statement-breakpoint
ALTER TABLE `swap_listings` MODIFY COLUMN `status` enum('active','paused','reserved','traded','removed') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `swap_proposals` MODIFY COLUMN `status` enum('pending','accepted','declined','completed','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `swap_proposals` ADD `offeredListingId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `accountStatus` enum('active','suspended','banned') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `accountStatusNote` text;--> statement-breakpoint
ALTER TABLE `users` ADD `accountStatusUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `accountStatusUpdatedBy` int;--> statement-breakpoint
ALTER TABLE `swap_meetings` ADD CONSTRAINT `swap_meetings_proposalId_swap_proposals_id_fk` FOREIGN KEY (`proposalId`) REFERENCES `swap_proposals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_meetings` ADD CONSTRAINT `swap_meetings_proposedById_users_id_fk` FOREIGN KEY (`proposedById`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_reports` ADD CONSTRAINT `swap_reports_proposalId_swap_proposals_id_fk` FOREIGN KEY (`proposalId`) REFERENCES `swap_proposals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_reports` ADD CONSTRAINT `swap_reports_reporterId_users_id_fk` FOREIGN KEY (`reporterId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_reports` ADD CONSTRAINT `swap_reports_reportedUserId_users_id_fk` FOREIGN KEY (`reportedUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_reports` ADD CONSTRAINT `swap_reports_reviewedById_users_id_fk` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_reviews` ADD CONSTRAINT `swap_reviews_proposalId_swap_proposals_id_fk` FOREIGN KEY (`proposalId`) REFERENCES `swap_proposals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_reviews` ADD CONSTRAINT `swap_reviews_reviewerId_users_id_fk` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_reviews` ADD CONSTRAINT `swap_reviews_revieweeId_users_id_fk` FOREIGN KEY (`revieweeId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_listing_reservations` ADD CONSTRAINT `swap_listing_reservations_listingId_swap_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `swap_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `swap_listing_reservations` ADD CONSTRAINT `swap_listing_reservations_proposalId_swap_proposals_id_fk` FOREIGN KEY (`proposalId`) REFERENCES `swap_proposals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `swap_meetings_proposal_created_idx` ON `swap_meetings` (`proposalId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `swap_meetings_status_scheduled_idx` ON `swap_meetings` (`status`,`scheduledAt`);--> statement-breakpoint
CREATE INDEX `swap_reports_reported_created_idx` ON `swap_reports` (`reportedUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `swap_reports_status_created_idx` ON `swap_reports` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `swap_reviews_reviewee_created_idx` ON `swap_reviews` (`revieweeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `swap_listing_reservations_proposal_idx` ON `swap_listing_reservations` (`proposalId`);--> statement-breakpoint
ALTER TABLE `swap_proposals` ADD CONSTRAINT `swap_proposals_offeredListingId_swap_listings_id_fk` FOREIGN KEY (`offeredListingId`) REFERENCES `swap_listings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `swap_proposals_offered_listing_idx` ON `swap_proposals` (`offeredListingId`);